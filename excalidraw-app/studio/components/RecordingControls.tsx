import { useAtom } from "../../app-jotai";
import { isPresentationModeAtom } from "../atoms";
import { useStudio } from "../StudioContext";
import { formatDuration } from "../recording/useStudioRecording";

const getExtension = (mimeType: string | null) =>
  mimeType?.includes("mp4") ? "mp4" : "webm";

/** Rendered as host UI, so it is never part of the canvas-only recording. */
export const RecordingControls = () => {
  const [isPresenting] = useAtom(isPresentationModeAtom);
  const {
    status,
    elapsedMs,
    error,
    url,
    mimeType,
    start,
    pause,
    resume,
    stop,
    discard,
  } = useStudio();

  // Keep an active or completed recording reachable even if the presenter
  // leaves Presentation Mode while it is running.
  if (!isPresenting && status === "idle") {
    return null;
  }

  const isActive = status === "recording" || status === "paused";
  const hasPreview = status === "stopped" && !!url;
  const downloadName = `presentation-${new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, "-")}.${getExtension(mimeType)}`;

  return (
    <div className="studio-recording">
      {hasPreview && (
        <div className="studio-recording__preview">
          <video
            className="studio-recording__video"
            src={url ?? undefined}
            controls
            playsInline
          />
          <div className="studio-recording__preview-actions">
            <a
              className="studio-recording__download"
              href={url ?? undefined}
              download={downloadName}
            >
              Download recording
            </a>
            <button
              type="button"
              className="studio-recording__button"
              onClick={discard}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {error && (
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
        <span
          className={`studio-recording__state studio-recording__state--${status}`}
        >
          <span className="studio-recording__dot" aria-hidden="true" />
          {status === "recording"
            ? "REC"
            : status === "paused"
            ? "PAUSED"
            : status === "stopped"
            ? "DONE"
            : status === "error"
            ? "ERROR"
            : "RECORD"}
        </span>
        {isActive && (
          <span className="studio-recording__timer">
            {formatDuration(elapsedMs)}
          </span>
        )}

        {status === "idle" || status === "stopped" || status === "error" ? (
          <button
            type="button"
            className="studio-recording__button studio-recording__button--primary"
            title="Start recording"
            aria-label="Start recording"
            onClick={start}
          >
            ● Record
          </button>
        ) : (
          <>
            {status === "recording" ? (
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
      </div>
    </div>
  );
};
