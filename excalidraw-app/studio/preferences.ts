/**
 * Local preferences for the presentation studio.
 *
 * These are intentionally kept separate from Excalidraw's own AppState: the
 * studio is a thin layer around the editor and must not pollute the scene or
 * the editor's persisted camera state.
 */

import { DEFAULT_SHORTCUTS, validateShortcutMap } from "./shortcuts/config";

import type { ShortcutMap } from "./shortcuts/model";
import type { StudioViewport } from "./viewport";

const STORAGE_KEY = "board-studio-preferences";

export interface SavedViewpoint {
  id: string;
  name: string;
  viewport: StudioViewport;
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
  };
  /** Named camera positions, persisted locally and shared across boards. */
  viewpoints: SavedViewpoint[];
  /** Configurable keyboard shortcuts for studio actions. */
  shortcuts: ShortcutMap;
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
  },
  viewpoints: [],
  shortcuts: { ...DEFAULT_SHORTCUTS },
  recording: {
    fps: 30,
  },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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
      },
      viewpoints: Array.isArray(parsed.viewpoints)
        ? parsed.viewpoints.filter(
            (item): item is SavedViewpoint =>
              isRecord(item) &&
              typeof item.id === "string" &&
              typeof item.name === "string" &&
              isRecord(item.viewport) &&
              typeof item.viewport.scrollX === "number" &&
              typeof item.viewport.scrollY === "number" &&
              isRecord(item.viewport.zoom) &&
              typeof item.viewport.zoom.value === "number",
          )
        : [],
      shortcuts: validateShortcutMap(parsed.shortcuts),
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
