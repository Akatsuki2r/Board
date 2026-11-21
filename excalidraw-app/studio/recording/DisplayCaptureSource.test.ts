import { describe, expect, it, vi } from "vitest";

import {
  DisplayCaptureSource,
  isDisplayCaptureSupported,
  type DisplayCaptureWindow,
} from "./DisplayCaptureSource";

const makeView = (
  getDisplayMedia?: (...args: unknown[]) => Promise<MediaStream>,
): DisplayCaptureWindow =>
  ({
    navigator: { mediaDevices: getDisplayMedia ? { getDisplayMedia } : {} },
  } as unknown as DisplayCaptureWindow);

const makeStream = () => {
  const listeners: Record<string, Array<() => void>> = {};
  const track = {
    addEventListener: vi.fn((name: string, cb: () => void) => {
      listeners[name] = [...(listeners[name] ?? []), cb];
    }),
    stop: vi.fn(),
  };
  return {
    stream: {
      getVideoTracks: () => [track],
      getTracks: () => [track],
    } as unknown as MediaStream,
    track,
    fireEnded: () => listeners.ended?.forEach((cb) => cb()),
  };
};

describe("DisplayCaptureSource", () => {
  it("detects browser support", () => {
    expect(isDisplayCaptureSupported(makeView(vi.fn()))).toBe(true);
    expect(isDisplayCaptureSupported(makeView())).toBe(false);
    expect(isDisplayCaptureSupported(null)).toBe(false);
  });

  it("throws a clear error when the API is missing", () => {
    expect(() => new DisplayCaptureSource(makeView())).toThrow(/not supported/);
  });

  it("acquires the stream selected in the browser picker", async () => {
    const { stream } = makeStream();
    const getDisplayMedia = vi.fn().mockResolvedValue(stream);
    const source = new DisplayCaptureSource(makeView(getDisplayMedia));
    expect(await source.acquire()).toBe(stream);
    expect(getDisplayMedia).toHaveBeenCalledWith(
      expect.objectContaining({ video: true }),
    );
    expect(source.getStream()).toBe(stream);
    source.dispose();
  });

  it("normalizes permission denial and cancellation", async () => {
    for (const name of ["NotAllowedError", "AbortError"]) {
      const error = new Error("denied");
      error.name = name;
      const source = new DisplayCaptureSource(
        makeView(vi.fn().mockRejectedValue(error)),
      );
      await expect(source.acquire()).rejects.toThrow(
        /cancelled or permission/i,
      );
    }
  });

  it("reports termination and stops tracks on dispose", async () => {
    const { stream, track, fireEnded } = makeStream();
    const source = new DisplayCaptureSource(
      makeView(vi.fn().mockResolvedValue(stream)),
    );
    await source.acquire();
    const onTerminated = vi.fn();
    source.onTerminated(onTerminated);
    fireEnded();
    expect(onTerminated).toHaveBeenCalledTimes(1);
    // Subsequent terminations are ignored.
    fireEnded();
    expect(onTerminated).toHaveBeenCalledTimes(1);
    source.dispose();
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("cleans up tracks when no termination was registered", async () => {
    const { stream, track } = makeStream();
    const source = new DisplayCaptureSource(
      makeView(vi.fn().mockResolvedValue(stream)),
    );
    await source.acquire();
    source.dispose();
    expect(track.stop).toHaveBeenCalledTimes(1);
  });
});
