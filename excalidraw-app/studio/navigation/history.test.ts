import { describe, expect, it } from "vitest";

import { getNormalizedZoom } from "@excalidraw/excalidraw/scene/normalize";

import {
  createNavigationHistory,
  goBackInHistory,
  goForwardInHistory,
  pushViewport,
} from "./history";

import type { StudioViewport } from "../viewport";

const camera = (value: number): StudioViewport => ({
  scrollX: value,
  scrollY: value,
  zoom: { value: getNormalizedZoom(1) },
});

describe("navigation history", () => {
  it("records only distinct cameras and clears the future on a new jump", () => {
    let history = createNavigationHistory();
    history = pushViewport(history, camera(0));
    history = pushViewport(history, camera(0));
    expect(history.past).toEqual([camera(0)]);

    history = pushViewport(history, camera(10));
    expect(history.past).toEqual([camera(0), camera(10)]);

    const back = goBackInHistory(history, camera(20));
    expect(back.viewport).toEqual(camera(10));
    expect(back.history.future).toEqual([camera(20)]);

    const forward = goForwardInHistory(back.history, camera(10));
    expect(forward.viewport).toEqual(camera(20));
    expect(forward.history.past).toEqual([camera(0), camera(10)]);

    history = pushViewport(back.history, camera(30));
    expect(history.future).toEqual([]);
  });

  it("returns null when there is nowhere to go", () => {
    const empty = createNavigationHistory();
    expect(goBackInHistory(empty, camera(0)).viewport).toBeNull();
    expect(goForwardInHistory(empty, camera(0)).viewport).toBeNull();
  });

  it("caps the back stack", () => {
    let history = createNavigationHistory();
    for (let i = 0; i < 60; i++) {
      history = pushViewport(history, camera(i));
    }
    expect(history.past).toHaveLength(50);
    expect(history.past[0]).toEqual(camera(10));
  });
});
