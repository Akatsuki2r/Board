export const LOCAL_BOARD_KEY = "local-board";

/**
 * Viewpoints are scoped to a board. A URL hash identifies a shared/file board;
 * otherwise the app has a single locally persisted board.
 */
export const getBoardKey = (view: Window | null): string => {
  const hash = view?.location.hash ?? "";
  return hash.length > 1 ? `hash:${hash.slice(1)}` : LOCAL_BOARD_KEY;
};
