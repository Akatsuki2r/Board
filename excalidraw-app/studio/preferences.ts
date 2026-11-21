/**
 * Local preferences for the presentation studio.
 *
 * These are intentionally kept separate from Excalidraw's own AppState: the
 * studio is a thin layer around the editor and must not pollute the scene or
 * the editor's persisted camera state.
 */

import type { StrokeWidthKey } from "@excalidraw/common";

import { LOCAL_BOARD_KEY } from "./board";

import { DEFAULT_SHORTCUTS, validateShortcutMap } from "./shortcuts/config";

import type { ShortcutMap } from "./shortcuts/model";
import type { StudioViewport } from "./viewport";

const STORAGE_KEY = "board-studio-preferences";

export interface SavedViewpoint {
  id: string;
  name: string;
  viewport: StudioViewport;
  notes?: string;
  isDefault?: boolean;
}

export interface StudioPreferences {
  presentation: {
    /** Request fullscreen when entering Presentation Mode. */
    enterFullscreen: boolean;
    /** Show the minimal floating toolbar while presenting. */
    showToolbar: boolean;
    /** Restore the camera used before entering Presentation Mode on exit. */
    restoreCameraOnExit: boolean;
    /** Fade the floating toolbar after a period of inactivity. */
    autoHideToolbar: boolean;
    /** Show a presentation elapsed-time indicator (independent of recording). */
    showPresentationTimer: boolean;
    /** Duration of studio-driven camera transitions, in milliseconds. */
    transitionDurationMs: number;
    /** Allow animated camera transitions. */
    enableTransitions: boolean;
    /** Skip transitions when the OS requests reduced motion. */
    respectReducedMotion: boolean;
  };
  /** Named camera positions, scoped by board and persisted locally. */
  viewpointsByBoard: Record<string, SavedViewpoint[]>;
  /** Configurable keyboard shortcuts for studio actions. */
  shortcuts: ShortcutMap;
  /** Live annotation defaults applied when entering Presentation Mode. */
  annotation: {
    color: string;
    strokeWidth: StrokeWidthKey;
    /** Return to navigation after a single drawn annotation. */
    temporaryMode: boolean;
  };
  /** Recording settings. Only canvas capture is currently implemented. */
  recording: {
    fps: number;
  };
}

export const createDefaultStudioPreferences = (): StudioPreferences => ({
  presentation: {
    enterFullscreen: true,
    showToolbar: true,
    restoreCameraOnExit: true,
    autoHideToolbar: true,
    showPresentationTimer: false,
    transitionDurationMs: 250,
    enableTransitions: true,
    respectReducedMotion: true,
  },
  viewpointsByBoard: {},
  shortcuts: { ...DEFAULT_SHORTCUTS },
  annotation: {
    color: "#1e1e1e",
    strokeWidth: "medium",
    temporaryMode: false,
  },
  recording: {
    fps: 30,
  },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSavedViewpoint = (item: unknown): item is SavedViewpoint =>
  isRecord(item) &&
  typeof item.id === "string" &&
  typeof item.name === "string" &&
  isRecord(item.viewport) &&
  typeof item.viewport.scrollX === "number" &&
  typeof item.viewport.scrollY === "number" &&
  isRecord(item.viewport.zoom) &&
  typeof item.viewport.zoom.value === "number" &&
  (item.notes === undefined || typeof item.notes === "string") &&
  (item.isDefault === undefined || typeof item.isDefault === "boolean");

const parseViewpointGroups = (
  parsed: Record<string, unknown>,
): Record<string, SavedViewpoint[]> => {
  const groups: Record<string, SavedViewpoint[]> = {};
  // Migrate the pre-board-scoping storage shape.
  if (Array.isArray(parsed.viewpoints)) {
    groups[LOCAL_BOARD_KEY] = parsed.viewpoints.filter(isSavedViewpoint);
  }
  if (isRecord(parsed.viewpointsByBoard)) {
    for (const [boardKey, value] of Object.entries(parsed.viewpointsByBoard)) {
      if (Array.isArray(value)) {
        groups[boardKey] = value.filter(isSavedViewpoint);
      }
    }
  }
  return groups;
};

export const loadStudioPreferences = (): StudioPreferences => {
  const defaults = createDefaultStudioPreferences();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaults;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return defaults;
    }

    const presentation = isRecord(parsed.presentation)
      ? parsed.presentation
      : {};

    return {
      presentation: {
        enterFullscreen:
          typeof presentation.enterFullscreen === "boolean"
            ? presentation.enterFullscreen
            : defaults.presentation.enterFullscreen,
        showToolbar:
          typeof presentation.showToolbar === "boolean"
            ? presentation.showToolbar
            : defaults.presentation.showToolbar,
        restoreCameraOnExit:
          typeof presentation.restoreCameraOnExit === "boolean"
            ? presentation.restoreCameraOnExit
            : defaults.presentation.restoreCameraOnExit,
        autoHideToolbar:
          typeof presentation.autoHideToolbar === "boolean"
            ? presentation.autoHideToolbar
            : defaults.presentation.autoHideToolbar,
        showPresentationTimer:
          typeof presentation.showPresentationTimer === "boolean"
            ? presentation.showPresentationTimer
            : defaults.presentation.showPresentationTimer,
        transitionDurationMs:
          typeof presentation.transitionDurationMs === "number" &&
          presentation.transitionDurationMs >= 0 &&
          presentation.transitionDurationMs <= 2000
            ? presentation.transitionDurationMs
            : defaults.presentation.transitionDurationMs,
        enableTransitions:
          typeof presentation.enableTransitions === "boolean"
            ? presentation.enableTransitions
            : defaults.presentation.enableTransitions,
        respectReducedMotion:
          typeof presentation.respectReducedMotion === "boolean"
            ? presentation.respectReducedMotion
            : defaults.presentation.respectReducedMotion,
      },
      viewpointsByBoard: parseViewpointGroups(parsed),
      shortcuts: validateShortcutMap(parsed.shortcuts),
      annotation: {
        color:
          isRecord(parsed.annotation) &&
          typeof parsed.annotation.color === "string" &&
          /^#[0-9a-fA-F]{6}$/.test(parsed.annotation.color)
            ? parsed.annotation.color
            : defaults.annotation.color,
        strokeWidth:
          isRecord(parsed.annotation) &&
          (parsed.annotation.strokeWidth === "thin" ||
            parsed.annotation.strokeWidth === "medium" ||
            parsed.annotation.strokeWidth === "bold")
            ? parsed.annotation.strokeWidth
            : defaults.annotation.strokeWidth,
        temporaryMode:
          isRecord(parsed.annotation) &&
          typeof parsed.annotation.temporaryMode === "boolean"
            ? parsed.annotation.temporaryMode
            : defaults.annotation.temporaryMode,
      },
      recording: {
        fps:
          isRecord(parsed.recording) &&
          typeof parsed.recording.fps === "number" &&
          parsed.recording.fps >= 5 &&
          parsed.recording.fps <= 60
            ? parsed.recording.fps
            : defaults.recording.fps,
      },
    };
  } catch {
    return defaults;
  }
};

export const saveStudioPreferences = (preferences: StudioPreferences) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Private browsing / quota errors should never break the editor.
  }
};

export const resetStudioPreferences = () => {
  const defaults = createDefaultStudioPreferences();
  saveStudioPreferences(defaults);
  return defaults;
};
