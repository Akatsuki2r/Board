import { describe, expect, it } from "vitest";

import {
  comboFromKeyboardEvent,
  comboMatchesEvent,
  DEFAULT_SHORTCUTS,
  findShortcutConflict,
  formatCombo,
  validateShortcutMap,
} from "./config";

import type { KeyCombo } from "./model";

const keyEvent = (
  key: string,
  code: string,
  modifiers: Partial<
    Record<"ctrlKey" | "altKey" | "shiftKey" | "metaKey", boolean>
  > = {},
): KeyboardEvent =>
  ({
    key,
    code,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...modifiers,
  } as KeyboardEvent);

describe("studio shortcut config", () => {
  it("matches multi-word defaults regardless of case", () => {
    expect(
      comboMatchesEvent(
        DEFAULT_SHORTCUTS.exitPresentation as KeyCombo,
        keyEvent("Escape", "Escape"),
      ),
    ).toBe(true);
    expect(
      comboMatchesEvent(
        DEFAULT_SHORTCUTS.previousViewport as KeyCombo,
        keyEvent("Backspace", "Backspace"),
      ),
    ).toBe(true);
  });

  it("requires exact modifiers", () => {
    const combo: KeyCombo = { key: "j", ctrl: true };
    expect(
      comboMatchesEvent(combo, keyEvent("j", "KeyJ", { ctrlKey: true })),
    ).toBe(true);
    expect(comboMatchesEvent(combo, keyEvent("j", "KeyJ"))).toBe(false);
    expect(
      comboMatchesEvent(
        combo,
        keyEvent("j", "KeyJ", { ctrlKey: true, shiftKey: true }),
      ),
    ).toBe(false);
  });

  it("uses event.code aliases for non-Latin layouts", () => {
    expect(
      comboMatchesEvent(
        DEFAULT_SHORTCUTS.zoomIn as KeyCombo,
        keyEvent("ч", "KeyJ"),
      ),
    ).toBe(true);
  });

  it("captures modifiers from keyboard events and formats them", () => {
    const combo = comboFromKeyboardEvent(
      keyEvent("z", "KeyZ", { ctrlKey: true, shiftKey: true }),
    );
    expect(combo).toEqual({
      key: "z",
      ctrl: true,
      alt: false,
      shift: true,
      meta: false,
    });
    expect(formatCombo(combo as KeyCombo)).toContain("Shift");
    expect(formatCombo(combo as KeyCombo)).toContain("Z");
  });

  it("detects conflicts with other studio actions", () => {
    expect(
      findShortcutConflict(DEFAULT_SHORTCUTS, "togglePresentation", {
        key: "j",
      })?.id,
    ).toBe("zoomIn");
    expect(
      findShortcutConflict(DEFAULT_SHORTCUTS, "togglePresentation", {
        key: "y",
      }),
    ).toBeNull();
  });

  it("uses the approved navigation and recording-safe defaults", () => {
    expect(DEFAULT_SHORTCUTS.previousViewpoint).toMatchObject({
      key: "ArrowLeft",
    });
    expect(DEFAULT_SHORTCUTS.nextViewpoint).toMatchObject({
      key: "ArrowRight",
    });
    expect(DEFAULT_SHORTCUTS.saveViewpoint).toMatchObject({ key: "m" });
    expect(DEFAULT_SHORTCUTS.forwardViewport).toMatchObject({
      key: "Backspace",
      shift: true,
    });
    expect(
      comboMatchesEvent(
        DEFAULT_SHORTCUTS.previousViewpoint as KeyCombo,
        keyEvent("ArrowLeft", "ArrowLeft"),
      ),
    ).toBe(true);
  });

  it("drops duplicate assignments from persisted maps", () => {
    const parsed = validateShortcutMap({
      ...DEFAULT_SHORTCUTS,
      freehandTool: { key: "j" },
    });
    expect(parsed.zoomIn).toMatchObject({ key: "j" });
    expect(parsed.freehandTool).toBeUndefined();
  });

  it("validates persisted shortcut maps and preserves disabled actions", () => {
    const parsed = validateShortcutMap({
      zoomIn: null,
      zoomOut: { key: "n", alt: true, ctrl: false, shift: false, meta: false },
      bogus: { key: "x" },
    });
    expect(parsed.zoomIn).toBeNull();
    expect(parsed.zoomOut).toEqual({
      key: "n",
      alt: true,
      ctrl: false,
      shift: false,
      meta: false,
    });
    expect(parsed.togglePresentation).toEqual(
      DEFAULT_SHORTCUTS.togglePresentation,
    );
    expect("bogus" in parsed).toBe(false);
  });
});
