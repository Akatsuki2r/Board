import { useCallback, useEffect, useMemo, useRef } from "react";

import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from "@excalidraw/common";
import { getNormalizedZoom } from "@excalidraw/excalidraw/scene/normalize";

import { getViewportForZoomWithScrollConstraints } from "@excalidraw/excalidraw/viewport";

import type { AnimationOptions } from "@excalidraw/excalidraw/viewport";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useAtom } from "../../app-jotai";
import { getBoardKey } from "../board";
import {
  activeViewpointIdAtom,
  studioPreferencesAtom,
  viewpointOverviewOpenAtom,
  viewportHistoryAtom,
} from "../atoms";

import {
  captureViewport,
  restoreViewport,
  type StudioViewport,
} from "../viewport";

import { CameraTransition } from "./cameraTransition";
import { goBackInHistory, goForwardInHistory, pushViewport } from "./history";

import type { SavedViewpoint } from "../preferences";

const createId = () => Math.random().toString(36).slice(2, 10);

/**
 * Camera navigation for Presentation Mode: zoom, fit, a meaningful back /
 * forward history, and board-scoped saved viewpoints forming a lightweight
 * presentation sequence.
 */
export const useStudioNavigation = (
  excalidrawAPI: ExcalidrawImperativeAPI | null | undefined,
  appRootRef: React.RefObject<HTMLDivElement | null>,
) => {
  const [preferences, setPreferences] = useAtom(studioPreferencesAtom);
  const [history, setHistory] = useAtom(viewportHistoryAtom);
  const [activeViewpointId, setActiveViewpointId] = useAtom(
    activeViewpointIdAtom,
  );
  const [, setOverviewOpen] = useAtom(viewpointOverviewOpenAtom);
  const transitionRef = useRef<CameraTransition | null>(null);

  const boardKey = getBoardKey(
    appRootRef.current?.ownerDocument.defaultView ?? null,
  );
  const viewpoints = useMemo(
    () => preferences.viewpointsByBoard[boardKey] ?? [],
    [boardKey, preferences.viewpointsByBoard],
  );

  useEffect(
    () => () => {
      transitionRef.current?.cancel();
      transitionRef.current = null;
    },
    [],
  );

  const getView = useCallback(
    () => appRootRef.current?.ownerDocument.defaultView ?? null,
    [appRootRef],
  );

  const prefersReducedMotion = useCallback(
    () =>
      preferences.presentation.respectReducedMotion &&
      !!getView()?.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [getView, preferences.presentation.respectReducedMotion],
  );

  const cancelTransition = useCallback(() => {
    transitionRef.current?.cancel();
    transitionRef.current = null;
  }, []);

  const setViewpoints = useCallback(
    (next: SavedViewpoint[]) => {
      setPreferences({
        ...preferences,
        viewpointsByBoard: {
          ...preferences.viewpointsByBoard,
          [boardKey]: next,
        },
      });
    },
    [boardKey, preferences, setPreferences],
  );

  const moveCamera = useCallback(
    (target: StudioViewport) => {
      const api = excalidrawAPI;
      if (!api) {
        return;
      }
      cancelTransition();
      if (
        !preferences.presentation.enableTransitions ||
        prefersReducedMotion()
      ) {
        restoreViewport(api, target);
        return;
      }
      const transition = new CameraTransition({
        getView,
        durationMs: preferences.presentation.transitionDurationMs,
        reducedMotion: false,
        onFrame: (viewport) => restoreViewport(api, viewport),
      });
      transitionRef.current = transition;
      transition.animate(captureViewport(api), target);
    },
    [
      cancelTransition,
      excalidrawAPI,
      getView,
      preferences.presentation.enableTransitions,
      preferences.presentation.transitionDurationMs,
      prefersReducedMotion,
    ],
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
      cancelTransition();
      setHistory((current) => pushViewport(current, captureViewport(api)));
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
      setActiveViewpointId(null);
    },
    [cancelTransition, excalidrawAPI, setActiveViewpointId, setHistory],
  );

  const zoomIn = useCallback(() => zoomBy(ZOOM_STEP), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(-ZOOM_STEP), [zoomBy]);

  const fitAnimation = useMemo<AnimationOptions | false>(
    () =>
      preferences.presentation.enableTransitions && !prefersReducedMotion()
        ? { duration: preferences.presentation.transitionDurationMs }
        : false,
    [
      preferences.presentation.enableTransitions,
      preferences.presentation.transitionDurationMs,
      prefersReducedMotion,
    ],
  );

  const fitToContent = useCallback(() => {
    const api = excalidrawAPI;
    if (!api) {
      return;
    }
    const elements = api.getSceneElements();
    if (!elements.length) {
      return;
    }
    cancelTransition();
    setHistory((current) => pushViewport(current, captureViewport(api)));
    api.setViewport({
      target: elements,
      fit: "scale-down",
      animation: fitAnimation,
    });
    setActiveViewpointId(null);
  }, [
    cancelTransition,
    excalidrawAPI,
    fitAnimation,
    setActiveViewpointId,
    setHistory,
  ]);

  const goBack = useCallback(() => {
    const api = excalidrawAPI;
    if (!api) {
      return;
    }
    const result = goBackInHistory(history, captureViewport(api));
    if (!result.viewport) {
      return;
    }
    setHistory(result.history);
    moveCamera(result.viewport);
    setActiveViewpointId(null);
  }, [excalidrawAPI, history, moveCamera, setActiveViewpointId, setHistory]);

  const goForward = useCallback(() => {
    const api = excalidrawAPI;
    if (!api) {
      return;
    }
    const result = goForwardInHistory(history, captureViewport(api));
    if (!result.viewport) {
      return;
    }
    setHistory(result.history);
    moveCamera(result.viewport);
    setActiveViewpointId(null);
  }, [excalidrawAPI, history, moveCamera, setActiveViewpointId, setHistory]);

  const buildViewpoint = useCallback(
    (name?: string): SavedViewpoint => {
      const used = new Set(viewpoints.map((item) => item.name));
      const base = name?.trim() || `Viewpoint ${viewpoints.length + 1}`;
      let candidate = base;
      let index = 2;
      while (used.has(candidate)) {
        candidate = `${base} ${index++}`;
      }
      return {
        id: createId(),
        name: candidate,
        viewport: captureViewport(excalidrawAPI!),
      };
    },
    [excalidrawAPI, viewpoints],
  );

  const saveViewpoint = useCallback(
    (name?: string) => {
      if (!excalidrawAPI) {
        return;
      }
      const viewpoint = buildViewpoint(name);
      setViewpoints([...viewpoints, viewpoint]);
      setActiveViewpointId(viewpoint.id);
    },
    [
      buildViewpoint,
      excalidrawAPI,
      setActiveViewpointId,
      setViewpoints,
      viewpoints,
    ],
  );

  const goToViewpoint = useCallback(
    (id: string) => {
      const api = excalidrawAPI;
      const viewpoint = viewpoints.find((item) => item.id === id);
      if (!api || !viewpoint) {
        return;
      }
      setHistory((current) => pushViewport(current, captureViewport(api)));
      moveCamera(viewpoint.viewport);
      setActiveViewpointId(id);
    },
    [excalidrawAPI, moveCamera, setActiveViewpointId, setHistory, viewpoints],
  );

  const goToAdjacentViewpoint = useCallback(
    (direction: 1 | -1) => {
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
    [activeViewpointId, goToViewpoint, viewpoints],
  );

  const deleteViewpoint = useCallback(
    (id: string) => {
      setViewpoints(viewpoints.filter((item) => item.id !== id));
      if (activeViewpointId === id) {
        setActiveViewpointId(null);
      }
    },
    [activeViewpointId, setActiveViewpointId, setViewpoints, viewpoints],
  );

  const renameViewpoint = useCallback(
    (id: string, name: string) => {
      setViewpoints(
        viewpoints.map((item) =>
          item.id === id ? { ...item, name: name.trim() || item.name } : item,
        ),
      );
    },
    [setViewpoints, viewpoints],
  );

  const setViewpointNotes = useCallback(
    (id: string, notes: string) => {
      setViewpoints(
        viewpoints.map((item) => (item.id === id ? { ...item, notes } : item)),
      );
    },
    [setViewpoints, viewpoints],
  );

  const moveViewpoint = useCallback(
    (id: string, direction: 1 | -1) => {
      const index = viewpoints.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= viewpoints.length) {
        return;
      }
      const reordered = [...viewpoints];
      [reordered[index], reordered[target]] = [
        reordered[target],
        reordered[index],
      ];
      setViewpoints(reordered);
    },
    [setViewpoints, viewpoints],
  );

  const setDefaultViewpoint = useCallback(
    (id: string) => {
      setViewpoints(
        viewpoints.map((item) => ({ ...item, isDefault: item.id === id })),
      );
    },
    [setViewpoints, viewpoints],
  );

  const resetView = useCallback(() => {
    const api = excalidrawAPI;
    if (!api) {
      return;
    }
    const home = viewpoints.find((item) => item.isDefault);
    if (home) {
      goToViewpoint(home.id);
      return;
    }
    const elements = api.getSceneElements();
    if (elements.length) {
      fitToContent();
      return;
    }
    cancelTransition();
    setHistory((current) => pushViewport(current, captureViewport(api)));
    restoreViewport(api, {
      scrollX: 0,
      scrollY: 0,
      zoom: { value: getNormalizedZoom(1) },
    });
    setActiveViewpointId(null);
  }, [
    cancelTransition,
    excalidrawAPI,
    fitToContent,
    goToViewpoint,
    setActiveViewpointId,
    setHistory,
    viewpoints,
  ]);

  const toggleViewpointOverview = useCallback(
    () => setOverviewOpen((open) => !open),
    [setOverviewOpen],
  );

  return useMemo(
    () => ({
      history,
      canGoBack: history.past.length > 0,
      canGoForward: history.future.length > 0,
      boardKey,
      viewpoints,
      activeViewpointId,
      zoomIn,
      zoomOut,
      fitToContent,
      goBack,
      goForward,
      resetView,
      saveViewpoint,
      goToViewpoint,
      goToAdjacentViewpoint,
      deleteViewpoint,
      renameViewpoint,
      setViewpointNotes,
      moveViewpoint,
      setDefaultViewpoint,
      toggleViewpointOverview,
    }),
    [
      activeViewpointId,
      boardKey,
      deleteViewpoint,
      fitToContent,
      goBack,
      goForward,
      goToAdjacentViewpoint,
      goToViewpoint,
      history,
      moveViewpoint,
      renameViewpoint,
      resetView,
      saveViewpoint,
      setDefaultViewpoint,
      setViewpointNotes,
      toggleViewpointOverview,
      viewpoints,
      zoomIn,
      zoomOut,
    ],
  );
};
