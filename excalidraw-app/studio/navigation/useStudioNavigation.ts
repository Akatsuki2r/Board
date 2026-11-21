import { useCallback, useMemo } from "react";

import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from "@excalidraw/common";
import { getNormalizedZoom } from "@excalidraw/excalidraw/scene/normalize";

import { getViewportForZoomWithScrollConstraints } from "@excalidraw/excalidraw/viewport";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useAtom } from "../../app-jotai";
import {
  activeViewpointIdAtom,
  studioPreferencesAtom,
  viewportHistoryAtom,
} from "../atoms";

import {
  captureViewport,
  isSameViewport,
  restoreViewport,
  type StudioViewport,
} from "../viewport";

import type { SavedViewpoint } from "../preferences";

const HISTORY_LIMIT = 50;

const createId = () => Math.random().toString(36).slice(2, 10);

/**
 * Camera navigation for Presentation Mode. Every discrete jump records the
 * previous camera so Backspace can return to it; continuous panning does not
 * pollute the back stack.
 */
export const useStudioNavigation = (
  excalidrawAPI: ExcalidrawImperativeAPI | null | undefined,
) => {
  const [preferences, setPreferences] = useAtom(studioPreferencesAtom);
  const [history, setHistory] = useAtom(viewportHistoryAtom);
  const [activeViewpointId, setActiveViewpointId] = useAtom(
    activeViewpointIdAtom,
  );

  const pushHistory = useCallback(
    (viewport: StudioViewport) => {
      setHistory((previous) => {
        const last = previous[previous.length - 1];
        if (last && isSameViewport(last, viewport)) {
          return previous;
        }
        return [...previous, viewport].slice(-HISTORY_LIMIT);
      });
    },
    [setHistory],
  );

  const zoomBy = useCallback(
    (delta: number) => {
      const api = excalidrawAPI;
      if (!api) {
        return;
      }

      const appState = api.getAppState();
      const nextZoom = getNormalizedZoom(
        Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, appState.zoom.value + delta)),
      );
      if (nextZoom === appState.zoom.value) {
        return;
      }

      pushHistory(captureViewport(api));
      api.updateScene({
        appState: getViewportForZoomWithScrollConstraints(
          {
            viewportX: appState.width / 2 + appState.offsetLeft,
            viewportY: appState.height / 2 + appState.offsetTop,
            nextZoom,
          },
          appState,
        ),
      });
    },
    [excalidrawAPI, pushHistory],
  );

  const zoomIn = useCallback(() => zoomBy(ZOOM_STEP), [zoomBy]);

  const zoomOut = useCallback(() => zoomBy(-ZOOM_STEP), [zoomBy]);

  const fitToContent = useCallback(() => {
    const api = excalidrawAPI;
    if (!api) {
      return;
    }
    const elements = api.getSceneElements();
    if (!elements.length) {
      return;
    }
    pushHistory(captureViewport(api));
    api.setViewport({
      target: elements,
      fit: "scale-down",
      animation: true,
    });
    setActiveViewpointId(null);
  }, [excalidrawAPI, pushHistory, setActiveViewpointId]);

  const goBack = useCallback(() => {
    const api = excalidrawAPI;
    const previous = history[history.length - 1];
    if (!api || !previous) {
      return;
    }
    setHistory((items) => items.slice(0, -1));
    restoreViewport(api, previous);
    setActiveViewpointId(null);
  }, [excalidrawAPI, history, setActiveViewpointId, setHistory]);

  const saveViewpoint = useCallback(
    (name?: string) => {
      const api = excalidrawAPI;
      if (!api) {
        return;
      }
      const viewpoint: SavedViewpoint = {
        id: createId(),
        name: name?.trim() || `Viewpoint ${preferences.viewpoints.length + 1}`,
        viewport: captureViewport(api),
      };
      setPreferences({
        ...preferences,
        viewpoints: [...preferences.viewpoints, viewpoint],
      });
      setActiveViewpointId(viewpoint.id);
    },
    [excalidrawAPI, preferences, setActiveViewpointId, setPreferences],
  );

  const goToViewpoint = useCallback(
    (id: string) => {
      const api = excalidrawAPI;
      const viewpoint = preferences.viewpoints.find((item) => item.id === id);
      if (!api || !viewpoint) {
        return;
      }
      pushHistory(captureViewport(api));
      restoreViewport(api, viewpoint.viewport);
      setActiveViewpointId(id);
    },
    [excalidrawAPI, preferences.viewpoints, pushHistory, setActiveViewpointId],
  );

  const goToAdjacentViewpoint = useCallback(
    (direction: 1 | -1) => {
      const viewpoints = preferences.viewpoints;
      if (!viewpoints.length) {
        return;
      }
      const currentIndex = viewpoints.findIndex(
        (item) => item.id === activeViewpointId,
      );
      const nextIndex =
        direction === 1
          ? (currentIndex + 1) % viewpoints.length
          : currentIndex <= 0
          ? viewpoints.length - 1
          : currentIndex - 1;
      goToViewpoint(viewpoints[nextIndex].id);
    },
    [activeViewpointId, goToViewpoint, preferences.viewpoints],
  );

  const deleteViewpoint = useCallback(
    (id: string) => {
      setPreferences({
        ...preferences,
        viewpoints: preferences.viewpoints.filter((item) => item.id !== id),
      });
      if (activeViewpointId === id) {
        setActiveViewpointId(null);
      }
    },
    [activeViewpointId, preferences, setActiveViewpointId, setPreferences],
  );

  const renameViewpoint = useCallback(
    (id: string, name: string) => {
      setPreferences({
        ...preferences,
        viewpoints: preferences.viewpoints.map((item) =>
          item.id === id ? { ...item, name } : item,
        ),
      });
    },
    [preferences, setPreferences],
  );

  return useMemo(
    () => ({
      history,
      canGoBack: history.length > 0,
      viewpoints: preferences.viewpoints,
      activeViewpointId,
      zoomIn,
      zoomOut,
      fitToContent,
      goBack,
      saveViewpoint,
      goToViewpoint,
      goToAdjacentViewpoint,
      deleteViewpoint,
      renameViewpoint,
    }),
    [
      activeViewpointId,
      deleteViewpoint,
      fitToContent,
      goBack,
      goToAdjacentViewpoint,
      goToViewpoint,
      history,
      preferences.viewpoints,
      renameViewpoint,
      saveViewpoint,
      zoomIn,
      zoomOut,
    ],
  );
};
