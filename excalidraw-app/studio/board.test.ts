import { describe, expect, it } from "vitest";

import { getBoardKey, LOCAL_BOARD_KEY } from "./board";

const viewWithHash = (hash: string) => ({ location: { hash } } as Window);

describe("getBoardKey", () => {
  it("uses the local board when there is no URL hash", () => {
    expect(getBoardKey(null)).toBe(LOCAL_BOARD_KEY);
    expect(getBoardKey(viewWithHash(""))).toBe(LOCAL_BOARD_KEY);
  });

  it("scopes shared boards by URL hash", () => {
    expect(getBoardKey(viewWithHash("#room-42"))).toBe("hash:room-42");
    expect(getBoardKey(viewWithHash("#room-42"))).not.toBe(
      getBoardKey(viewWithHash("#room-43")),
    );
  });
});
