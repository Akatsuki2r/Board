import { describe, expect, it } from "vitest";

import {
  canTransition,
  initialRecordingState,
  recordingReducer,
  type RecordingStateData,
} from "./stateMachine";

const state = (phase: RecordingStateData["phase"]): RecordingStateData => ({
  ...initialRecordingState,
  phase,
});

const result = {
  url: "blob:test",
  blob: new Blob(["x"]),
  mimeType: "video/webm",
  durationMs: 1000,
  captureMode: "canvas" as const,
};

describe("recording state machine", () => {
  it("walks through the full start-to-ready lifecycle", () => {
    let s = recordingReducer(state("idle"), {
      type: "START",
      countdownMs: 3000,
      mode: "canvas",
    });
    expect(s.phase).toBe("countdown");
    expect(s.countdownRemainingMs).toBe(3000);

    s = recordingReducer(s, { type: "COUNTDOWN_DONE" });
    expect(s.phase).toBe("recording");

    s = recordingReducer(s, { type: "PAUSE" });
    expect(s.phase).toBe("paused");
    s = recordingReducer(s, { type: "RESUME" });
    expect(s.phase).toBe("recording");

    s = recordingReducer(s, { type: "STOP" });
    expect(s.phase).toBe("stopping");
    s = recordingReducer(s, { type: "CHUNKS_READY" });
    expect(s.phase).toBe("processing");
    s = recordingReducer(s, { type: "COMPLETE", result });
    expect(s.phase).toBe("ready");
    expect(s.result).toEqual(result);

    s = recordingReducer(s, { type: "DISCARD" });
    expect(s).toEqual(initialRecordingState);
  });

  it("starts immediately when no countdown is configured", () => {
    const s = recordingReducer(state("idle"), {
      type: "START",
      countdownMs: 0,
      mode: "screen",
    });
    expect(s.phase).toBe("recording");
    expect(s.captureMode).toBe("screen");
  });

  it("advances from countdown once the engine has started", () => {
    const countdown = recordingReducer(state("idle"), {
      type: "START",
      countdownMs: 3000,
      mode: "canvas",
    });
    expect(recordingReducer(countdown, { type: "COUNTDOWN_DONE" }).phase).toBe(
      "recording",
    );
    // A zero-countdown start is already recording; the event is ignored.
    const immediate = recordingReducer(state("idle"), {
      type: "START",
      countdownMs: 0,
      mode: "canvas",
    });
    expect(recordingReducer(immediate, { type: "COUNTDOWN_DONE" }).phase).toBe(
      "recording",
    );
  });

  it("allows cancelling a countdown back to idle", () => {
    const s = recordingReducer(state("countdown"), {
      type: "CANCEL_COUNTDOWN",
    });
    expect(s).toEqual(initialRecordingState);
  });

  it("rejects invalid transitions without mutating state", () => {
    expect(canTransition(state("idle"), "PAUSE")).toBe(false);
    expect(recordingReducer(state("idle"), { type: "PAUSE" })).toEqual(
      state("idle"),
    );
    expect(canTransition(state("ready"), "STOP")).toBe(false);
    expect(canTransition(state("paused"), "RESUME")).toBe(true);
  });

  it("preserves a completed result when a later failure occurs", () => {
    const ready = recordingReducer(state("processing"), {
      type: "COMPLETE",
      result,
    });
    const failed = recordingReducer(ready, { type: "FAIL", error: "boom" });
    expect(failed.phase).toBe("failed");
    expect(failed.result).toEqual(result);
    expect(failed.error).toBe("boom");
  });
});
