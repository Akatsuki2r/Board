import { useEffect } from "react";

import { isInputLike, isWritableElement } from "@excalidraw/common";

import { appJotaiStore } from "../../app-jotai";
import {
  recordingStateAtom,
  studioPreferencesAtom,
  studioSettingsOpenAtom,
} from "../atoms";
import { comboMatchesEvent } from "../shortcuts/config";

import type { StudioContextValue } from "../StudioContext";

/**
 * Space is the configured pause/resume key, but registering it as an action
 * at ActionManager's choke point would prevent Excalidraw from arming its
 * Space-pan. This listener calls preventDefault (stopping page scroll and
 * button activation) without stopping propagation, so panning still works.
 */
export const useRecordingShortcuts = (
  getStudio: () => StudioContextValue,
  appRootRef: React.RefObject<HTMLDivElement | null>,
) => {
  useEffect(() => {
    const doc = appRootRef.current?.ownerDocument;
    if (!doc) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }
      if (appJotaiStore.get(studioSettingsOpenAtom)) {
        return;
      }
      const target = event.target;
      if (
        target instanceof Element &&
        (isWritableElement(target) || isInputLike(target))
      ) {
        return;
      }
      const combo = appJotaiStore.get(studioPreferencesAtom).shortcuts
        .pauseRecording;
      if (!combo || !comboMatchesEvent(combo, event)) {
        return;
      }
      const phase = appJotaiStore.get(recordingStateAtom).phase;
      if (phase !== "recording" && phase !== "paused") {
        return;
      }
      event.preventDefault();
      if (phase === "recording") {
        getStudio().pause();
      } else {
        getStudio().resume();
      }
    };
    doc.addEventListener("keydown", onKeyDown);
    return () => doc.removeEventListener("keydown", onKeyDown);
  }, [appRootRef, getStudio]);
};
