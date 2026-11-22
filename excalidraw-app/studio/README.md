# Presentation Studio

A thin layer around Excalidraw that turns the app into a presentation studio. No core drawing-engine files were changed: everything lives here and in the two app-level files that mount it (`App.tsx`, `components/AppMainMenu.tsx`).

## Structure

| Module | Responsibility |
| --- | --- |
| `usePresentationMode.ts` | Mode switching, fullscreen, pre-presentation camera/tool restoration |
| `viewport.ts` | Camera capture/restore (`{ scrollX, scrollY, zoom }`) |
| `navigation/` | Zoom, fit, back/forward history, saved viewpoints, sequence, camera transitions |
| `tools/` | Thin wrapper over Excalidraw's `setActiveTool` |
| `shortcuts/` | Configurable combos, defaults, conflict detection, action registration |
| `recording/` | `CaptureSource` abstraction, canvas compositing, MediaRecorder engine |
| `components/` | Floating presentation toolbar, recording HUD, settings dialog |
| `atoms.ts`, `preferences.ts` | Jotai state and localStorage-backed preferences |

## Integration points

- `<Excalidraw ui={isPresenting ? false : undefined}>` hides default chrome while host children (the studio UI) keep rendering through Excalidraw's tunnel.
- Studio shortcuts are registered with the editor's `ActionManager` via `api.registerAction`, so Excalidraw's input/typing guards and global keyboard handling are reused rather than duplicated.
- `Backspace` is scoped out of `actionDeleteSelected`, and `Escape` out of `actionDeselect`, while presenting: the action manager cancels keys matched by more than one action. `Delete` still deletes selected elements, and Escape still exits an active linear editor first.
- Actions are registered **once**; dispatch reads the live studio context through a ref, so recording ticks and camera moves never re-register shortcuts.
- Browser APIs enter through `ownerDocument.defaultView` where available (fullscreen, capture stream, timers, MediaRecorder, object URLs).
- Canvas recording captures the static, in-progress and interactive canvases into a size-synced offscreen canvas; DOM controls are never part of the video.

## Defaults

`P` toggles Presentation Mode globally (intentionally replacing Freedraw's `P`; `X` still selects Freedraw). While presenting: `J`/`K` zoom, `F` fits content, `V`/`A`/`D`/`T` switch tools (`D` = freehand, not diamond), `Backspace`/`Shift+Backspace` walk camera history, `←`/`→` move between viewpoints (`[`/`]` remain aliases), `M` saves a viewpoint, `Shift+M` goes home, `U` opens the overview, `Z` undoes, `E` erases, and `Escape` exits. All bindings are editable in **Menu → Presentation Studio settings…**.

## Presentation sequence

Viewpoints are scoped by board (URL hash when present, otherwise the local board), ordered as a lightweight sequence and editable in the in-presentation overview (`U`). Each viewpoint can be renamed, annotated, reordered, marked as the default view and deleted with confirmation. `←`/`→` move through the sequence, `M` saves the current camera, `Shift+M` goes home/resets, and `Backspace`/`Shift+Backspace` walk the deliberate-camera history. Transitions use Excalidraw's own animation for fit-to-content and a cancelable, reduced-motion-aware interpolator for viewpoint jumps; all of this is configurable in Settings.

## Recording architecture

Recording is an explicit state machine (`idle → countdown → recording → paused → stopping → processing → ready`, with `failed` branches) owned by a controller-style `RecordingEngine`. The engine holds one `MediaRecorder`, one capture source and one chunk buffer per session; viewport, tool and presentation changes never recreate it. Two capture sources implement `CaptureSource`:

- `CanvasCompositeSource` (default): composites the static, in-progress and interactive editor canvases into a size-synced offscreen canvas via `captureStream(fps)`. DOM chrome and recording controls are excluded.
- `DisplayCaptureSource`: uses `navigator.mediaDevices.getDisplayMedia()` so the user explicitly picks a screen/window/tab. The selected surface (and anything visible in it, including the HUD) is captured, subject to browser support. Permission denial/cancellation and display-track termination are handled; ending the browser capture triggers a controlled stop that preserves valid chunks.

Completion provides an in-app preview with duration, size and capture mode, a download with a configurable filename prefix, and a discard confirmation. Active recordings are not stopped by leaving Presentation Mode, and a `beforeunload` warning protects against accidental reloads (no durable crash recovery is implied). Pause/resume is bound to Space through a dedicated pan-preserving listener so Space-drag panning still works.

## Annotation and shortcuts

The toolbar's `A+` group exposes a quick color selector, undo and eraser without leaving Presentation Mode. `Z` undoes through Excalidraw's own history (no second undo stack), `E` toggles the eraser, and the optional one-shot mode returns to navigation after a single annotation. Default annotation color and stroke width are applied on entry and restored on exit; a color chosen while presenting becomes the new default. All bindings are searchable in Settings, support per-action reset, and are checked against both studio and known core/browser conflicts (global bindings that collide are rejected).

## Tests

Ten test files cover key matching/conflicts, scope guards, the recording lifecycle, back/forward history, cancelable transitions, viewpoint CRUD/persistence, board scoping, preference validation, quick undo dispatch and the annotation tools hook. Run with `yarn test:studio` (or the full `yarn verify:studio` pipeline).

## Known limitations

- Screen/window capture depends on `getDisplayMedia` support and explicit user permission; it cannot be exercised in headless CI, so only its source logic is unit-tested.
- The DOM text WYSIWYG overlay is not visible in canvas-only video while text is actively being edited (committed text is captured).
- No durable crash recovery: a browser process crash loses in-progress recordings. Completed recordings live only as object URLs until exported or discarded.
- Fullscreen may be rejected by browsers without a trusted user gesture; Presentation Mode still fills the viewport.
