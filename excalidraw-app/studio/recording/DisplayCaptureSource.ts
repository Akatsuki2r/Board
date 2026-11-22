import type { CaptureSource } from "./types";

export interface DisplayCaptureWindow extends Window {
  navigator: Navigator & {
    mediaDevices?: MediaDevices & {
      getDisplayMedia?: (options?: {
        video?: boolean | Record<string, unknown>;
        audio?: boolean;
      }) => Promise<MediaStream>;
    };
  };
}

export const isDisplayCaptureSupported = (
  view: DisplayCaptureWindow | null,
): boolean =>
  typeof view?.navigator?.mediaDevices?.getDisplayMedia === "function";

/**
 * Screen/window capture delegated entirely to the browser's picker. The user
 * chooses and authorizes the target; this source never records editor UI
 * selectively, so the HUD may be visible in the chosen display.
 */
export class DisplayCaptureSource implements CaptureSource {
  readonly label = "Screen / window";

  private stream: MediaStream;
  private terminated = false;
  private terminationCallbacks: Array<() => void> = [];

  constructor(private view: DisplayCaptureWindow) {
    if (!isDisplayCaptureSupported(view)) {
      throw new Error(
        "Screen/window recording is not supported in this browser.",
      );
    }
    this.stream = null as unknown as MediaStream;
  }

  async acquire() {
    try {
      this.stream = await this.view.navigator.mediaDevices!.getDisplayMedia!({
        video: true,
        audio: false,
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "NotAllowedError" || name === "AbortError") {
        throw new Error(
          "Screen capture was cancelled or permission was denied.",
        );
      }
      throw error;
    }

    const videoTrack = this.stream.getVideoTracks()[0];
    videoTrack?.addEventListener?.("ended", () => {
      if (!this.terminated) {
        this.terminated = true;
        this.terminationCallbacks.forEach((callback) => callback());
      }
    });
    return this.stream;
  }

  getStream() {
    return this.stream;
  }

  start() {
    // Picker-driven capture has no studio-side draw loop.
  }

  pause() {
    // MediaRecorder pause() handles the visual stream.
  }

  resume() {
    // MediaRecorder resume() handles the visual stream.
  }

  onTerminated(callback: () => void) {
    this.terminationCallbacks.push(callback);
  }

  dispose() {
    this.terminated = true;
    this.stream?.getTracks().forEach((track) => track.stop());
  }
}
