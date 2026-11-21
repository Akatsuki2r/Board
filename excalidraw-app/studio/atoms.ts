import { atom } from "../app-jotai";

import { loadStudioPreferences, saveStudioPreferences } from "./preferences";

import type { StudioViewport } from "./viewport";

export const isPresentationModeAtom = atom(false);

/** In-session back stack of discrete camera moves (not continuous panning). */
export const viewportHistoryAtom = atom<StudioViewport[]>([]);

export const activeViewpointIdAtom = atom<string | null>(null);

export const studioSettingsOpenAtom = atom(false);

/** Timestamp of the current presentation session; independent of recording. */
export const presentationStartedAtAtom = atom<number | null>(null);

export type RecordingStatus =
  | "idle"
  | "recording"
  | "paused"
  | "stopped"
  | "error";

export interface RecordingState {
  status: RecordingStatus;
  elapsedMs: number;
  error: string | null;
  url: string | null;
  mimeType: string | null;
  durationMs: number;
}

export const recordingStateAtom = atom<RecordingState>({
  status: "idle",
  elapsedMs: 0,
  error: null,
  url: null,
  mimeType: null,
  durationMs: 0,
});

/** Session-only: lets the presenter temporarily hide the floating toolbar. */
export const isPresentationToolbarHiddenAtom = atom(false);

export const studioPreferencesAtom = atom(
  loadStudioPreferences(),
  (_get, set, preferences: Parameters<typeof saveStudioPreferences>[0]) => {
    set(studioPreferencesAtom, preferences);
    saveStudioPreferences(preferences);
  },
);
