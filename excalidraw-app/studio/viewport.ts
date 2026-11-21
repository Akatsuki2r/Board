import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

/** The minimal, complete description of an Excalidraw camera. */
export type StudioViewport = Pick<AppState, "scrollX" | "scrollY" | "zoom">;

export const captureViewport = (
  api: ExcalidrawImperativeAPI,
): StudioViewport => {
  const { scrollX, scrollY, zoom } = api.getAppState();
  return { scrollX, scrollY, zoom };
};

export const restoreViewport = (
  api: ExcalidrawImperativeAPI,
  viewport: StudioViewport,
) => {
  api.updateScene({ appState: viewport });
};

const VIEWPORT_EPSILON = 0.5;

export const isSameViewport = (a: StudioViewport, b: StudioViewport) =>
  Math.abs(a.scrollX - b.scrollX) < VIEWPORT_EPSILON &&
  Math.abs(a.scrollY - b.scrollY) < VIEWPORT_EPSILON &&
  Math.abs(a.zoom.value - b.zoom.value) < 0.0001;
