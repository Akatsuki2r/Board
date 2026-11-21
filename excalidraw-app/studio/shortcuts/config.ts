import { isDarwin } from "@excalidraw/common";

import type {
  KeyCombo,
  ShortcutDefinition,
  ShortcutMap,
  StudioShortcutId,
} from "./model";

export const SHORTCUT_DEFINITIONS: readonly ShortcutDefinition[] = [
  {
    id: "togglePresentation",
    label: "Enter / exit Presentation Mode",
    scope: "global",
    description: "Replaces Freedraw's P binding; X still selects Freedraw.",
  },
  {
    id: "exitPresentation",
    label: "Exit Presentation Mode",
    scope: "presentation",
  },
  { id: "zoomIn", label: "Zoom in", scope: "presentation" },
  { id: "zoomOut", label: "Zoom out", scope: "presentation" },
  {
    id: "navigateTool",
    label: "Navigation mode",
    scope: "presentation",
  },
  { id: "arrowTool", label: "Arrow annotation", scope: "presentation" },
  {
    id: "freehandTool",
    label: "Freehand annotation",
    scope: "presentation",
  },
  { id: "textTool", label: "Text annotation", scope: "presentation" },
  {
    id: "fitToContent",
    label: "Fit content to viewport",
    scope: "presentation",
  },
  {
    id: "previousViewport",
    label: "Return to previous viewpoint",
    scope: "presentation",
  },
  {
    id: "forwardViewport",
    label: "Return to next viewpoint",
    scope: "presentation",
  },
  {
    id: "previousViewpoint",
    label: "Previous saved viewpoint",
    scope: "presentation",
    description: "Yields to element nudging when something is selected.",
  },
  {
    id: "nextViewpoint",
    label: "Next saved viewpoint",
    scope: "presentation",
    description: "Yields to element nudging when something is selected.",
  },
  {
    id: "saveViewpoint",
    label: "Save current viewpoint",
    scope: "presentation",
  },
  {
    id: "goHome",
    label: "Go to default view / home viewpoint",
    scope: "presentation",
  },
  {
    id: "toggleViewpointOverview",
    label: "Toggle viewpoint overview",
    scope: "presentation",
  },
];

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  togglePresentation: { key: "p" },
  exitPresentation: { key: "Escape" },
  zoomIn: { key: "j" },
  zoomOut: { key: "k" },
  navigateTool: { key: "v" },
  arrowTool: { key: "a" },
  freehandTool: { key: "d" },
  textTool: { key: "t" },
  fitToContent: { key: "f" },
  previousViewport: { key: "Backspace" },
  forwardViewport: { key: "Backspace", shift: true },
  previousViewpoint: { key: "ArrowLeft" },
  nextViewpoint: { key: "ArrowRight" },
  saveViewpoint: { key: "m" },
  goHome: { key: "m", shift: true },
  toggleViewpointOverview: { key: "u" },
};

const createDefaults = (): ShortcutMap => ({ ...DEFAULT_SHORTCUTS });

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta"]);

const normalizeKey = (key: string | undefined): string | null => {
  if (!key || MODIFIER_KEYS.has(key)) {
    return null;
  }
  if (key === " ") {
    return "Space";
  }
  return key.length === 1 ? key.toLowerCase() : key;
};

/** Code-based aliases make letter shortcuts work on non-Latin layouts. */
const eventKeyVariants = (
  event: KeyboardEvent | React.KeyboardEvent,
): string[] => {
  const variants: string[] = [];
  const normalized = normalizeKey(event.key);
  if (normalized) {
    variants.push(normalized);
  }

  const code = event.code;
  if (/^Key[A-Z]$/.test(code)) {
    variants.push(code.slice(3).toLowerCase());
  } else if (/^Digit\d$/.test(code)) {
    variants.push(code.slice(5));
  } else if (code === "Space") {
    variants.push("Space");
  } else if (code === "Backspace" || code === "Escape") {
    variants.push(code);
  } else if (code === "BracketLeft") {
    variants.push("[");
  } else if (code === "BracketRight") {
    variants.push("]");
  }

  return Array.from(new Set(variants));
};

export const comboFromKeyboardEvent = (
  event: KeyboardEvent | React.KeyboardEvent,
): KeyCombo | null => {
  const key = normalizeKey(event.key);
  if (!key) {
    return null;
  }
  return {
    key,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  };
};

export const comboMatchesEvent = (
  combo: KeyCombo,
  event: KeyboardEvent | React.KeyboardEvent,
) =>
  !!combo.ctrl === event.ctrlKey &&
  !!combo.alt === event.altKey &&
  !!combo.shift === event.shiftKey &&
  !!combo.meta === event.metaKey &&
  eventKeyVariants(event).some(
    (variant) => variant.toLowerCase() === combo.key.toLowerCase(),
  );

const canonical = (combo: KeyCombo) =>
  [
    combo.ctrl ? "1" : "0",
    combo.alt ? "1" : "0",
    combo.shift ? "1" : "0",
    combo.meta ? "1" : "0",
    combo.key.toLowerCase(),
  ].join(":");

export const combosEqual = (a: KeyCombo, b: KeyCombo) =>
  canonical(a) === canonical(b);

export const findShortcutConflict = (
  shortcuts: ShortcutMap,
  id: StudioShortcutId,
  combo: KeyCombo,
): ShortcutDefinition | null => {
  for (const definition of SHORTCUT_DEFINITIONS) {
    if (definition.id === id) {
      continue;
    }
    const other = shortcuts[definition.id];
    if (other && combosEqual(other, combo)) {
      return definition;
    }
  }
  return null;
};

const displayKey = (key: string) =>
  key.length === 1 ? key.toUpperCase() : key;

export const formatCombo = (combo: KeyCombo): string => {
  const parts: string[] = [];
  if (combo.ctrl) {
    parts.push(isDarwin ? "⌃" : "Ctrl");
  }
  if (combo.alt) {
    parts.push(isDarwin ? "⌥" : "Alt");
  }
  if (combo.shift) {
    parts.push(isDarwin ? "⇧" : "Shift");
  }
  if (combo.meta) {
    parts.push(isDarwin ? "⌘" : "Meta");
  }
  parts.push(displayKey(combo.key));
  return parts.join("+");
};

export const validateShortcutMap = (value: unknown): ShortcutMap => {
  const result = createDefaults();
  if (typeof value !== "object" || value === null) {
    return result;
  }

  const record = value as Record<string, unknown>;
  for (const definition of SHORTCUT_DEFINITIONS) {
    if (!(definition.id in record)) {
      continue;
    }
    const raw = record[definition.id];
    if (raw === null) {
      result[definition.id] = null;
      continue;
    }
    if (typeof raw !== "object" || raw === null) {
      continue;
    }
    const candidate = raw as Record<string, unknown>;
    if (typeof candidate.key !== "string" || !candidate.key) {
      continue;
    }
    result[definition.id] = {
      key: candidate.key,
      ctrl: candidate.ctrl === true,
      alt: candidate.alt === true,
      shift: candidate.shift === true,
      meta: candidate.meta === true,
    };
  }
  return result;
};
