import { KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";
import { actionDeleteSelected } from "@excalidraw/excalidraw/actions/actionDeleteSelected";
import { actionDeselect } from "@excalidraw/excalidraw/actions/actionDeselect";

import type { Merge } from "@excalidraw/common/utility-types";
import type { Action } from "@excalidraw/excalidraw/actions/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { appJotaiStore } from "../app-jotai";

import {
  isPresentationModeAtom,
  recordingStateAtom,
  studioPreferencesAtom,
  studioSettingsOpenAtom,
} from "./atoms";
import { comboMatchesEvent, SHORTCUT_DEFINITIONS } from "./shortcuts/config";

import type { StudioShortcutId } from "./shortcuts/model";
import type { StudioContextValue } from "./StudioContext";

/**
 * Studio shortcuts are generated from the persisted shortcut map, so changes
 * take effect without re-registering actions. `getStudio` reads the live
 * context at dispatch time, which keeps registration to a single effect even
 * though recording ticks and camera moves update the context frequently.
 *
 * `ActionName` is a closed union in core, hence the single cast at the
 * registration boundary.
 */
type StudioActionName =
  | "studioPauseRecording"
  | "studioTogglePresentation"
  | "studioExitPresentation"
  | "studioZoomIn"
  | "studioZoomOut"
  | "studioFitToContent"
  | "studioPreviousViewport"
  | "studioForwardViewport"
  | "studioPreviousViewpoint"
  | "studioNextViewpoint"
  | "studioSaveViewpoint"
  | "studioGoHome"
  | "studioToggleViewpointOverview"
  | "studioNavigateTool"
  | "studioArrowTool"
  | "studioFreehandTool"
  | "studioTextTool"
  | "studioQuickUndo"
  | "studioQuickErase"
  | "studioStartRecording"
  | "studioStopRecording"
  | "studioCancelCountdown"
  | "studioToggleRecordingControls";

type StudioAction = Merge<Action, { name: StudioActionName }>;

const ACTION_NAMES: Record<StudioShortcutId, StudioActionName> = {
  // Registered as a dedicated pan-preserving listener, not an action.
  pauseRecording: "studioPauseRecording",
  togglePresentation: "studioTogglePresentation",
  exitPresentation: "studioExitPresentation",
  zoomIn: "studioZoomIn",
  zoomOut: "studioZoomOut",
  fitToContent: "studioFitToContent",
  previousViewport: "studioPreviousViewport",
  forwardViewport: "studioForwardViewport",
  previousViewpoint: "studioPreviousViewpoint",
  nextViewpoint: "studioNextViewpoint",
  saveViewpoint: "studioSaveViewpoint",
  goHome: "studioGoHome",
  toggleViewpointOverview: "studioToggleViewpointOverview",
  navigateTool: "studioNavigateTool",
  arrowTool: "studioArrowTool",
  freehandTool: "studioFreehandTool",
  textTool: "studioTextTool",
  quickUndo: "studioQuickUndo",
  quickErase: "studioQuickErase",
  startRecording: "studioStartRecording",
  stopRecording: "studioStopRecording",
  cancelCountdown: "studioCancelCountdown",
  toggleRecordingControls: "studioToggleRecordingControls",
};

const noUpdate = { captureUpdate: CaptureUpdateAction.NEVER } as const;

const isPresenting = () => appJotaiStore.get(isPresentationModeAtom);

/** Core keyTests that must yield to studio actions while presenting. */
const coreConflicts = (action: Action): Action => ({
  ...action,
  keyTest: (event, appState, elements, app) =>
    isPresenting() && event.key === KEYS.ESCAPE && action.name === "deselect"
      ? false
      : action.keyTest?.(event, appState, elements, app) ?? false,
});

export const registerStudioActions = (
  api: ExcalidrawImperativeAPI,
  getStudio: () => StudioContextValue,
) => {
  const perform: Record<StudioShortcutId, () => void> = {
    togglePresentation: () => getStudio().toggle(),
    exitPresentation: () => getStudio().exit(),
    zoomIn: () => getStudio().zoomIn(),
    zoomOut: () => getStudio().zoomOut(),
    fitToContent: () => getStudio().fitToContent(),
    previousViewport: () => getStudio().goBack(),
    forwardViewport: () => getStudio().goForward(),
    previousViewpoint: () => getStudio().goToAdjacentViewpoint(-1),
    nextViewpoint: () => getStudio().goToAdjacentViewpoint(1),
    saveViewpoint: () => getStudio().saveViewpoint(),
    goHome: () => getStudio().resetView(),
    toggleViewpointOverview: () => getStudio().toggleViewpointOverview(),
    navigateTool: () => getStudio().returnToNavigation(),
    arrowTool: () => getStudio().setTool("arrow"),
    freehandTool: () => getStudio().setTool("freedraw"),
    textTool: () => getStudio().setTool("text"),
    quickUndo: () => getStudio().quickUndo(),
    quickErase: () => getStudio().setTool("eraser"),
    startRecording: () => getStudio().start(),
    stopRecording: () => getStudio().stop(),
    cancelCountdown: () => getStudio().cancelCountdown(),
    toggleRecordingControls: () => getStudio().toggleRecordingControls(),
    // Space is handled by a dedicated pan-preserving listener; see
    // useRecordingShortcuts. It is intentionally not registered here.
    pauseRecording: () => {},
  };

  const actions: StudioAction[] = SHORTCUT_DEFINITIONS.filter(
    (definition) => definition.id !== "pauseRecording",
  ).map((definition) => ({
    name: ACTION_NAMES[definition.id],
    label: definition.label,
    trackEvent: false,
    keyPriority: 100,
    keyTest: (event, appState) => {
      if (
        appJotaiStore.get(studioSettingsOpenAtom) ||
        appState.editingTextElement ||
        appState.openDialog
      ) {
        return false;
      }
      const combo = appJotaiStore.get(studioPreferencesAtom).shortcuts[
        definition.id
      ];
      if (!combo) {
        return false;
      }
      const recordingActive = ["recording", "paused", "countdown"].includes(
        appJotaiStore.get(recordingStateAtom).phase,
      );
      const allowed =
        definition.scope === "global" ||
        (definition.scope === "presentation" && isPresenting()) ||
        (definition.scope === "recording" && recordingActive) ||
        (definition.scope === "editing" && !isPresenting());
      if (!allowed) {
        return false;
      }
      // Arrow keys remain element-nudge shortcuts when a selection exists.
      if (
        (definition.id === "previousViewpoint" ||
          definition.id === "nextViewpoint") &&
        Object.keys(appState.selectedElementIds ?? {}).length > 0
      ) {
        return false;
      }
      // Escape exits the active layer first: countdown, then canvas layer,
      // and only then Presentation Mode itself.
      if (definition.id === "exitPresentation") {
        if (appJotaiStore.get(recordingStateAtom).phase === "countdown") {
          return false;
        }
        if (
          appState.selectedLinearElement?.isEditing ||
          appState.multiElement !== null
        ) {
          return false;
        }
      }
      return comboMatchesEvent(combo, event);
    },
    perform: () => {
      perform[definition.id]();
      return noUpdate;
    },
  }));

  actions.forEach((action) => api.registerAction(action as unknown as Action));

  // Backspace is Excalidraw's "delete selection" shortcut, and Escape is used
  // by deselect/finalize. The action manager cancels a key when two actions
  // match, so those core bindings yield while presenting. Delete still works.
  api.registerAction({
    ...actionDeleteSelected,
    keyTest: (event, appState, elements, app) =>
      isPresenting() && event.key === KEYS.BACKSPACE
        ? false
        : actionDeleteSelected.keyTest?.(event, appState, elements, app) ??
          false,
  } as Action);
  api.registerAction(coreConflicts(actionDeselect));
};
