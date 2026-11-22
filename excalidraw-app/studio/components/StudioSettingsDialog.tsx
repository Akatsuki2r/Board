import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import React, { useEffect, useRef, useState } from "react";

import { useAtom } from "../../app-jotai";
import { studioPreferencesAtom, studioSettingsOpenAtom } from "../atoms";
import {
  comboFromKeyboardEvent,
  DEFAULT_SHORTCUTS,
  findCoreShortcutConflict,
  findShortcutConflict,
  formatCombo,
  SHORTCUT_DEFINITIONS,
} from "../shortcuts/config";

import type { KeyCombo, StudioShortcutId } from "../shortcuts/model";

const ShortcutCaptureButton = ({
  combo,
  listening,
  onStart,
  onCapture,
}: {
  combo: KeyCombo | null | undefined;
  listening: boolean;
  onStart: () => void;
  onCapture: (combo: KeyCombo) => void;
}) => {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!listening) {
      return;
    }
    const doc = ref.current?.ownerDocument;
    if (!doc) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      // Stop the editor's global keydown handler from acting on the capture.
      event.preventDefault();
      event.stopImmediatePropagation();
      const captured = comboFromKeyboardEvent(event);
      if (captured) {
        onCapture(captured);
      }
    };
    doc.addEventListener("keydown", onKeyDown, true);
    return () => doc.removeEventListener("keydown", onKeyDown, true);
  }, [listening, onCapture]);

  return (
    <button
      ref={ref}
      type="button"
      className={`studio-settings__key${
        listening ? " studio-settings__key--listening" : ""
      }`}
      onClick={onStart}
      aria-label={listening ? "Press a key combination" : "Change shortcut"}
    >
      {listening ? "Press keys…" : combo ? formatCombo(combo) : "Unassigned"}
    </button>
  );
};

export const StudioSettingsDialog = () => {
  const [isOpen, setIsOpen] = useAtom(studioSettingsOpenAtom);
  const [preferences, setPreferences] = useAtom(studioPreferencesAtom);
  const [listeningId, setListeningId] = useState<StudioShortcutId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coreWarning, setCoreWarning] = useState<string | null>(null);
  const [shortcutQuery, setShortcutQuery] = useState("");

  if (!isOpen) {
    return null;
  }

  const assign = (id: StudioShortcutId, combo: KeyCombo) => {
    const conflict = findShortcutConflict(preferences.shortcuts, id, combo);
    if (conflict) {
      setError(`Already assigned to “${conflict.label}”. Choose another key.`);
      return;
    }
    const definition = SHORTCUT_DEFINITIONS.find((item) => item.id === id);
    const core = findCoreShortcutConflict(combo);
    if (core && definition?.scope === "global") {
      setError(`Conflicts with ${core}. Choose another key.`);
      return;
    }
    setError(null);
    setCoreWarning(
      core
        ? `${core}. This override is active only in its declared context.`
        : null,
    );
    setPreferences({
      ...preferences,
      shortcuts: { ...preferences.shortcuts, [id]: combo },
    });
    setListeningId(null);
  };

  const resetShortcut = (id: StudioShortcutId) => {
    setError(null);
    setCoreWarning(null);
    setListeningId(null);
    setPreferences({
      ...preferences,
      shortcuts: {
        ...preferences.shortcuts,
        [id]: DEFAULT_SHORTCUTS[id] ?? null,
      },
    });
  };

  const clear = (id: StudioShortcutId) => {
    setError(null);
    setCoreWarning(null);
    setListeningId(null);
    setPreferences({
      ...preferences,
      shortcuts: { ...preferences.shortcuts, [id]: null },
    });
  };

  const resetShortcuts = () => {
    setError(null);
    setCoreWarning(null);
    setListeningId(null);
    setPreferences({
      ...preferences,
      shortcuts: { ...DEFAULT_SHORTCUTS },
    });
  };

  const matchingDefinitions = SHORTCUT_DEFINITIONS.filter((definition) =>
    `${definition.label} ${definition.id}`
      .toLowerCase()
      .includes(shortcutQuery.toLowerCase()),
  );

  const updatePresentation = (
    patch: Partial<typeof preferences.presentation>,
  ) => {
    setPreferences({
      ...preferences,
      presentation: { ...preferences.presentation, ...patch },
    });
  };

  const updateAnnotation = (patch: Partial<typeof preferences.annotation>) => {
    setPreferences({
      ...preferences,
      annotation: { ...preferences.annotation, ...patch },
    });
  };

  const updateRecording = (fps: number) => {
    setPreferences({
      ...preferences,
      recording: { ...preferences.recording, fps },
    });
  };

  return (
    <Dialog
      title="Presentation Studio"
      size="regular"
      onCloseRequest={() => {
        setListeningId(null);
        setIsOpen(false);
      }}
    >
      <div className="studio-settings">
        <section className="studio-settings__section">
          <div className="studio-settings__heading">
            <h2>Keyboard shortcuts</h2>
            <button
              type="button"
              className="studio-settings__text-button"
              onClick={resetShortcuts}
            >
              Reset to defaults
            </button>
          </div>
          <p className="studio-settings__note">
            <strong>Global</strong> shortcuts work in normal editing.
            <strong> Presentation</strong> shortcuts are active only while
            presenting. Excalidraw's own shortcuts keep working outside those
            bindings; the Presentation toggle intentionally replaces Freedraw's
            P binding (X still selects Freedraw).
          </p>

          <input
            type="search"
            className="studio-settings__search"
            placeholder="Search shortcuts…"
            aria-label="Search shortcuts"
            value={shortcutQuery}
            onChange={(event) => setShortcutQuery(event.target.value)}
          />

          <div className="studio-settings__table" role="table">
            {matchingDefinitions.map((definition) => {
              const combo = preferences.shortcuts[definition.id];
              const listening = listeningId === definition.id;
              return (
                <div
                  key={definition.id}
                  className="studio-settings__row"
                  role="row"
                >
                  <div className="studio-settings__action">
                    <span>{definition.label}</span>
                    <span
                      className={`studio-settings__scope studio-settings__scope--${definition.scope}`}
                    >
                      {definition.scope}
                    </span>
                  </div>
                  <div className="studio-settings__binding">
                    <ShortcutCaptureButton
                      combo={combo}
                      listening={listening}
                      onStart={() => {
                        setError(null);
                        setListeningId(definition.id);
                      }}
                      onCapture={(captured) => assign(definition.id, captured)}
                    />
                    {listening ? (
                      <button
                        type="button"
                        className="studio-settings__text-button"
                        onClick={() => setListeningId(null)}
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="studio-settings__text-button"
                        title="Remove shortcut"
                        onClick={() => clear(definition.id)}
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      className="studio-settings__text-button"
                      title="Reset this shortcut to its default"
                      onClick={() => resetShortcut(definition.id)}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {error && <p className="studio-settings__error">{error}</p>}
          {coreWarning && (
            <p className="studio-settings__warning">{coreWarning}</p>
          )}
        </section>

        <section className="studio-settings__section">
          <h2>Presentation behavior</h2>
          <label className="studio-settings__checkbox">
            <input
              type="checkbox"
              checked={preferences.presentation.enterFullscreen}
              onChange={(event) =>
                updatePresentation({ enterFullscreen: event.target.checked })
              }
            />
            Enter fullscreen when presenting
          </label>
          <label className="studio-settings__checkbox">
            <input
              type="checkbox"
              checked={preferences.presentation.showToolbar}
              onChange={(event) =>
                updatePresentation({ showToolbar: event.target.checked })
              }
            />
            Show floating toolbar by default
          </label>
          <label className="studio-settings__checkbox">
            <input
              type="checkbox"
              checked={preferences.presentation.restoreCameraOnExit}
              onChange={(event) =>
                updatePresentation({
                  restoreCameraOnExit: event.target.checked,
                })
              }
            />
            Restore the pre-presentation camera on exit
          </label>
          <label className="studio-settings__checkbox">
            <input
              type="checkbox"
              checked={preferences.presentation.autoHideToolbar}
              onChange={(event) =>
                updatePresentation({ autoHideToolbar: event.target.checked })
              }
            />
            Fade the toolbar when idle (it returns on mouse or key activity)
          </label>
          <label className="studio-settings__checkbox">
            <input
              type="checkbox"
              checked={preferences.presentation.showPresentationTimer}
              onChange={(event) =>
                updatePresentation({
                  showPresentationTimer: event.target.checked,
                })
              }
            />
            Show a presentation timer (separate from recording time)
          </label>
          <label className="studio-settings__checkbox">
            <input
              type="checkbox"
              checked={preferences.presentation.enableTransitions}
              onChange={(event) =>
                updatePresentation({ enableTransitions: event.target.checked })
              }
            />
            Animate camera transitions between viewpoints
          </label>
          <label className="studio-settings__checkbox">
            <input
              type="checkbox"
              checked={preferences.presentation.respectReducedMotion}
              onChange={(event) =>
                updatePresentation({
                  respectReducedMotion: event.target.checked,
                })
              }
            />
            Respect the system “reduced motion” setting
          </label>
          <label className="studio-settings__select-row">
            <span>Transition duration</span>
            <span className="studio-settings__range">
              <input
                type="range"
                min={0}
                max={1000}
                step={50}
                value={preferences.presentation.transitionDurationMs}
                onChange={(event) =>
                  updatePresentation({
                    transitionDurationMs: Number(event.target.value),
                  })
                }
              />
              {preferences.presentation.transitionDurationMs} ms
            </span>
          </label>
        </section>

        <section className="studio-settings__section">
          <h2>Live annotation</h2>
          <p className="studio-settings__note">
            These defaults are applied when entering Presentation Mode and
            restored when you return to editing.
          </p>
          <label className="studio-settings__select-row">
            <span>Default annotation color</span>
            <input
              type="color"
              value={preferences.annotation.color}
              onChange={(event) =>
                updateAnnotation({ color: event.target.value })
              }
            />
          </label>
          <label className="studio-settings__select-row">
            <span>Default stroke width</span>
            <select
              value={preferences.annotation.strokeWidth}
              onChange={(event) =>
                updateAnnotation({
                  strokeWidth: event.target.value as "thin" | "medium" | "bold",
                })
              }
            >
              <option value="thin">Thin</option>
              <option value="medium">Medium</option>
              <option value="bold">Bold</option>
            </select>
          </label>
          <label className="studio-settings__checkbox">
            <input
              type="checkbox"
              checked={preferences.annotation.temporaryMode}
              onChange={(event) =>
                updateAnnotation({ temporaryMode: event.target.checked })
              }
            />
            One-shot annotation (return to navigation after each drawing)
          </label>
        </section>

        <section className="studio-settings__section">
          <h2>Recording</h2>
          <p className="studio-settings__note">
            <strong>Canvas only</strong> records the presentation viewport and
            live annotations; editor chrome and recording controls are excluded.
            <strong> Screen/window</strong> uses your browser's picker — the
            selected window, tab or screen (and anything visible in it,
            including these controls) is captured, subject to browser support.
          </p>
          <label className="studio-settings__select-row">
            <span>Default capture mode</span>
            <select
              value={preferences.recording.captureMode}
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  recording: {
                    ...preferences.recording,
                    captureMode: event.target.value as "canvas" | "screen",
                  },
                })
              }
            >
              <option value="canvas">Canvas only</option>
              <option value="screen">Screen / window</option>
            </select>
          </label>
          <label className="studio-settings__select-row">
            <span>Countdown before recording</span>
            <select
              value={preferences.recording.countdownSeconds}
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  recording: {
                    ...preferences.recording,
                    countdownSeconds: Number(event.target.value),
                  },
                })
              }
            >
              <option value={0}>None</option>
              <option value={3}>3 seconds</option>
              <option value={5}>5 seconds</option>
              <option value={10}>10 seconds</option>
            </select>
          </label>
          <label className="studio-settings__select-row">
            <span>Frame rate</span>
            <select
              value={preferences.recording.fps}
              onChange={(event) => updateRecording(Number(event.target.value))}
            >
              <option value={15}>15 fps</option>
              <option value={30}>30 fps</option>
              <option value={60}>60 fps</option>
            </select>
          </label>
          <label className="studio-settings__select-row">
            <span>Filename prefix</span>
            <input
              type="text"
              value={preferences.recording.filenamePrefix}
              maxLength={60}
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  recording: {
                    ...preferences.recording,
                    filenamePrefix: event.target.value,
                  },
                })
              }
            />
          </label>
        </section>
      </div>
    </Dialog>
  );
};
