import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Action } from "@excalidraw/excalidraw/actions/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import { appJotaiStore } from "../app-jotai";

import {
  isPresentationModeAtom,
  studioPreferencesAtom,
  studioSettingsOpenAtom,
} from "./atoms";
import { createDefaultStudioPreferences } from "./preferences";
import { registerStudioActions } from "./shortcuts";

import type { StudioContextValue } from "./StudioContext";

const keyEvent = (
  key: string,
  code: string,
  modifiers: Partial<
    Record<"ctrlKey" | "altKey" | "shiftKey" | "metaKey", boolean>
  > = {},
): KeyboardEvent =>
  ({
    key,
    code,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...modifiers,
  } as KeyboardEvent);

const appState = {
  editingTextElement: null,
  openDialog: null,
  selectedLinearElement: undefined,
  multiElement: null,
} as unknown as AppState;

const makeStudio = () =>
  ({
    toggle: vi.fn(),
    exit: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitToContent: vi.fn(),
    goBack: vi.fn(),
    goToAdjacentViewpoint: vi.fn(),
    returnToNavigation: vi.fn(),
    setTool: vi.fn(),
  } as unknown as StudioContextValue);

describe("registerStudioActions", () => {
  let registered: Action[];
  let api: ExcalidrawImperativeAPI;

  beforeEach(() => {
    registered = [];
    api = {
      registerAction: vi.fn((action: Action) => registered.push(action)),
    } as unknown as ExcalidrawImperativeAPI;
    appJotaiStore.set(isPresentationModeAtom, true);
    appJotaiStore.set(studioSettingsOpenAtom, false);
    appJotaiStore.set(studioPreferencesAtom, createDefaultStudioPreferences());
  });

  const find = (name: string) => {
    const action = registered.find((item) => item.name === name);
    if (!action) {
      throw new Error(`Action ${name} was not registered`);
    }
    return action;
  };

  it("registers studio actions plus the de-conflicted core bindings once", () => {
    const studio = makeStudio();
    registerStudioActions(api, () => studio);
    expect(api.registerAction).toHaveBeenCalledTimes(14);
    expect(find("studioExitPresentation")).toBeDefined();
    expect(find("deleteSelectedElements")).toBeDefined();
    expect(find("deselect")).toBeDefined();
  });

  it("dispatches Escape to exit while presenting", () => {
    const studio = makeStudio();
    registerStudioActions(api, () => studio);
    const action = find("studioExitPresentation");
    expect(
      action.keyTest?.(keyEvent("Escape", "Escape"), appState, [], {} as never),
    ).toBe(true);
    action.perform([], appState, null, {} as never);
    expect(studio.exit).toHaveBeenCalledTimes(1);
  });

  it("keeps presentation-scoped actions inactive while editing", () => {
    appJotaiStore.set(isPresentationModeAtom, false);
    const studio = makeStudio();
    registerStudioActions(api, () => studio);
    expect(
      find("studioZoomIn").keyTest?.(
        keyEvent("j", "KeyJ"),
        appState,
        [],
        {} as never,
      ),
    ).toBe(false);
    // The mode toggle is global and still works in editing mode.
    expect(
      find("studioTogglePresentation").keyTest?.(
        keyEvent("p", "KeyP"),
        appState,
        [],
        {} as never,
      ),
    ).toBe(true);
  });

  it("reads the live studio context at dispatch time", () => {
    const first = makeStudio();
    const second = makeStudio();
    let current = first;
    registerStudioActions(api, () => current);
    const action = find("studioZoomIn");
    action.perform([], appState, null, {} as never);
    expect(first.zoomIn).toHaveBeenCalledTimes(1);
    current = second;
    action.perform([], appState, null, {} as never);
    expect(second.zoomIn).toHaveBeenCalledTimes(1);
    expect(first.zoomIn).toHaveBeenCalledTimes(1);
  });

  it("suppresses studio shortcuts while settings are open or text is being edited", () => {
    const studio = makeStudio();
    registerStudioActions(api, () => studio);
    const action = find("studioZoomIn");
    appJotaiStore.set(studioSettingsOpenAtom, true);
    expect(
      action.keyTest?.(keyEvent("j", "KeyJ"), appState, [], {} as never),
    ).toBe(false);
    appJotaiStore.set(studioSettingsOpenAtom, false);
    expect(
      action.keyTest?.(
        keyEvent("j", "KeyJ"),
        {
          ...appState,
          editingTextElement: {},
        } as AppState,
        [],
        {} as never,
      ),
    ).toBe(false);
  });
});
