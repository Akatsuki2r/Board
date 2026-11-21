import { useAtomValue } from "../../app-jotai";
import { studioPreferencesAtom } from "../atoms";

import { formatCombo } from "./config";

import type { StudioShortcutId } from "./model";

/** Returns the currently assigned, localized label for a studio shortcut. */
export const useShortcutHint = (id: StudioShortcutId): string => {
  const preferences = useAtomValue(studioPreferencesAtom);
  const combo = preferences.shortcuts[id];
  return combo ? formatCombo(combo) : "Unassigned";
};
