import { atom } from "../app-jotai";

import {
  createNavigationHistory,
  type NavigationHistory,
} from "./navigation/history";
import {
  loadStudioPreferences,
  saveStudioPreferences,
  type StudioPreferences,
} from "./preferences";

import {
  initialRecordingState,
  type RecordingStateData,
} from "./recording/stateMachine";

export type PreferencesUpdate =
  | StudioPreferences
  | ((previous: StudioPreferences) => StudioPreferences);

export const isPresentationModeAtom = atom(false);

/** In-session back/forward stacks of deliberate camera moves. */
export const viewportHistoryAtom = atom<NavigationHistory>(
  createNavigationHistory(),
);

export const activeViewpointIdAtom = atom<string | null>(null);

export const viewpointOverviewOpenAtom = atom(false);

/** Session-only: presenter can hide the recording HUD without stopping. */
export const recordingControlsHiddenAtom = atom(false);

export const studioSettingsOpenAtom = atom(false);

/** Timestamp of the current presentation session; independent of recording. */
export const presentationStartedAtAtom = atom<number | null>(null);

export const recordingStateAtom = atom<RecordingStateData>(
  initialRecordingState,
);

/** Session-only: lets the presenter temporarily hide the floating toolbar. */
export const isPresentationToolbarHiddenAtom = atom(false);

export const studioPreferencesAtom = atom(
  loadStudioPreferences(),
  (get, set, update: PreferencesUpdate) => {
    const preferences =
      typeof update === "function"
        ? update(get(studioPreferencesAtom))
        : update;
    set(studioPreferencesAtom, preferences);
    saveStudioPreferences(preferences);
  },
);
