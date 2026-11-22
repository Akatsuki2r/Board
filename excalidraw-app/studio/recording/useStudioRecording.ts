import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { appJotaiStore, useAtom, useAtomValue } from "../../app-jotai";
import {
  recordingControlsHiddenAtom,
  recordingStateAtom,
  studioPreferencesAtom,
} from "../atoms";

import { CanvasCompositeSource } from "./CanvasCompositeSource";
import {
  DisplayCaptureSource,
  isDisplayCaptureSupported,
} from "./DisplayCaptureSource";
import {
  getRecordingEnvironment,
  RecordingEngine,
  type RecordingEnvironment,
  type RecordingWindow,
} from "./RecordingEngine";
import { initialRecordingState, recordingReducer } from "./stateMachine";

import type { CaptureMode, CaptureSource } from "./types";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const getRecordingCanvases = (
  appRootRef: React.RefObject<HTMLDivElement | null>,
) => {
  const root = appRootRef.current;
  if (!root) {
    return [] as readonly HTMLCanvasElement[];
  }
  const all = Array.from(
    root.querySelectorAll<HTMLCanvasElement>("canvas.excalidraw__canvas"),
  );
  const staticCanvas = root.querySelector<HTMLCanvasElement>(
    "canvas.excalidraw__canvas.static",
  );
  const interactiveCanvas = root.querySelector<HTMLCanvasElement>(
    "canvas.excalidraw__canvas.interactive",
  );
  const ordered: HTMLCanvasElement[] = [];
  if (staticCanvas) {
    ordered.push(staticCanvas);
  }
  const inProgress = all.find(
    (canvas) => canvas !== staticCanvas && canvas !== interactiveCanvas,
  );
  if (inProgress) {
    ordered.push(inProgress);
  }
  if (interactiveCanvas) {
    ordered.push(interactiveCanvas);
  }
  return ordered;
};

export const formatDuration = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
};

export const useStudioRecording = (
  appRootRef: React.RefObject<HTMLDivElement | null>,
) => {
  const preferences = useAtomValue(studioPreferencesAtom);
  const [state, dispatch] = useReducer(recordingReducer, initialRecordingState);
  const [, setStateAtom] = useAtom(recordingStateAtom);
  const [, setControlsHidden] = useAtom(recordingControlsHiddenAtom);
  const engineRef = useRef<RecordingEngine | null>(null);
  const timerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const viewRef = useRef<RecordingWindow | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const environmentRef = useRef<RecordingEnvironment | null>(null);
  const resultRef = useRef<Awaited<ReturnType<RecordingEngine["stop"]>> | null>(
    null,
  );
  const pendingStopRef = useRef(false);
  const finishRef = useRef<() => void>(() => {});

  useEffect(() => {
    setStateAtom(state);
  }, [setStateAtom, state]);

  const getView = useCallback(() => {
    const current =
      (appRootRef.current?.ownerDocument.defaultView as RecordingWindow) ??
      null;
    if (current) {
      viewRef.current = current;
    }
    return current ?? viewRef.current;
  }, [appRootRef]);

  const getEnvironment = useCallback(() => {
    if (!environmentRef.current) {
      environmentRef.current = getRecordingEnvironment(getView());
    }
    return environmentRef.current;
  }, [getView]);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      viewRef.current?.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopCountdown = useCallback(() => {
    if (countdownRef.current !== null) {
      viewRef.current?.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      getEnvironment().revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    resultRef.current = null;
  }, [getEnvironment]);

  useEffect(
    () => () => {
      stopTimer();
      stopCountdown();
      engineRef.current?.dispose();
      engineRef.current = null;
      clearPreview();
    },
    [clearPreview, stopCountdown, stopTimer],
  );

  const beginEngine = useCallback(
    async (mode: CaptureMode) => {
      const view = getView();
      const environment = getEnvironment();
      const createSource = (): CaptureSource => {
        if (mode === "screen") {
          if (!isDisplayCaptureSupported(view as never)) {
            throw new Error(
              "Screen/window recording is not supported in this browser.",
            );
          }
          return new DisplayCaptureSource(view as never);
        }
        return new CanvasCompositeSource(
          () => getRecordingCanvases(appRootRef),
          preferences.recording.fps,
        );
      };

      const engine = new RecordingEngine(createSource, environment, {
        onError: (message) => {
          stopTimer();
          engineRef.current?.dispose();
          engineRef.current = null;
          dispatch({ type: "FAIL", error: message });
        },
        onTerminated: () => {
          // The browser's capture picker was closed; preserve valid chunks.
          void finishRef.current();
        },
      });

      if (!engine.isSupported()) {
        engine.dispose();
        throw new Error("Video recording is not supported in this browser.");
      }

      stopTimer();
      engineRef.current?.dispose();
      engineRef.current = engine;
      clearPreview();
      try {
        await engine.start();
        // A positive countdown leaves the reducer in "countdown" until the
        // engine is actually running; without this, pause/stop are rejected.
        dispatch({ type: "COUNTDOWN_DONE" });
      } catch (error) {
        engine.dispose();
        engineRef.current = null;
        stopTimer();
        throw error;
      }

      timerRef.current =
        view?.setInterval(() => {
          dispatch({ type: "ELAPSED", elapsedMs: engine.getElapsedMs() });
        }, 250) ?? null;
    },
    [
      appRootRef,
      clearPreview,
      getEnvironment,
      getView,
      preferences.recording.fps,
      stopTimer,
    ],
  );

  const finishRecording = useCallback(async () => {
    if (pendingStopRef.current) {
      return;
    }
    pendingStopRef.current = true;
    const engine = engineRef.current;
    stopTimer();
    dispatch({ type: "STOP" });
    try {
      if (!engine) {
        throw new Error("There is no active recording to stop.");
      }
      const result = await engine.stop();
      dispatch({ type: "CHUNKS_READY" });
      resultRef.current = result;
      previewUrlRef.current = result.url;
      dispatch({ type: "COMPLETE", result });
    } catch (error) {
      dispatch({ type: "FAIL", error: getErrorMessage(error) });
    } finally {
      engine?.dispose();
      engineRef.current = null;
      pendingStopRef.current = false;
    }
  }, [stopTimer]);

  const start = useCallback(
    (mode?: CaptureMode) => {
      // Never replace a live session from a shortcut or repeated click.
      const currentPhase = appJotaiStore.get(recordingStateAtom).phase;
      if (
        currentPhase === "countdown" ||
        currentPhase === "recording" ||
        currentPhase === "paused" ||
        currentPhase === "stopping" ||
        currentPhase === "processing"
      ) {
        return;
      }
      const selected = mode ?? preferences.recording.captureMode;
      const countdownMs = preferences.recording.countdownSeconds * 1000;
      stopCountdown();
      clearPreview();
      dispatch({
        type: "START",
        countdownMs,
        mode: selected,
      });

      if (countdownMs <= 0) {
        void beginEngine(selected).catch((error) =>
          dispatch({ type: "FAIL", error: getErrorMessage(error) }),
        );
        return;
      }

      const view = getView();
      const startedAt = getEnvironment().now();
      const tick = () => {
        const remaining = Math.max(
          0,
          countdownMs - (getEnvironment().now() - startedAt),
        );
        dispatch({ type: "COUNTDOWN_TICK", remainingMs: remaining });
        if (remaining <= 0) {
          stopCountdown();
          void beginEngine(selected).catch((error) =>
            dispatch({ type: "FAIL", error: getErrorMessage(error) }),
          );
        }
      };
      tick();
      countdownRef.current = view?.setInterval(tick, 100) ?? null;
    },
    [
      beginEngine,
      clearPreview,
      getEnvironment,
      getView,
      preferences.recording.captureMode,
      preferences.recording.countdownSeconds,
      stopCountdown,
    ],
  );

  const cancelCountdown = useCallback(() => {
    stopCountdown();
    dispatch({ type: "CANCEL_COUNTDOWN" });
  }, [stopCountdown]);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    dispatch({ type: "PAUSE" });
  }, []);

  const resume = useCallback(() => {
    engineRef.current?.resume();
    dispatch({ type: "RESUME" });
  }, []);

  const stop = useCallback(() => void finishRecording(), [finishRecording]);
  finishRef.current = stop;

  const toggleRecordingControls = useCallback(
    () => setControlsHidden((hidden) => !hidden),
    [setControlsHidden],
  );

  const discard = useCallback(() => {
    stopCountdown();
    stopTimer();
    engineRef.current?.dispose();
    engineRef.current = null;
    clearPreview();
    dispatch({ type: "DISCARD" });
  }, [clearPreview, stopCountdown, stopTimer]);

  return useMemo(
    () => ({
      ...state,
      result: state.result,
      start,
      cancelCountdown,
      pause,
      resume,
      stop,
      discard,
      toggleRecordingControls,
    }),
    [
      cancelCountdown,
      discard,
      pause,
      resume,
      start,
      state,
      stop,
      toggleRecordingControls,
    ],
  );
};
