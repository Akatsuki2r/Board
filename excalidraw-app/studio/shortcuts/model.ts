/** A key combination, stored in a serializable, browser-agnostic form. */
export interface KeyCombo {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export type ShortcutScope = "global" | "presentation";

export type StudioShortcutId =
  | "togglePresentation"
  | "exitPresentation"
  | "zoomIn"
  | "zoomOut"
  | "fitToContent"
  | "previousViewport"
  | "previousViewpoint"
  | "nextViewpoint"
  | "navigateTool"
  | "arrowTool"
  | "freehandTool"
  | "textTool";

/** `null` means the action has no shortcut assigned. */
export type ShortcutMap = Partial<Record<StudioShortcutId, KeyCombo | null>>;

export interface ShortcutDefinition {
  id: StudioShortcutId;
  label: string;
  scope: ShortcutScope;
  description?: string;
}
