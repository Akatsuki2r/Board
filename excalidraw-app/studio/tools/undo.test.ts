import { describe, expect, it, vi } from "vitest";

import { dispatchEditorUndo } from "./undo";

describe("dispatchEditorUndo", () => {
  it("asks the editor to run its own undo shortcut", () => {
    const dispatch = vi.fn();
    dispatchEditorUndo({
      document: { dispatchEvent: dispatch },
    } as unknown as Window);
    expect(dispatch).toHaveBeenCalledTimes(1);
    const event = dispatch.mock.calls[0][0] as KeyboardEvent;
    expect(event.key).toBe("z");
    expect(event.bubbles).toBe(true);
    expect(event.ctrlKey || event.metaKey).toBe(true);
    expect(event.shiftKey).toBe(false);
  });

  it("does nothing without an owner window", () => {
    expect(() => dispatchEditorUndo(null)).not.toThrow();
  });
});
