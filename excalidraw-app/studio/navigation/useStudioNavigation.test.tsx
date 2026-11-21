import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getNormalizedZoom } from "@excalidraw/excalidraw/scene/normalize";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { appJotaiStore, Provider } from "../../app-jotai";
import {
  activeViewpointIdAtom,
  isPresentationModeAtom,
  studioPreferencesAtom,
  viewportHistoryAtom,
} from "../atoms";
import { createDefaultStudioPreferences } from "../preferences";

import { useStudioNavigation } from "./useStudioNavigation";

const view = {
  location: { hash: "" },
  matchMedia: () => ({ matches: false }),
  requestAnimationFrame: vi.fn(),
  cancelAnimationFrame: vi.fn(),
  performance: { now: () => 0 },
};

const appRootRef = {
  current: { ownerDocument: { defaultView: view } },
} as unknown as React.RefObject<HTMLDivElement>;

const makeApi = () => {
  let state = {
    scrollX: 0,
    scrollY: 0,
    zoom: { value: getNormalizedZoom(1) },
    width: 800,
    height: 600,
    offsetLeft: 0,
    offsetTop: 0,
  };
  const elements = [{ id: "a" }] as never;
  const api = {
    getAppState: () => state,
    updateScene: vi.fn((update: { appState: Record<string, unknown> }) => {
      state = { ...state, ...update.appState };
    }),
    setViewport: vi.fn(),
    getSceneElements: () => elements,
  };
  return {
    api: api as unknown as ExcalidrawImperativeAPI,
    getState: () => state,
  };
};

const renderNavigation = (api: ExcalidrawImperativeAPI) =>
  renderHook(() => useStudioNavigation(api, appRootRef), {
    wrapper: ({ children }) => (
      <Provider store={appJotaiStore}>{children}</Provider>
    ),
  });

describe("useStudioNavigation", () => {
  beforeEach(() => {
    const preferences = createDefaultStudioPreferences();
    preferences.presentation.enableTransitions = false;
    appJotaiStore.set(studioPreferencesAtom, preferences);
    appJotaiStore.set(isPresentationModeAtom, true);
    appJotaiStore.set(viewportHistoryAtom, { past: [], future: [] });
    appJotaiStore.set(activeViewpointIdAtom, null);
  });

  it("zooms using the editor's viewport math and records a history entry", () => {
    const { api } = makeApi();
    const { result } = renderNavigation(api);
    act(() => result.current.zoomIn());
    expect(api.updateScene).toHaveBeenCalledTimes(1);
    expect(result.current.canGoBack).toBe(true);
  });

  it("fits content without animation when transitions are disabled", () => {
    const { api } = makeApi();
    const { result } = renderNavigation(api);
    act(() => result.current.fitToContent());
    expect(api.setViewport).toHaveBeenCalledWith(
      expect.objectContaining({ fit: "scale-down", animation: false }),
    );
  });

  it("saves, renames, reorders and deletes board-scoped viewpoints", () => {
    const { api } = makeApi();
    const { result } = renderNavigation(api);
    act(() => result.current.saveViewpoint("Intro"));
    act(() => result.current.saveViewpoint("Detail"));
    expect(result.current.viewpoints.map((item) => item.name)).toEqual([
      "Intro",
      "Detail",
    ]);
    act(() =>
      result.current.renameViewpoint(result.current.viewpoints[1].id, "Zoom"),
    );
    act(() =>
      result.current.moveViewpoint(result.current.viewpoints[1].id, -1),
    );
    expect(result.current.viewpoints.map((item) => item.name)).toEqual([
      "Zoom",
      "Intro",
    ]);
    act(() => result.current.deleteViewpoint(result.current.viewpoints[0].id));
    expect(result.current.viewpoints.map((item) => item.name)).toEqual([
      "Intro",
    ]);
    expect(
      appJotaiStore.get(studioPreferencesAtom).viewpointsByBoard["local-board"],
    ).toHaveLength(1);
  });

  it("navigates back and forward through deliberate camera moves", () => {
    const { api } = makeApi();
    const { result } = renderNavigation(api);
    act(() => result.current.saveViewpoint("Intro"));
    act(() => result.current.saveViewpoint("Detail"));
    const [intro, detail] = result.current.viewpoints;
    act(() => result.current.goToViewpoint(intro.id));
    act(() => result.current.goToViewpoint(detail.id));
    expect(result.current.canGoBack).toBe(true);

    act(() => result.current.goBack());
    expect(result.current.canGoForward).toBe(true);
    act(() => result.current.goForward());
    expect(result.current.canGoForward).toBe(false);
  });

  it("uses the default viewpoint for reset view", () => {
    const { api } = makeApi();
    const { result } = renderNavigation(api);
    act(() => result.current.saveViewpoint("Home"));
    act(() =>
      result.current.setDefaultViewpoint(result.current.viewpoints[0].id),
    );
    expect(result.current.viewpoints[0].isDefault).toBe(true);
    act(() => result.current.resetView());
    expect(result.current.activeViewpointId).toBe(
      result.current.viewpoints[0].id,
    );
  });
});
