import { isDarwin } from "@excalidraw/common";

/**
 * Excalidraw exposes history only through its ActionManager and keyboard
 * handling, not through the imperative API. A presentation "quick undo" asks
 * the editor to handle its own existing Ctrl/Cmd+Z action, so the studio does
 * not create a second, competing undo stack.
 */
export const dispatchEditorUndo = (view: Window | null) => {
  const doc = view?.document;
  if (!doc) {
    return;
  }
  doc.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "z",
      code: "KeyZ",
      bubbles: true,
      cancelable: true,
      ctrlKey: !isDarwin,
      metaKey: isDarwin,
    }),
  );
};
