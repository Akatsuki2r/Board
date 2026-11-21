import type { CanvasCompositeSource } from "./CanvasCompositeSource";
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
  };
};

const pickMimeType = (Recorder: typeof MediaRecorder): string => {
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
 */
export class RecordingEngine {
  private source: CanvasCompositeSource | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mimeType = "";
  private startedAt = 0;
  private pausedAt = 0;
  private pausedDuration = 0;

  constructor(
    private createSource: () => CanvasCompositeSource,
    private environment: RecordingEnvironment,
    private onError?: (message: string) => void,
  ) {}

  isSupported() {
    return (
      !!this.environment.MediaRecorder &&
      typeof HTMLCanvasElement.prototype.captureStream === "function"
    );
  }

  async start() {
    if (this.recorder) {
      return;
    }
    const Recorder = this.environment.MediaRecorder;
    if (!Recorder) {
      throw new Error("Video recording is not supported in this browser.");
    }

    this.mimeType = pickMimeType(Recorder);
    this.source = this.createSource();
    this.chunks = [];

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
      this.onError?.("The recording was interrupted by the browser.");
    };
    recorder.onstop = () => {
      this.source?.dispose();
      this.source = null;
    };

    recorder.start(1000);
    this.source.start();
    this.startedAt = Date.now();
    this.pausedAt = 0;
    this.pausedDuration = 0;
  }

  pause() {
    if (this.recorder?.state === "recording") {
      this.recorder.pause();
      this.source?.pause();
      this.pausedAt = Date.now();
    }
  }

  resume() {
    if (this.recorder?.state === "paused") {
      this.recorder.resume();
      this.source?.resume();
      if (this.pausedAt) {
        this.pausedDuration += Date.now() - this.pausedAt;
        this.pausedAt = 0;
      }
    }
  }

  getElapsedMs() {
    if (!this.startedAt) {
      return 0;
    }
    const end = this.pausedAt || Date.now();
    return Math.max(0, end - this.startedAt - this.pausedDuration);
  }

  async stop(): Promise<RecordingResult> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === "inactive") {
      throw new Error("There is no active recording to stop.");
    }

    const durationMs = this.getElapsedMs();
    await new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });

    const type = this.mimeType || "video/webm";
    const blob = new Blob(this.chunks, { type });
    this.recorder = null;
    this.chunks = [];
    this.startedAt = 0;

    return {
      blob,
      url: this.environment.createObjectURL(blob),
      mimeType: type,
      durationMs,
    };
  }

  dispose() {
    if (this.recorder && this.recorder.state !== "inactive") {
      try {
        this.recorder.stop();
      } catch {
        // ignore
      }
    }
    this.source?.dispose();
    this.source = null;
    this.recorder = null;
  }
}
