import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import React, { useEffect, useRef, useState } from "react";

import { useAtom } from "../../app-jotai";
import { studioPreferencesAtom, studioSettingsOpenAtom } from "../atoms";
import {
  comboFromKeyboardEvent,
  DEFAULT_SHORTCUTS,
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

  if (!isOpen) {
    return null;
  }

  const assign = (id: StudioShortcutId, combo: KeyCombo) => {
    const conflict = findShortcutConflict(preferences.shortcuts, id, combo);
    if (conflict) {
      setError(`Already assigned to “${conflict.label}”. Choose another key.`);
      return;
    }
    setError(null);
    setPreferences({
      ...preferences,
      shortcuts: { ...preferences.shortcuts, [id]: combo },
    });
    setListeningId(null);
  };

  const clear = (id: StudioShortcutId) => {
    setError(null);
    setListeningId(null);
    setPreferences({
      ...preferences,
      shortcuts: { ...preferences.shortcuts, [id]: null },
    });
  };

  const resetShortcuts = () => {
    setError(null);
    setListeningId(null);
    setPreferences({
      ...preferences,
      shortcuts: { ...DEFAULT_SHORTCUTS },
    });
  };

  const updatePresentation = (
    patch: Partial<typeof preferences.presentation>,
  ) => {
    setPreferences({
      ...preferences,
      presentation: { ...preferences.presentation, ...patch },
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

          <div className="studio-settings__table" role="table">
            {SHORTCUT_DEFINITIONS.map((definition) => {
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
                  </div>
                </div>
              );
            })}
          </div>
          {error && <p className="studio-settings__error">{error}</p>}
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
        </section>

        <section className="studio-settings__section">
          <h2>Recording</h2>
          <p className="studio-settings__note">
            Canvas-only capture records the presentation viewport and live
            annotations. Editor chrome and recording controls are excluded.
          </p>
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
        </section>
      </div>
    </Dialog>
  );
};
