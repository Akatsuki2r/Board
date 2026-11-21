/** A key combination, stored in a serializable, browser-agnostic form. */
export interface KeyCombo {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

/** Context in which a shortcut is allowed to dispatch. */
export type ShortcutScope = "global" | "editing" | "presentation" | "recording";

export type StudioShortcutId =
  | "togglePresentation"
  | "exitPresentation"
  | "zoomIn"
  | "zoomOut"
  | "fitToContent"
  | "previousViewport"
  | "forwardViewport"
  | "previousViewpoint"
  | "nextViewpoint"
  | "saveViewpoint"
  | "goHome"
  | "toggleViewpointOverview"
  | "navigateTool"
  | "arrowTool"
  | "freehandTool"
  | "textTool"
  | "quickUndo"
  | "quickErase";

/** `null` means the action has no shortcut assigned. */
export type ShortcutMap = Partial<Record<StudioShortcutId, KeyCombo | null>>;

export interface ShortcutDefinition {
  id: StudioShortcutId;
  label: string;
  scope: ShortcutScope;
  description?: string;
}
