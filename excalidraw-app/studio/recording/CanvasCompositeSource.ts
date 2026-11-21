import type { CaptureSource } from "./types";

/**
 * Composites Excalidraw's live canvases into one offscreen canvas and captures
 * its stream. The DOM-based WYSIWYG text editor is intentionally not included:
 * canvas-only capture never records editor chrome.
 */
export class CanvasCompositeSource implements CaptureSource {
  readonly label = "Canvas only";

  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D | null;
  private stream: MediaStream;
  private view: Window | null;
  private frameId: number | null = null;
  private running = false;

  constructor(
    private getCanvases: () => readonly HTMLCanvasElement[],
    fps: number,
  ) {
    const [primary] = getCanvases();
    if (!primary) {
      throw new Error("The presentation canvas could not be found.");
    }

    const ownerDocument = primary.ownerDocument;
    this.view = ownerDocument.defaultView;
    this.canvas = ownerDocument.createElement("canvas");
    this.canvas.width = primary.width;
    this.canvas.height = primary.height;
    this.context = this.canvas.getContext("2d");

    if (typeof this.canvas.captureStream !== "function" || !this.view) {
      throw new Error(
        "Canvas recording is not supported in this browser (captureStream is unavailable).",
      );
    }
    this.stream = this.canvas.captureStream(fps);
  }

  getStream() {
    return this.stream;
  }

  start() {
    this.running = true;
    this.draw();
  }

  pause() {
    this.running = false;
    this.cancelFrame();
  }

  resume() {
    this.running = true;
    this.draw();
  }

  dispose() {
    this.running = false;
    this.cancelFrame();
    this.stream.getTracks().forEach((track) => track.stop());
  }

  private cancelFrame() {
    if (this.frameId !== null) {
      this.view?.cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  private draw = () => {
    if (!this.running) {
      return;
    }
    if (this.context) {
      // The editor canvas is resized on window/fullscreen/DPR changes; keep
      // the capture target in sync so frames are never stretched.
      const [primary] = this.getCanvases();
      if (
        primary &&
        (this.canvas.width !== primary.width ||
          this.canvas.height !== primary.height)
      ) {
        this.canvas.width = primary.width;
        this.canvas.height = primary.height;
      }
      const { width, height } = this.canvas;
      this.context.clearRect(0, 0, width, height);
      for (const source of this.getCanvases()) {
        if (source.width > 0 && source.height > 0) {
          this.context.drawImage(
            source,
            0,
            0,
            source.width,
            source.height,
            0,
            0,
            width,
            height,
          );
        }
      }
    }
    this.frameId = this.view?.requestAnimationFrame(this.draw) ?? null;
  };
}
