import { useCallback, useMemo } from "react";

import { useExcalidrawStateValue } from "@excalidraw/excalidraw";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

export type StudioTool =
  | "selection"
  | "arrow"
  | "freedraw"
  | "text"
  | "rectangle"
  | "ellipse"
  | "line";

/**
 * Thin wrapper over Excalidraw's existing tool model. Annotation tools are
 * ordinary editor tools, so drawing, text WYSIWYG, snapping and undo/redo all
 * keep working exactly as they do in editing mode.
 */
export const useStudioTools = (
  excalidrawAPI: ExcalidrawImperativeAPI | null | undefined,
) => {
  const activeTool = useExcalidrawStateValue("activeTool");

  const setTool = useCallback(
    (type: StudioTool) => {
      excalidrawAPI?.setActiveTool({ type });
    },
    [excalidrawAPI],
  );

  const returnToNavigation = useCallback(
    () => excalidrawAPI?.setActiveTool({ type: "selection" }),
    [excalidrawAPI],
  );

  return useMemo(
    () => ({
      activeTool: activeTool?.type ?? "selection",
      setTool,
      returnToNavigation,
    }),
    [activeTool, returnToNavigation, setTool],
  );
};
