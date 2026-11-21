/**
 * Explicit recording state machine. Each state carries only the data valid in
 * that state, making impossible combinations (recording + ready) unrepresentable.
 */
export type RecordingPhase =
  | "idle"
  | "countdown"
  | "recording"
  | "paused"
  | "stopping"
  | "processing"
  | "ready"
  | "failed";

export type RecordingEvent =
  | { type: "START"; countdownMs: number; mode: "canvas" | "screen" }
  | { type: "COUNTDOWN_TICK"; remainingMs: number }
  | { type: "ELAPSED"; elapsedMs: number }
  | { type: "COUNTDOWN_DONE" }
  | { type: "CANCEL_COUNTDOWN" }
  | { type: "RECORDER_STARTED" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "STOP" }
  | { type: "CHUNKS_READY" }
  | { type: "COMPLETE"; result: ReadyResult }
  | { type: "FAIL"; error: string }
  | { type: "DISCARD" };

export interface ReadyResult {
  url: string;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  captureMode: "canvas" | "screen";
}

export interface RecordingStateData {
  phase: RecordingPhase;
  error: string | null;
  elapsedMs: number;
  countdownRemainingMs: number;
  countdownTotalMs: number;
  captureMode: "canvas" | "screen";
  result: ReadyResult | null;
}

export const initialRecordingState: RecordingStateData = {
  phase: "idle",
  error: null,
  elapsedMs: 0,
  countdownRemainingMs: 0,
  countdownTotalMs: 0,
  captureMode: "canvas",
  result: null,
};

const ALLOWED: Record<RecordingPhase, readonly RecordingEvent["type"][]> = {
  idle: ["START"],
  countdown: [
    "COUNTDOWN_TICK",
    "COUNTDOWN_DONE",
    "CANCEL_COUNTDOWN",
    "FAIL",
    "DISCARD",
  ],
  recording: ["PAUSE", "STOP", "FAIL", "ELAPSED"],
  paused: ["RESUME", "STOP", "FAIL", "ELAPSED"],
  stopping: ["CHUNKS_READY", "FAIL"],
  processing: ["COMPLETE", "FAIL"],
  ready: ["DISCARD", "START", "FAIL"],
  failed: ["DISCARD", "START"],
};

export const canTransition = (
  state: RecordingStateData,
  event: RecordingEvent["type"],
) => ALLOWED[state.phase].includes(event);

export const recordingReducer = (
  state: RecordingStateData,
  event: RecordingEvent,
): RecordingStateData => {
  if (!canTransition(state, event.type)) {
    return state;
  }
  switch (event.type) {
    case "START":
      return event.countdownMs > 0
        ? {
            ...initialRecordingState,
            phase: "countdown",
            captureMode: event.mode,
            countdownRemainingMs: event.countdownMs,
            countdownTotalMs: event.countdownMs,
          }
        : {
            ...initialRecordingState,
            phase: "recording",
            captureMode: event.mode,
          };
    case "COUNTDOWN_TICK":
      return { ...state, countdownRemainingMs: event.remainingMs };
    case "ELAPSED":
      return state.elapsedMs === event.elapsedMs
        ? state
        : { ...state, elapsedMs: event.elapsedMs };
    case "COUNTDOWN_DONE":
      return { ...state, phase: "recording", countdownRemainingMs: 0 };
    case "CANCEL_COUNTDOWN":
      return initialRecordingState;
    case "RECORDER_STARTED":
      return state;
    case "PAUSE":
      return { ...state, phase: "paused" };
    case "RESUME":
      return { ...state, phase: "recording" };
    case "STOP":
      return { ...state, phase: "stopping" };
    case "CHUNKS_READY":
      return { ...state, phase: "processing" };
    case "COMPLETE":
      return {
        ...state,
        phase: "ready",
        result: event.result,
        error: null,
      };
    case "FAIL":
      return {
        ...state,
        phase: "failed",
        error: event.error,
        // Preserve an already-completed result for export/recovery.
        result: state.result,
      };
    case "DISCARD":
      return initialRecordingState;
    default:
      return state;
  }
};
