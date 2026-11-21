import { atom } from "../app-jotai";

import {
  createNavigationHistory,
  type NavigationHistory,
} from "./navigation/history";
import { loadStudioPreferences, saveStudioPreferences } from "./preferences";

export const isPresentationModeAtom = atom(false);

/** In-session back/forward stacks of deliberate camera moves. */
export const viewportHistoryAtom = atom<NavigationHistory>(
  createNavigationHistory(),
);

export const activeViewpointIdAtom = atom<string | null>(null);

export const viewpointOverviewOpenAtom = atom(false);

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
