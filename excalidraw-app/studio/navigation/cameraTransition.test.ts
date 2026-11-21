import { describe, expect, it, vi } from "vitest";

import { getNormalizedZoom } from "@excalidraw/excalidraw/scene/normalize";

import { CameraTransition, interpolateViewport } from "./cameraTransition";

import type { StudioViewport } from "../viewport";

const camera = (x: number, zoom = 1): StudioViewport => ({
  scrollX: x,
  scrollY: x,
  zoom: { value: getNormalizedZoom(zoom) },
});

const makeView = () => {
  let now = 0;
  let nextId = 0;
  const callbacks = new Map<number, (time: number) => void>();
  return {
    performance: { now: () => now },
    requestAnimationFrame: vi.fn((cb: (time: number) => void) => {
      const id = ++nextId;
      callbacks.set(id, cb);
      return id;
    }),
    cancelAnimationFrame: vi.fn((id: number) => {
      callbacks.delete(id);
    }),
    advance(ms: number) {
      now = ms;
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((cb) => cb(now));
    },
    get pending() {
      return callbacks.size;
    },
  };
};

describe("interpolateViewport", () => {
  it("lands exactly on the target and blends zoom geometrically", () => {
    expect(interpolateViewport(camera(0), camera(100), 1)).toEqual(camera(100));
    expect(
      interpolateViewport(camera(0, 1), camera(0, 4), 0.5).zoom.value,
    ).toBe(2);
  });
});

describe("CameraTransition", () => {
  it("jumps instantly for reduced motion", () => {
    const view = makeView();
    const onFrame = vi.fn();
    const onDone = vi.fn();
    new CameraTransition({
      getView: () => view as unknown as Window,
      durationMs: 250,
      reducedMotion: true,
      onFrame,
      onDone,
    }).animate(camera(0), camera(50));
    expect(onFrame).toHaveBeenCalledWith(camera(50));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(view.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("animates over frames and can be cancelled", () => {
    const view = makeView();
    const onFrame = vi.fn();
    const transition = new CameraTransition({
      getView: () => view as unknown as Window,
      durationMs: 100,
      reducedMotion: false,
      onFrame,
    });
    transition.animate(camera(0), camera(100));
    view.advance(50);
    expect(onFrame).toHaveBeenCalledTimes(1);
    view.advance(100);
    expect(onFrame).toHaveBeenLastCalledWith(camera(100));

    transition.animate(camera(100), camera(0));
    view.advance(25);
    transition.cancel();
    expect(view.cancelAnimationFrame).toHaveBeenCalled();
    const count = onFrame.mock.calls.length;
    view.advance(200);
    expect(onFrame).toHaveBeenCalledTimes(count);
  });
});
