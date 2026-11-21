import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { appJotaiStore, Provider } from "../../app-jotai";
import { studioPreferencesAtom } from "../atoms";
import { createDefaultStudioPreferences } from "../preferences";

import { useStudioTools } from "./useStudioTools";

vi.mock("@excalidraw/excalidraw", () => ({
  useExcalidrawStateValue: () => ({ type: "selection" }),
}));

const dispatch = vi.fn();
const appRootRef = {
  current: {
    ownerDocument: { defaultView: { document: { dispatchEvent: dispatch } } },
  },
} as unknown as React.RefObject<HTMLDivElement>;

const makeApi = () => {
  let elements: unknown[] = [];
  let onDown: (() => void) | null = null;
  let onUp: ((tool: { type: string }) => void) | null = null;
  const api = {
    setActiveTool: vi.fn(),
    updateScene: vi.fn(),
    onPointerDown: vi.fn((cb: () => void) => {
      onDown = cb;
      return vi.fn();
    }),
    onPointerUp: vi.fn((cb: (tool: { type: string }) => void) => {
      onUp = cb;
      return vi.fn();
    }),
    getSceneElements: () => elements,
    addElement: () => {
      elements = [...elements, { id: "new" }];
    },
    fireDown: () => onDown?.(),
    fireUp: (tool: { type: string }) => onUp?.(tool),
  };
  return api;
};

const renderTools = (api: ReturnType<typeof makeApi>) =>
  renderHook(
    () => useStudioTools(api as unknown as ExcalidrawImperativeAPI, appRootRef),
    {
      wrapper: ({ children }) => (
        <Provider store={appJotaiStore}>{children}</Provider>
      ),
    },
  );

describe("useStudioTools", () => {
  beforeEach(() => {
    dispatch.mockClear();
    appJotaiStore.set(studioPreferencesAtom, createDefaultStudioPreferences());
  });

  it("toggles the eraser and dispatches quick undo to the editor", () => {
    const api = makeApi();
    const { result } = renderTools(api);
    act(() => result.current.setTool("eraser"));
    expect(api.setActiveTool).toHaveBeenCalledWith(
      { type: "eraser" },
      { toggle: true },
    );
    act(() => result.current.quickUndo());
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("persists a chosen annotation color when requested", () => {
    const api = makeApi();
    const { result } = renderTools(api);
    act(() => result.current.setAnnotationColor("#e03131", true));
    expect(api.updateScene).toHaveBeenCalledWith({
      appState: { currentItemStrokeColor: "#e03131" },
    });
    expect(appJotaiStore.get(studioPreferencesAtom).annotation.color).toBe(
      "#e03131",
    );
  });

  it("returns to navigation after a one-shot annotation", () => {
    const preferences = createDefaultStudioPreferences();
    preferences.annotation.temporaryMode = true;
    appJotaiStore.set(studioPreferencesAtom, preferences);
    const api = makeApi();
    renderTools(api);
    act(() => api.fireDown());
    act(() => {
      api.addElement();
      api.fireUp({ type: "freedraw" });
    });
    expect(api.setActiveTool).toHaveBeenCalledWith({ type: "selection" });
  });
});
