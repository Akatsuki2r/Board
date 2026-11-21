# Presentation Studio

A thin layer around Excalidraw that turns the app into a presentation studio. No core drawing-engine files were changed: everything lives here and in the two app-level files that mount it (`App.tsx`, `components/AppMainMenu.tsx`).

## Structure

| Module | Responsibility |
| --- | --- |
| `usePresentationMode.ts` | Mode switching, fullscreen, pre-presentation camera/tool restoration |
| `viewport.ts` | Camera capture/restore (`{ scrollX, scrollY, zoom }`) |
| `navigation/` | Zoom, fit-to-content, back stack, saved viewpoints |
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

`P` toggles Presentation Mode globally (intentionally replacing Freedraw's `P`; `X` still selects Freedraw). While presenting: `J`/`K` zoom, `F` fits content, `V`/`A`/`D`/`T` switch tools (`D` = freehand, not diamond), `Backspace` returns to the previous camera, `[`/`]` move between saved viewpoints, and `Escape` exits. All bindings are editable in **Menu → Presentation Studio settings…**.

## Tests

`shortcuts/config.test.ts`, `registration.test.ts` and `recording/RecordingEngine.test.ts` cover case-insensitive multi-word matching, exact modifiers, conflict detection, scope/typing guards, stable action dispatch, and the recording lifecycle with mocked browser APIs. Run with `yarn test:app excalidraw-app/studio --watch=false`.

## Known limitations

- Full-window/screen capture is not implemented; `CaptureSource` leaves room for it.
- The DOM text WYSIWYG overlay is not visible in canvas-only video while text is actively being edited (committed text is captured).
- Fullscreen may be rejected by browsers without a trusted user gesture; Presentation Mode still fills the viewport.
