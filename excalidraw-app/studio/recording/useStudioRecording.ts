import { useCallback, useEffect, useMemo, useRef } from "react";

import { useAtom, useAtomValue } from "../../app-jotai";
import { recordingStateAtom, studioPreferencesAtom } from "../atoms";

import { CanvasCompositeSource } from "./CanvasCompositeSource";
import {
  getRecordingEnvironment,
  RecordingEngine,
  type RecordingEnvironment,
  type RecordingWindow,
} from "./RecordingEngine";

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
  const [state, setState] = useAtom(recordingStateAtom);
  const engineRef = useRef<RecordingEngine | null>(null);
  const timerRef = useRef<number | null>(null);
  const viewRef = useRef<RecordingWindow | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const environmentRef = useRef<RecordingEnvironment | null>(null);

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
      // Use the cached view: refs are detached before effect cleanup runs.
      viewRef.current?.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    const view = getView();
    if (!view) {
      return;
    }
    timerRef.current = view.setInterval(() => {
      const elapsedMs = engineRef.current?.getElapsedMs() ?? 0;
      setState((previous) =>
        previous.elapsedMs === elapsedMs
          ? previous
          : { ...previous, elapsedMs },
      );
    }, 250);
  }, [getView, setState, stopTimer]);

  useEffect(
    () => () => {
      stopTimer();
      engineRef.current?.dispose();
      engineRef.current = null;
      if (previewUrlRef.current) {
        getEnvironment().revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    },
    [getEnvironment, stopTimer],
  );

  const start = useCallback(async () => {
    const environment = getEnvironment();
    const engine = new RecordingEngine(
      () =>
        new CanvasCompositeSource(
          () => getRecordingCanvases(appRootRef),
          preferences.recording.fps,
        ),
      environment,
      (message) => {
        stopTimer();
        engineRef.current?.dispose();
        engineRef.current = null;
        setState((previous) => ({
          ...previous,
          status: "error",
          error: message,
        }));
      },
    );

    if (!engine.isSupported()) {
      setState((previous) => ({
        ...previous,
        status: "error",
        error: "Video recording is not supported in this browser.",
      }));
      return;
    }

    // Never leave a live recorder or an old preview behind when restarting.
    engineRef.current?.dispose();
    engineRef.current = null;
    if (previewUrlRef.current) {
      environment.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setState({
      status: "recording",
      elapsedMs: 0,
      error: null,
      url: null,
      mimeType: null,
      durationMs: 0,
    });

    try {
      engineRef.current = engine;
      await engine.start();
      startTimer();
    } catch (error) {
      engine.dispose();
      engineRef.current = null;
      stopTimer();
      setState((previous) => ({
        ...previous,
        status: "error",
        error: getErrorMessage(error),
      }));
    }
  }, [
    appRootRef,
    getEnvironment,
    preferences.recording.fps,
    setState,
    startTimer,
    stopTimer,
  ]);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    setState((previous) =>
      previous.status === "recording"
        ? { ...previous, status: "paused" }
        : previous,
    );
  }, [setState]);

  const resume = useCallback(() => {
    engineRef.current?.resume();
    setState((previous) =>
      previous.status === "paused"
        ? { ...previous, status: "recording" }
        : previous,
    );
  }, [setState]);

  const stop = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) {
      return;
    }
    stopTimer();
    try {
      const result = await engine.stop();
      previewUrlRef.current = result.url;
      setState({
        status: "stopped",
        elapsedMs: result.durationMs,
        error: null,
        url: result.url,
        mimeType: result.mimeType,
        durationMs: result.durationMs,
      });
    } catch (error) {
      setState((previous) => ({
        ...previous,
        status: "error",
        error: getErrorMessage(error),
      }));
    } finally {
      engine.dispose();
      engineRef.current = null;
    }
  }, [setState, stopTimer]);

  const discard = useCallback(() => {
    if (previewUrlRef.current) {
      getEnvironment().revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    engineRef.current?.dispose();
    engineRef.current = null;
    stopTimer();
    setState({
      status: "idle",
      elapsedMs: 0,
      error: null,
      url: null,
      mimeType: null,
      durationMs: 0,
    });
  }, [getEnvironment, setState, stopTimer]);

  return useMemo(
    () => ({ ...state, start, pause, resume, stop, discard }),
    [discard, pause, resume, start, state, stop],
  );
};
