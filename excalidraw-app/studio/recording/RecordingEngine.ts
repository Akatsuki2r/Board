import type { CaptureSource } from "./types";
import type { RecordingResult } from "./types";

const MIME_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];

export type RecordingWindow = Window & {
  MediaRecorder?: typeof MediaRecorder;
  URL: typeof URL;
};

/** Browser APIs are injected so the engine works in the editor's realm. */
export interface RecordingEnvironment {
  MediaRecorder?: typeof MediaRecorder;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  now: () => number;
  canvasSupportsCaptureStream: () => boolean;
}

export const getRecordingEnvironment = (
  view: RecordingWindow | null,
): RecordingEnvironment => {
  const globalRecorder =
    typeof MediaRecorder === "undefined" ? undefined : MediaRecorder;
  const urls = view?.URL ?? URL;
  return {
    MediaRecorder: view?.MediaRecorder ?? globalRecorder,
    createObjectURL: (blob) => urls.createObjectURL(blob),
    revokeObjectURL: (url) => urls.revokeObjectURL(url),
    now: () => view?.performance?.now?.() ?? performance.now(),
    canvasSupportsCaptureStream: () => {
      const ownerCanvas = view?.document?.createElement?.("canvas");
      return (
        typeof (ownerCanvas ?? HTMLCanvasElement.prototype).captureStream ===
        "function"
      );
    },
  };
};

export const pickMimeType = (Recorder: typeof MediaRecorder): string => {
  for (const candidate of MIME_CANDIDATES) {
    if (Recorder.isTypeSupported?.(candidate)) {
      return candidate;
    }
  }
  return "";
};

/**
 * Owns MediaRecorder and the capture source. Deliberately free of React and
 * editor state: viewport changes never recreate or interrupt a recording.
 * A single engine instance represents a single recording session.
 */
export class RecordingEngine {
  private source: CaptureSource | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mimeType = "";
  private startedAt = 0;
  private pausedAt = 0;
  private pausedDuration = 0;
  private lastElapsedMs = 0;
  private terminated = false;
  private disposed = false;

  constructor(
    private createSource: () => CaptureSource,
    private environment: RecordingEnvironment,
    private callbacks: {
      onError?: (message: string) => void;
      onTerminated?: () => void;
    } = {},
  ) {}

  isSupported() {
    return (
      !!this.environment.MediaRecorder &&
      this.environment.canvasSupportsCaptureStream()
    );
  }

  getCaptureMode() {
    return this.source?.label === "Screen / window" ? "screen" : "canvas";
  }

  async start() {
    if (this.recorder || this.disposed) {
      return;
    }
    const Recorder = this.environment.MediaRecorder;
    if (!Recorder) {
      throw new Error("Video recording is not supported in this browser.");
    }

    this.mimeType = pickMimeType(Recorder);
    this.source = this.createSource();
    // Display capture requires an asynchronous permission picker.
    const asyncSource = this.source as unknown as {
      acquire?: () => Promise<MediaStream>;
    };
    if (typeof asyncSource.acquire === "function") {
      await asyncSource.acquire();
    }
    this.chunks = [];
    this.terminated = false;

    const recorder = new Recorder(this.source.getStream(), {
      ...(this.mimeType ? { mimeType: this.mimeType } : {}),
    });
    this.recorder = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
    recorder.onerror = () => {
      this.callbacks.onError?.("The recording was interrupted by the browser.");
    };
    recorder.onstop = () => {
      // Keep the source alive until stop() has assembled the final chunks.
      this.lastElapsedMs = this.getElapsedMs();
    };

    // Display capture can end from the browser UI at any time.
    this.source.onTerminated?.(() => {
      if (this.disposed || this.terminated) {
        return;
      }
      this.terminated = true;
      this.callbacks.onTerminated?.();
    });

    recorder.start(1000);
    this.source.start();
    this.startedAt = this.environment.now();
    this.pausedAt = 0;
    this.pausedDuration = 0;
  }

  pause() {
    if (this.recorder?.state === "recording") {
      this.recorder.pause();
      this.source?.pause();
      this.pausedAt = this.environment.now();
    }
  }

  resume() {
    if (this.recorder?.state === "paused") {
      this.recorder.resume();
      this.source?.resume();
      if (this.pausedAt) {
        this.pausedDuration += this.environment.now() - this.pausedAt;
        this.pausedAt = 0;
      }
    }
  }

  getElapsedMs() {
    if (!this.startedAt) {
      return this.lastElapsedMs;
    }
    const end = this.pausedAt || this.environment.now();
    return Math.max(0, end - this.startedAt - this.pausedDuration);
  }

  /** Stops the recorder, waits for final data, and validates the Blob. */
  async stop(): Promise<RecordingResult> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === "inactive") {
      throw new Error("There is no active recording to stop.");
    }

    const durationMs = this.getElapsedMs();
    await new Promise<void>((resolve) => {
      // MediaRecorder sets state to "inactive" synchronously, but the final
      // `dataavailable` event arrives asynchronously before `stop`. Resolving
      // on the state change would assemble an empty Blob, so wait for `stop`.
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });

    const type = this.mimeType || "video/webm";
    const blob = new Blob(this.chunks, { type });
    const captureMode = this.getCaptureMode();
    this.releaseRecorder();

    if (blob.size === 0) {
      throw new Error("The recording produced no video data.");
    }

    return {
      blob,
      url: this.environment.createObjectURL(blob),
      mimeType: type,
      durationMs,
      captureMode,
    };
  }

  /** Returns whatever valid media exists after an interruption. */
  async salvage(): Promise<RecordingResult | null> {
    const recorder = this.recorder;
    if (!recorder) {
      return null;
    }
    try {
      await this.stop();
    } catch {
      return null;
    }
    return null;
  }

  private releaseRecorder() {
    this.recorder = null;
    this.chunks = [];
    this.startedAt = 0;
    this.pausedAt = 0;
    this.pausedDuration = 0;
    this.source?.dispose();
    this.source = null;
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    if (this.recorder && this.recorder.state !== "inactive") {
      try {
        this.recorder.stop();
      } catch {
        // ignore
      }
    }
    this.releaseRecorder();
    this.disposed = true;
  }
}
