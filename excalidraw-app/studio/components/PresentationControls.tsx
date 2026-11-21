import {
  useExcalidrawAPI,
  useExcalidrawStateValue,
} from "@excalidraw/excalidraw";
import { useEffect, useRef, useState } from "react";

import { useAtom } from "../../app-jotai";
import { useStudio } from "../StudioContext";
import {
  activeViewpointIdAtom,
  isPresentationModeAtom,
  isPresentationToolbarHiddenAtom,
  studioPreferencesAtom,
} from "../atoms";

import { ViewpointOverview } from "./ViewpointOverview";

import type { StudioTool } from "../tools/useStudioTools";

const TOOL_BUTTONS: {
  type: StudioTool;
  glyph: string;
  label: string;
  shortcut: string;
}[] = [
  { type: "selection", glyph: "↖", label: "Navigate", shortcut: "V" },
  { type: "arrow", glyph: "→", label: "Arrow", shortcut: "A" },
  { type: "freedraw", glyph: "✎", label: "Freehand", shortcut: "D" },
  { type: "text", glyph: "T", label: "Text", shortcut: "T" },
  { type: "rectangle", glyph: "□", label: "Rectangle", shortcut: "R" },
  { type: "ellipse", glyph: "○", label: "Ellipse", shortcut: "O" },
];

const IDLE_DELAY_MS = 4000;

/**
 * Host UI rendered through Excalidraw's tunnel. Because it lives in the DOM
 * (not on a canvas), it is automatically excluded from canvas-only recording.
 */
export const PresentationControls = () => {
  const [isPresenting] = useAtom(isPresentationModeAtom);
  const [preferences] = useAtom(studioPreferencesAtom);
  const [isHidden, setIsHidden] = useAtom(isPresentationToolbarHiddenAtom);
  const [activeViewpointId] = useAtom(activeViewpointIdAtom);
  const zoom = useExcalidrawStateValue("zoom");
  const api = useExcalidrawAPI();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [elementCount, setElementCount] = useState(
    () => api?.getSceneElements().length ?? 0,
  );
  const [isIdle, setIsIdle] = useState(false);
  const {
    exit,
    zoomIn,
    zoomOut,
    fitToContent,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    saveViewpoint,
    resetView,
    toggleViewpointOverview,
    goToAdjacentViewpoint,
    viewpoints,
    activeTool,
    setTool,
  } = useStudio();

  useEffect(
    () => api?.onChange((elements) => setElementCount(elements.length)),
    [api],
  );

  useEffect(() => {
    if (!isPresenting || !preferences.presentation.autoHideToolbar) {
      setIsIdle(false);
      return;
    }
    const view = wrapperRef.current?.ownerDocument.defaultView;
    const doc = wrapperRef.current?.ownerDocument;
    if (!view || !doc) {
      return;
    }
    let timer = view.setTimeout(() => setIsIdle(true), IDLE_DELAY_MS);
    const wake = () => {
      setIsIdle(false);
      view.clearTimeout(timer);
      timer = view.setTimeout(() => setIsIdle(true), IDLE_DELAY_MS);
    };
    doc.addEventListener("pointermove", wake, { passive: true });
    doc.addEventListener("keydown", wake);
    return () => {
      view.clearTimeout(timer);
      doc.removeEventListener("pointermove", wake);
      doc.removeEventListener("keydown", wake);
    };
  }, [isPresenting, preferences.presentation.autoHideToolbar]);

  if (!isPresenting) {
    return null;
  }

  const toolbarVisible = !isHidden;

  return (
    <div ref={wrapperRef} className="studio-presentation-ui">
      <ViewpointOverview />
      {elementCount === 0 && (
        <div className="studio-presentation-empty" role="status">
          <strong>Empty board</strong>
          <span>
            Pick a drawing tool below to annotate, or press <kbd>Escape</kbd> to
            return and prepare your board first.
          </span>
        </div>
      )}

      {!toolbarVisible ? (
        <button
          type="button"
          className="studio-presentation-peek"
          title="Show presentation controls"
          aria-label="Show presentation controls"
          onClick={() => setIsHidden(false)}
        >
          ⋯
        </button>
      ) : (
        <div
          className={`studio-presentation-controls${
            isIdle ? " studio-presentation-controls--idle" : ""
          }`}
          role="toolbar"
          aria-label="Presentation controls"
          onPointerEnter={() => setIsIdle(false)}
        >
          <span className="studio-presentation-controls__badge">
            <span
              className="studio-presentation-controls__dot"
              aria-hidden="true"
            />
            Presenting
          </span>

          <span
            className="studio-presentation-controls__group studio-presentation-controls__group--tools"
            role="group"
            aria-label="Annotation tools"
          >
            {TOOL_BUTTONS.map((tool) => (
              <button
                key={tool.type}
                type="button"
                className={`studio-presentation-controls__button studio-presentation-controls__button--tool${
                  activeTool === tool.type
                    ? " studio-presentation-controls__button--active"
                    : ""
                }`}
                title={`${tool.label} (${tool.shortcut})`}
                aria-label={tool.label}
                aria-pressed={activeTool === tool.type}
                onClick={() => setTool(tool.type)}
              >
                {tool.glyph}
              </button>
            ))}
          </span>

          <span className="studio-presentation-controls__group">
            <button
              type="button"
              className="studio-presentation-controls__button"
              title="Zoom out (K)"
              aria-label="Zoom out"
              onClick={zoomOut}
            >
              −
            </button>
            <span className="studio-presentation-controls__zoom">
              {Math.round((zoom?.value ?? 1) * 100)}%
            </span>
            <button
              type="button"
              className="studio-presentation-controls__button"
              title="Zoom in (J)"
              aria-label="Zoom in"
              onClick={zoomIn}
            >
              +
            </button>
            <button
              type="button"
              className="studio-presentation-controls__button"
              title="Fit content to viewport (F)"
              aria-label="Fit content to viewport"
              onClick={fitToContent}
            >
              ⤢
            </button>
            <button
              type="button"
              className="studio-presentation-controls__button"
              title="Return to previous viewport (Backspace)"
              aria-label="Return to previous viewport"
              disabled={!canGoBack}
              onClick={goBack}
            >
              ↶
            </button>
            <button
              type="button"
              className="studio-presentation-controls__button"
              title="Return to next viewport (Shift+Backspace)"
              aria-label="Return to next viewport"
              disabled={!canGoForward}
              onClick={goForward}
            >
              ↷
            </button>
            <button
              type="button"
              className="studio-presentation-controls__button"
              title="Reset view / go home (Shift+M)"
              aria-label="Reset view or go home"
              onClick={resetView}
            >
              ⌂
            </button>
          </span>

          <span className="studio-presentation-controls__group">
            <button
              type="button"
              className="studio-presentation-controls__button"
              title="Save current viewpoint (M)"
              aria-label="Save current viewpoint"
              onClick={() => saveViewpoint()}
            >
              +
            </button>
            <button
              type="button"
              className="studio-presentation-controls__button"
              title="Viewpoint overview (U)"
              aria-label="Toggle viewpoint overview"
              onClick={toggleViewpointOverview}
            >
              ☰
            </button>
            <button
              type="button"
              className="studio-presentation-controls__button"
              title="Previous viewpoint (Left Arrow)"
              aria-label="Previous viewpoint"
              disabled={viewpoints.length === 0}
              onClick={() => goToAdjacentViewpoint(-1)}
            >
              ◀
            </button>
            <span className="studio-presentation-controls__viewpoint">
              {activeViewpointId
                ? `${
                    viewpoints.findIndex((v) => v.id === activeViewpointId) + 1
                  }/${viewpoints.length}`
                : `${viewpoints.length} saved`}
            </span>
            <button
              type="button"
              className="studio-presentation-controls__button"
              title="Next viewpoint (Right Arrow)"
              aria-label="Next viewpoint"
              disabled={viewpoints.length === 0}
              onClick={() => goToAdjacentViewpoint(1)}
            >
              ▶
            </button>
          </span>

          <span className="studio-presentation-controls__hint">
            J/K zoom · F fit · P exit
          </span>
          <button
            type="button"
            className="studio-presentation-controls__button"
            title="Hide presentation controls"
            aria-label="Hide presentation controls"
            onClick={() => setIsHidden(true)}
          >
            ⋯
          </button>
          <button
            type="button"
            className="studio-presentation-controls__button studio-presentation-controls__button--exit"
            title="Exit Presentation Mode (P or Escape)"
            aria-label="Exit Presentation Mode"
            onClick={exit}
          >
            Exit
          </button>
        </div>
      )}
    </div>
  );
};
