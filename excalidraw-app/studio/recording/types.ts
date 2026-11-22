/**
 * A capture source produces the MediaStream fed to MediaRecorder. Canvas-only
 * capture is the initial implementation; a full-window source can be added by
 * implementing this interface without changing RecordingEngine.
 */
export interface CaptureSource {
  readonly label: string;
  getStream(): MediaStream;
  start(): void;
  pause(): void;
  resume(): void;
  dispose(): void;
  /** Optional hook for sources whose stream can end independently (display capture). */
  onTerminated?(callback: () => void): void;
}

export type CaptureMode = "canvas" | "screen";

export interface RecordingResult {
  blob: Blob;
  url: string;
  mimeType: string;
  durationMs: number;
  captureMode: CaptureMode;
}
