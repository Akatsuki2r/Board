import { useCallback, useEffect, useMemo, useRef } from "react";

import { useExcalidrawStateValue } from "@excalidraw/excalidraw";

import type { StrokeWidthKey } from "@excalidraw/common";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useAtom, useAtomValue } from "../../app-jotai";
import { studioPreferencesAtom } from "../atoms";

import { dispatchEditorUndo } from "./undo";

export type StudioTool =
  | "selection"
  | "arrow"
  | "freedraw"
  | "text"
  | "rectangle"
  | "ellipse"
  | "line"
  | "eraser";

/**
 * Thin wrapper over Excalidraw's existing tool model. Annotation tools are
 * ordinary editor tools, so drawing, text WYSIWYG, snapping and undo/redo all
 * keep working exactly as they do in editing mode.
 */
export const useStudioTools = (
  excalidrawAPI: ExcalidrawImperativeAPI | null | undefined,
  appRootRef: React.RefObject<HTMLDivElement | null>,
) => {
  const activeTool = useExcalidrawStateValue("activeTool");
  const preferences = useAtomValue(studioPreferencesAtom);
  const [, setPreferences] = useAtom(studioPreferencesAtom);
  const elementCountBeforePointer = useRef(0);

  const getView = useCallback(
    () => appRootRef.current?.ownerDocument.defaultView ?? null,
    [appRootRef],
  );

  const setTool = useCallback(
    (type: StudioTool) => {
      if (type === "eraser") {
        excalidrawAPI?.setActiveTool({ type }, { toggle: true });
      } else {
        excalidrawAPI?.setActiveTool({ type });
      }
    },
    [excalidrawAPI],
  );

  const returnToNavigation = useCallback(
    () => excalidrawAPI?.setActiveTool({ type: "selection" }),
    [excalidrawAPI],
  );

  const quickUndo = useCallback(() => dispatchEditorUndo(getView()), [getView]);

  const applyAnnotationDefaults = useCallback(() => {
    excalidrawAPI?.updateScene({
      appState: {
        currentItemStrokeColor: preferences.annotation.color,
        currentItemStrokeWidthKey: preferences.annotation.strokeWidth,
      },
    });
  }, [excalidrawAPI, preferences.annotation]);

  const setAnnotationColor = useCallback(
    (color: string, persist = false) => {
      excalidrawAPI?.updateScene({
        appState: { currentItemStrokeColor: color },
      });
      if (persist) {
        setPreferences((current) => ({
          ...current,
          annotation: { ...current.annotation, color },
        }));
      }
    },
    [excalidrawAPI, setPreferences],
  );

  const setAnnotationStrokeWidth = useCallback(
    (width: StrokeWidthKey) => {
      setPreferences((current) => ({
        ...current,
        annotation: { ...current.annotation, strokeWidth: width },
      }));
    },
    [setPreferences],
  );

  const setTemporaryAnnotation = useCallback(
    (enabled: boolean) => {
      setPreferences((current) => ({
        ...current,
        annotation: { ...current.annotation, temporaryMode: enabled },
      }));
    },
    [setPreferences],
  );

  // Optional temporary mode: after drawing a single annotation, return to
  // navigation even when the presenter had locked the drawing tool.
  useEffect(() => {
    const api = excalidrawAPI;
    if (!api || !preferences.annotation.temporaryMode) {
      return;
    }
    const offDown = api.onPointerDown(() => {
      elementCountBeforePointer.current = api.getSceneElements().length;
    });
    const offUp = api.onPointerUp((activeTool) => {
      const drew =
        api.getSceneElements().length > elementCountBeforePointer.current;
      if (
        drew &&
        activeTool.type !== "selection" &&
        activeTool.type !== "eraser"
      ) {
        api.setActiveTool({ type: "selection" });
      }
    });
    return () => {
      offDown();
      offUp();
    };
  }, [excalidrawAPI, preferences.annotation.temporaryMode]);

  return useMemo(
    () => ({
      activeTool: activeTool?.type ?? "selection",
      setTool,
      returnToNavigation,
      quickUndo,
      applyAnnotationDefaults,
      setAnnotationColor,
      setAnnotationStrokeWidth,
      setTemporaryAnnotation,
      annotation: preferences.annotation,
    }),
    [
      activeTool,
      applyAnnotationDefaults,
      preferences.annotation,
      quickUndo,
      returnToNavigation,
      setAnnotationColor,
      setAnnotationStrokeWidth,
      setTemporaryAnnotation,
      setTool,
    ],
  );
};
