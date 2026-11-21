import type { NormalizedZoomValue } from "@excalidraw/excalidraw/types";

import type { StudioViewport } from "../viewport";

/**
 * Interpolates a camera the same way Excalidraw's own viewport animation does:
 * zoom blends geometrically, pan blends in screen space.
 */
export const interpolateViewport = (
  from: StudioViewport,
  to: StudioViewport,
  factor: number,
): StudioViewport => {
  if (factor >= 1) {
    return { ...to };
  }
  const zoom = (from.zoom.value *
    Math.pow(to.zoom.value / from.zoom.value, factor)) as NormalizedZoomValue;
  const panWeight =
    to.zoom.value === from.zoom.value
      ? factor
      : (zoom - from.zoom.value) / (to.zoom.value - from.zoom.value);

  return {
    scrollX:
      ((1 - panWeight) * from.scrollX * from.zoom.value +
        panWeight * to.scrollX * to.zoom.value) /
      zoom,
    scrollY:
      ((1 - panWeight) * from.scrollY * from.zoom.value +
        panWeight * to.scrollY * to.zoom.value) /
      zoom,
    zoom: { value: zoom },
  };
};

export interface CameraTransitionOptions {
  getView: () => Window | null;
  durationMs: number;
  reducedMotion: boolean;
  onFrame: (viewport: StudioViewport) => void;
  onDone?: () => void;
}

/** Cancelable camera animation owned entirely by the studio layer. */
export class CameraTransition {
  private frameId: number | null = null;
  private view: Window | null = null;

  constructor(private options: CameraTransitionOptions) {}

  animate(from: StudioViewport, to: StudioViewport) {
    this.cancel();
    const finish = () => {
      this.options.onFrame(to);
      this.options.onDone?.();
    };
    if (this.options.reducedMotion || this.options.durationMs <= 0) {
      finish();
      return;
    }

    const view = this.options.getView();
    if (!view) {
      finish();
      return;
    }
    this.view = view;
    const startedAt = view.performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / this.options.durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.options.onFrame(interpolateViewport(from, to, eased));
      if (progress < 1) {
        this.frameId = view.requestAnimationFrame(step);
      } else {
        this.frameId = null;
        this.options.onDone?.();
      }
    };
    this.frameId = view.requestAnimationFrame(step);
  }

  cancel() {
    if (this.frameId !== null) {
      this.view?.cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }
}
