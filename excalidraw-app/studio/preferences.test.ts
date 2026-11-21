import { beforeEach, describe, expect, it } from "vitest";

import { getNormalizedZoom } from "@excalidraw/excalidraw/scene/normalize";

import {
  createDefaultStudioPreferences,
  loadStudioPreferences,
  saveStudioPreferences,
} from "./preferences";

const STORAGE_KEY = "board-studio-preferences";

const viewpoint = (name: string) => ({
  id: name,
  name,
  viewport: { scrollX: 0, scrollY: 0, zoom: { value: getNormalizedZoom(1) } },
});

describe("studio preferences", () => {
  beforeEach(() => localStorage.clear());

  it("returns defaults for empty or corrupt storage", () => {
    expect(loadStudioPreferences()).toEqual(createDefaultStudioPreferences());
    localStorage.setItem(STORAGE_KEY, "not json");
    expect(loadStudioPreferences()).toEqual(createDefaultStudioPreferences());
  });

  it("migrates legacy global viewpoints to the local board", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ viewpoints: [viewpoint("legacy")] }),
    );
    const loaded = loadStudioPreferences();
    expect(loaded.viewpointsByBoard["local-board"]).toEqual([
      viewpoint("legacy"),
    ]);
  });

  it("keeps board-scoped viewpoints separate", () => {
    const preferences = createDefaultStudioPreferences();
    preferences.viewpointsByBoard = {
      "local-board": [viewpoint("local")],
      "hash:room-1": [viewpoint("shared")],
    };
    saveStudioPreferences(preferences);
    expect(loadStudioPreferences().viewpointsByBoard).toEqual(
      preferences.viewpointsByBoard,
    );
  });

  it("rejects invalid transition, fps and viewpoint data", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        presentation: { transitionDurationMs: 9000, enableTransitions: "yes" },
        recording: { fps: 500 },
        viewpointsByBoard: { "local-board": [{ id: "bad" }] },
      }),
    );
    const loaded = loadStudioPreferences();
    expect(loaded.presentation.transitionDurationMs).toBe(250);
    expect(loaded.presentation.enableTransitions).toBe(true);
    expect(loaded.recording.fps).toBe(30);
    expect(loaded.viewpointsByBoard["local-board"]).toEqual([]);
  });

  it("validates and round-trips annotation defaults", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        annotation: {
          color: "not-a-color",
          strokeWidth: "huge",
          temporaryMode: true,
        },
      }),
    );
    const loaded = loadStudioPreferences();
    expect(loaded.annotation.color).toBe("#1e1e1e");
    expect(loaded.annotation.strokeWidth).toBe("medium");
    expect(loaded.annotation.temporaryMode).toBe(true);

    const preferences = createDefaultStudioPreferences();
    preferences.annotation = {
      color: "#e03131",
      strokeWidth: "bold",
      temporaryMode: true,
    };
    saveStudioPreferences(preferences);
    expect(loadStudioPreferences().annotation).toEqual(preferences.annotation);
  });

  it("round-trips valid transition settings", () => {
    const preferences = createDefaultStudioPreferences();
    preferences.presentation.transitionDurationMs = 500;
    preferences.presentation.enableTransitions = false;
    preferences.presentation.respectReducedMotion = false;
    saveStudioPreferences(preferences);
    const loaded = loadStudioPreferences();
    expect(loaded.presentation.transitionDurationMs).toBe(500);
    expect(loaded.presentation.enableTransitions).toBe(false);
    expect(loaded.presentation.respectReducedMotion).toBe(false);
  });
});
