import { useEffect, useRef, useState } from "react";

import { useAtom, useAtomValue } from "../../app-jotai";
import { useStudio } from "../StudioContext";
import { isPresentationModeAtom, viewpointOverviewOpenAtom } from "../atoms";

import type { SavedViewpoint } from "../preferences";

type RowProps = {
  viewpoint: SavedViewpoint;
  index: number;
  count: number;
  active: boolean;
  onJump: () => void;
  onRename: (name: string) => void;
  onNotes: (notes: string) => void;
  onMove: (direction: 1 | -1) => void;
  onDelete: () => void;
  onHome: () => void;
};

const ViewpointRow = ({
  viewpoint,
  index,
  count,
  active,
  onJump,
  onRename,
  onNotes,
  onMove,
  onDelete,
  onHome,
}: RowProps) => {
  const [name, setName] = useState(viewpoint.name);
  const [notes, setNotes] = useState(viewpoint.notes ?? "");

  useEffect(() => setName(viewpoint.name), [viewpoint.name]);
  useEffect(() => setNotes(viewpoint.notes ?? ""), [viewpoint.notes]);

  return (
    <li
      className={`studio-viewpoints__item${
        active ? " studio-viewpoints__item--active" : ""
      }`}
    >
      <div className="studio-viewpoints__row">
        <button
          type="button"
          className="studio-viewpoints__jump"
          title={`Go to ${viewpoint.name}`}
          aria-label={`Go to ${viewpoint.name}`}
          onClick={onJump}
        >
          <span>{index + 1}</span>
        </button>
        <input
          className="studio-viewpoints__name"
          value={name}
          aria-label={`Name of viewpoint ${index + 1}`}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => onRename(name)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
        />
        <button
          type="button"
          className={`studio-viewpoints__icon${
            viewpoint.isDefault ? " studio-viewpoints__icon--home" : ""
          }`}
          title={viewpoint.isDefault ? "Default view" : "Set as default view"}
          aria-label={
            viewpoint.isDefault ? "Default view" : "Set as default view"
          }
          onClick={onHome}
        >
          ★
        </button>
      </div>
      <input
        className="studio-viewpoints__notes"
        value={notes}
        placeholder="Add a short note…"
        aria-label={`Note for ${viewpoint.name}`}
        onChange={(event) => setNotes(event.target.value)}
        onBlur={() => onNotes(notes)}
      />
      <div className="studio-viewpoints__actions">
        <button
          type="button"
          className="studio-viewpoints__icon"
          title="Move earlier"
          aria-label="Move viewpoint earlier"
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="studio-viewpoints__icon"
          title="Move later"
          aria-label="Move viewpoint later"
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          ↓
        </button>
        <button
          type="button"
          className="studio-viewpoints__icon studio-viewpoints__icon--danger"
          title="Delete viewpoint"
          aria-label="Delete viewpoint"
          onClick={onDelete}
        >
          ×
        </button>
      </div>
    </li>
  );
};

/** A compact, dismissible presentation sequence — not a slide editor. */
export const ViewpointOverview = () => {
  const isPresenting = useAtomValue(isPresentationModeAtom);
  const [isOpen, setIsOpen] = useAtom(viewpointOverviewOpenAtom);
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    viewpoints,
    activeViewpointId,
    boardKey,
    goToViewpoint,
    saveViewpoint,
    renameViewpoint,
    setViewpointNotes,
    moveViewpoint,
    deleteViewpoint,
    setDefaultViewpoint,
    resetView,
  } = useStudio();

  if (!isPresenting || !isOpen) {
    return null;
  }

  const confirmDelete = (name: string) => {
    const view = containerRef.current?.ownerDocument.defaultView;
    return view ? view.confirm(`Delete viewpoint “${name}”?`) : true;
  };

  return (
    <div
      ref={containerRef}
      className="studio-viewpoints"
      role="dialog"
      aria-label="Viewpoint overview"
    >
      <div className="studio-viewpoints__header">
        <strong>Viewpoints</strong>
        <span className="studio-viewpoints__board" title="Board scope">
          {boardKey === "local-board" ? "This board" : boardKey.slice(0, 18)}
        </span>
        <button
          type="button"
          className="studio-viewpoints__icon"
          title="Close overview (U)"
          aria-label="Close viewpoint overview"
          onClick={() => setIsOpen(false)}
        >
          ×
        </button>
      </div>

      {viewpoints.length === 0 ? (
        <p className="studio-viewpoints__empty">
          No viewpoints yet. Navigate somewhere interesting, then save it with
          <kbd>M</kbd>.
        </p>
      ) : (
        <ol className="studio-viewpoints__list">
          {viewpoints.map((viewpoint, index) => (
            <ViewpointRow
              key={viewpoint.id}
              viewpoint={viewpoint}
              index={index}
              count={viewpoints.length}
              active={viewpoint.id === activeViewpointId}
              onJump={() => goToViewpoint(viewpoint.id)}
              onRename={(name) => renameViewpoint(viewpoint.id, name)}
              onNotes={(notes) => setViewpointNotes(viewpoint.id, notes)}
              onMove={(direction) => moveViewpoint(viewpoint.id, direction)}
              onDelete={() => {
                if (confirmDelete(viewpoint.name)) {
                  deleteViewpoint(viewpoint.id);
                }
              }}
              onHome={() => setDefaultViewpoint(viewpoint.id)}
            />
          ))}
        </ol>
      )}

      <div className="studio-viewpoints__footer">
        <button
          type="button"
          className="studio-viewpoints__action"
          onClick={() => saveViewpoint()}
        >
          + Save current
        </button>
        <button
          type="button"
          className="studio-viewpoints__action"
          onClick={resetView}
        >
          Reset view
        </button>
      </div>
    </div>
  );
};
