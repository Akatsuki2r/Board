import { useCallback, useEffect, useMemo, useRef } from "react";

import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import { useAtom, useAtomValue, useSetAtom } from "../app-jotai";

import {
  isPresentationModeAtom,
  isPresentationToolbarHiddenAtom,
  presentationStartedAtAtom,
  recordingStateAtom,
  studioPreferencesAtom,
  viewportHistoryAtom,
} from "./atoms";
import { createNavigationHistory } from "./navigation/history";
import { captureViewport, type StudioViewport } from "./viewport";

export type { StudioViewport } from "./viewport";

type Options = {
  excalidrawAPI: ExcalidrawImperativeAPI | null | undefined;
  appRootRef: React.RefObject<HTMLDivElement | null>;
};

/**
 * Owns the Presentation Mode lifecycle. Nothing here mutates the scene's
 * elements: mode switching only changes UI chrome, the active tool and the
 * camera, and the pre-presentation camera is restored on exit by default.
 */
export const usePresentationMode = ({ excalidrawAPI, appRootRef }: Options) => {
  const [isPresenting, setIsPresenting] = useAtom(isPresentationModeAtom);
  const [preferences] = useAtom(studioPreferencesAtom);
  const [, setToolbarHidden] = useAtom(isPresentationToolbarHiddenAtom);
  const setViewportHistory = useSetAtom(viewportHistoryAtom);
  const setPresentationStartedAt = useSetAtom(presentationStartedAtAtom);
  const recordingPhase = useAtomValue(recordingStateAtom).phase;

  const cameraBeforePresentation = useRef<StudioViewport | null>(null);
  const toolBeforePresentation = useRef<AppState["activeTool"] | null>(null);
  const strokeBeforePresentation = useRef<{
    color: string;
    width: AppState["currentItemStrokeWidthKey"];
  } | null>(null);
  const enteredFullscreen = useRef(false);

  const enter = useCallback(() => {
    if (!excalidrawAPI || isPresenting) {
      return;
    }

    const appState = excalidrawAPI.getAppState();
    cameraBeforePresentation.current = captureViewport(excalidrawAPI);
    toolBeforePresentation.current = appState.activeTool;
    strokeBeforePresentation.current = {
      color: appState.currentItemStrokeColor,
      width: appState.currentItemStrokeWidthKey,
    };

    setToolbarHidden(!preferences.presentation.showToolbar);
    setIsPresenting(true);
    setPresentationStartedAt(Date.now());
    // A new presentation starts a fresh navigation history.
    setViewportHistory(createNavigationHistory());

    // Start from a neutral tool so navigation works immediately. Annotations
    // switch tools on demand without leaving Presentation Mode.
    excalidrawAPI.setActiveTool({ type: "selection" });
    excalidrawAPI.updateScene({
      appState: {
        currentItemStrokeColor: preferences.annotation.color,
        currentItemStrokeWidthKey: preferences.annotation.strokeWidth,
      },
    });

    if (preferences.presentation.enterFullscreen) {
      const root = appRootRef.current;
      const doc = root?.ownerDocument;
      if (root && doc && !doc.fullscreenElement) {
        // Fullscreen may be rejected (permissions, unsupported browser).
        // Presentation Mode itself is viewport-filling and still works.
        void root
          .requestFullscreen()
          .then(() => {
            enteredFullscreen.current = true;
          })
          .catch(() => {});
      }
    }
  }, [
    appRootRef,
    excalidrawAPI,
    isPresenting,
    preferences.presentation.enterFullscreen,
    preferences.presentation.showToolbar,
    preferences.annotation.color,
    preferences.annotation.strokeWidth,
    setPresentationStartedAt,
    setToolbarHidden,
    setIsPresenting,
    setViewportHistory,
  ]);

  const exit = useCallback(() => {
    if (!isPresenting) {
      return;
    }

    // Exiting Presentation Mode does not stop a recording: the recording HUD
    // remains reachable outside Presentation Mode, and the session continues.
    setIsPresenting(false);
    setToolbarHidden(false);
    setPresentationStartedAt(null);

    const previousTool = toolBeforePresentation.current;
    if (previousTool) {
      excalidrawAPI?.setActiveTool(previousTool);
    }
    const previousStroke = strokeBeforePresentation.current;
    if (previousStroke && excalidrawAPI) {
      excalidrawAPI.updateScene({
        appState: {
          currentItemStrokeColor: previousStroke.color,
          currentItemStrokeWidthKey: previousStroke.width,
        },
      });
    }

    const previousCamera = cameraBeforePresentation.current;
    if (previousCamera && preferences.presentation.restoreCameraOnExit) {
      excalidrawAPI?.updateScene({ appState: previousCamera });
    }

    const doc = appRootRef.current?.ownerDocument;
    if (doc?.fullscreenElement === appRootRef.current) {
      enteredFullscreen.current = false;
      void doc.exitFullscreen().catch(() => {});
    }
  }, [
    appRootRef,
    excalidrawAPI,
    isPresenting,
    preferences.presentation.restoreCameraOnExit,
    setPresentationStartedAt,
    setToolbarHidden,
    setIsPresenting,
  ]);

  // Warn on reload/close while a recording is active. Browsers show a generic
  // message and may ignore it; no durable crash recovery is implied.
  useEffect(() => {
    const active = ["recording", "paused", "countdown"].includes(
      recordingPhase,
    );
    if (!active) {
      return;
    }
    const view = appRootRef.current?.ownerDocument.defaultView;
    if (!view) {
      return;
    }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    view.addEventListener("beforeunload", beforeUnload);
    return () => view.removeEventListener("beforeunload", beforeUnload);
  }, [appRootRef, recordingPhase]);

  // Leaving fullscreen through browser UI (Esc/F11) should not strand the
  // presenter in a chrome-less editor with no visible exit affordance.
  useEffect(() => {
    if (!isPresenting) {
      return;
    }
    const doc = appRootRef.current?.ownerDocument;
    if (!doc) {
      return;
    }
    const onFullscreenChange = () => {
      if (doc.fullscreenElement === null && enteredFullscreen.current) {
        enteredFullscreen.current = false;
        exit();
      }
    };
    doc.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      doc.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [appRootRef, exit, isPresenting]);

  const toggle = useCallback(() => {
    if (isPresenting) {
      exit();
    } else {
      enter();
    }
  }, [enter, exit, isPresenting]);

  return useMemo(
    () => ({ isPresenting, enter, exit, toggle }),
    [enter, exit, isPresenting, toggle],
  );
};
