import { useEffect, useRef, useState } from "react";

import { useAtom } from "../../app-jotai";
import {
  isPresentationModeAtom,
  recordingControlsHiddenAtom,
  studioPreferencesAtom,
} from "../atoms";
import { useStudio } from "../StudioContext";
import { formatDuration } from "../recording/useStudioRecording";

import type { CaptureMode } from "../recording/types";

const getExtension = (mimeType: string | null) =>
  mimeType?.includes("mp4") ? "mp4" : "webm";

const statusLabel: Record<string, string> = {
  idle: "RECORD",
  countdown: "GET READY",
  recording: "REC",
  paused: "PAUSED",
  stopping: "SAVING",
  processing: "PROCESSING",
  ready: "DONE",
  failed: "ERROR",
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const CountdownOverlay = () => {
  const { phase, countdownRemainingMs, countdownTotalMs, cancelCountdown } =
    useStudio();
  if (phase !== "countdown") {
    return null;
  }
  const seconds = Math.ceil(countdownRemainingMs / 1000);
  const progress = countdownTotalMs
    ? 1 - countdownRemainingMs / countdownTotalMs
    : 0;
  return (
    <div className="studio-countdown" role="status" aria-live="assertive">
      <span className="studio-countdown__number">{seconds}</span>
      <span className="studio-countdown__label">Recording starts in…</span>
      <span className="studio-countdown__track">
        <span style={{ width: `${progress * 100}%` }} />
      </span>
      <button
        type="button"
        className="studio-countdown__cancel"
        onClick={cancelCountdown}
      >
        Cancel
      </button>
    </div>
  );
};

/** Rendered as host UI, so it is never part of canvas-only recording. */
export const RecordingControls = () => {
  const [isPresenting] = useAtom(isPresentationModeAtom);
  const [controlsHidden, setControlsHidden] = useAtom(
    recordingControlsHiddenAtom,
  );
  const {
    phase,
    elapsedMs,
    countdownRemainingMs,
    error,
    result,
    captureMode,
    start,
    pause,
    resume,
    stop,
    discard,
    cancelCountdown,
    enter,
  } = useStudio();
  const [mode, setMode] = useState<CaptureMode>(captureMode);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [returning, setReturning] = useState(false);
  const [confirmNewRecording, setConfirmNewRecording] = useState(false);
  const [previewHidden, setPreviewHidden] = useState(false);
  const [preferences] = useAtom(studioPreferencesAtom);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMode(captureMode), [captureMode]);
  useEffect(() => {
    if (phase !== "ready") {
      setPreviewHidden(false);
      setConfirmNewRecording(false);
    }
  }, [phase]);

  if (!isPresenting && phase === "idle") {
    return null;
  }

  const isActive = phase === "recording" || phase === "paused";
  const isBusy =
    phase === "countdown" || phase === "stopping" || phase === "processing";
  const hasPreview = phase === "ready" && !!result && !previewHidden;
  const hasResult = phase === "ready" && !!result;
  const downloadName = `${preferences.recording.filenamePrefix}-${new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, "-")}.${getExtension(result?.mimeType ?? null)}`;

  const activeModes: CaptureMode[] = ["canvas", "screen"];

  if (controlsHidden && !hasPreview && phase !== "failed") {
    return (
      <button
        type="button"
        className="studio-recording-reveal"
        title="Show recording controls (O)"
        aria-label="Show recording controls"
        onClick={() => setControlsHidden(false)}
      >
        ● {isActive ? "REC" : "RECORD"}
      </button>
    );
  }

  return (
    <div ref={rootRef} className="studio-recording">
      {hasPreview && (
        <div
          className="studio-recording__preview"
          role="dialog"
          aria-label="Recording ready"
        >
          <div className="studio-recording__preview-header">
            <strong>Recording ready</strong>
            <span>
              {formatDuration(result!.durationMs)} ·{" "}
              {formatBytes(result!.blob.size)} ·{" "}
              {result!.captureMode === "screen"
                ? "Screen/window"
                : "Canvas only"}
            </span>
          </div>
          <video
            className="studio-recording__video"
            src={result!.url}
            controls
            playsInline
          />
          <div className="studio-recording__preview-actions">
            <a
              className="studio-recording__download"
              href={result!.url}
              download={downloadName}
            >
              Download recording
            </a>
            <button
              type="button"
              className="studio-recording__button"
              onClick={() => setReturning(true)}
            >
              Return to presentation
            </button>
            <button
              type="button"
              className="studio-recording__button"
              onClick={() => setConfirmDiscard(true)}
            >
              Discard
            </button>
          </div>
          {(confirmDiscard || returning) && (
            <div className="studio-recording__confirm" role="alertdialog">
              <p>
                {confirmDiscard
                  ? "Discard this recording? The video will be permanently lost."
                  : "Return to the presentation? The recording stays available here until you export or discard it."}
              </p>
              <div>
                <button
                  type="button"
                  className="studio-recording__button"
                  onClick={() => {
                    setConfirmDiscard(false);
                    setReturning(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="studio-recording__button studio-recording__button--stop"
                  onClick={() => {
                    if (confirmDiscard) {
                      discard();
                    } else {
                      // Close only the preview; the result remains exportable.
                      setPreviewHidden(true);
                      if (!isPresenting) {
                        enter();
                      }
                    }
                    setConfirmDiscard(false);
                    setReturning(false);
                  }}
                >
                  {confirmDiscard ? "Discard" : "Return"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === "failed" && (
        <div className="studio-recording__error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="studio-recording__button"
            onClick={discard}
          >
            Dismiss
          </button>
        </div>
      )}

      <div
        className="studio-recording__bar"
        role="toolbar"
        aria-label="Recording controls"
      >
        <button
          type="button"
          className="studio-recording__hide"
          title="Hide recording controls (O)"
          aria-label="Hide recording controls"
          onClick={() => setControlsHidden(true)}
        >
          ⋯
        </button>
        <span
          className={`studio-recording__state studio-recording__state--${phase}`}
        >
          <span className="studio-recording__dot" aria-hidden="true" />
          {statusLabel[phase]}
        </span>
        {(isActive || isBusy) && (
          <span className="studio-recording__timer">
            {phase === "countdown"
              ? `${Math.ceil(countdownRemainingMs / 1000)}s`
              : formatDuration(elapsedMs)}
          </span>
        )}

        {(phase === "idle" || phase === "ready" || phase === "failed") && (
          <>
            <span
              className="studio-recording__modes"
              role="group"
              aria-label="Capture mode"
            >
              {activeModes.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`studio-recording__mode${
                    mode === item ? " studio-recording__mode--active" : ""
                  }`}
                  title={
                    item === "canvas"
                      ? "Record only the presentation canvas"
                      : "Record a window, tab or screen chosen in the browser picker"
                  }
                  aria-pressed={mode === item}
                  onClick={() => setMode(item)}
                >
                  {item === "canvas" ? "Canvas" : "Screen"}
                </button>
              ))}
            </span>
            {hasResult && previewHidden && (
              <button
                type="button"
                className="studio-recording__button"
                title="Show the completed recording"
                aria-label="Show completed recording"
                onClick={() => setPreviewHidden(false)}
              >
                Preview
              </button>
            )}
            <button
              type="button"
              className="studio-recording__button studio-recording__button--primary"
              title="Start recording"
              aria-label="Start recording"
              onClick={() => {
                if (hasResult) {
                  setConfirmNewRecording(true);
                } else {
                  start(mode);
                }
              }}
            >
              ● Record
            </button>
          </>
        )}

        {isActive && (
          <>
            {phase === "recording" ? (
              <button
                type="button"
                className="studio-recording__button"
                title="Pause recording"
                aria-label="Pause recording"
                onClick={pause}
              >
                ❚❚
              </button>
            ) : (
              <button
                type="button"
                className="studio-recording__button"
                title="Resume recording"
                aria-label="Resume recording"
                onClick={resume}
              >
                ▶
              </button>
            )}
            <button
              type="button"
              className="studio-recording__button studio-recording__button--stop"
              title="Stop recording"
              aria-label="Stop recording"
              onClick={stop}
            >
              ■ Stop
            </button>
          </>
        )}
        {phase === "countdown" && (
          <button
            type="button"
            className="studio-recording__button"
            onClick={cancelCountdown}
          >
            Cancel
          </button>
        )}
      </div>

      {confirmNewRecording && (
        <div className="studio-recording__confirm" role="alertdialog">
          <p>
            Starting a new recording will discard the current unsaved video.
            Download it first if you want to keep it.
          </p>
          <div>
            <button
              type="button"
              className="studio-recording__button"
              onClick={() => setConfirmNewRecording(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="studio-recording__button studio-recording__button--stop"
              onClick={() => {
                setConfirmNewRecording(false);
                start(mode);
              }}
            >
              Discard & record
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
