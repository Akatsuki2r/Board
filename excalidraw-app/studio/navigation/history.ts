import { isSameViewport, type StudioViewport } from "../viewport";

const HISTORY_LIMIT = 50;

/** Only deliberate camera jumps are recorded; continuous panning is not. */
export interface NavigationHistory {
  past: StudioViewport[];
  future: StudioViewport[];
}

export const createNavigationHistory = (): NavigationHistory => ({
  past: [],
  future: [],
});

export const pushViewport = (
  history: NavigationHistory,
  viewport: StudioViewport,
): NavigationHistory => {
  const last = history.past[history.past.length - 1];
  const past =
    last && isSameViewport(last, viewport)
      ? history.past
      : [...history.past, viewport];
  return { past: past.slice(-HISTORY_LIMIT), future: [] };
};

export const goBackInHistory = (
  history: NavigationHistory,
  current: StudioViewport,
): { history: NavigationHistory; viewport: StudioViewport | null } => {
  const target = history.past[history.past.length - 1];
  if (!target) {
    return { history, viewport: null };
  }
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future].slice(0, HISTORY_LIMIT),
    },
    viewport: target,
  };
};

export const goForwardInHistory = (
  history: NavigationHistory,
  current: StudioViewport,
): { history: NavigationHistory; viewport: StudioViewport | null } => {
  const target = history.future[0];
  if (!target) {
    return { history, viewport: null };
  }
  return {
    history: {
      past: [...history.past, current].slice(-HISTORY_LIMIT),
      future: history.future.slice(1),
    },
    viewport: target,
  };
};
