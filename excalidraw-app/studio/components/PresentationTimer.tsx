import { useEffect, useRef, useState } from "react";

import { useAtomValue } from "../../app-jotai";
import { presentationStartedAtAtom, studioPreferencesAtom } from "../atoms";
import { formatDuration } from "../recording/useStudioRecording";

/** Presentation elapsed time — deliberately independent of recording time. */
export const PresentationTimer = () => {
  const startedAt = useAtomValue(presentationStartedAtAtom);
  const preferences = useAtomValue(studioPreferencesAtom);
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }
    const view = ref.current?.ownerDocument.defaultView;
    const tick = () => setElapsed(Date.now() - startedAt);
    tick();
    const interval = view?.setInterval(tick, 1000) ?? null;
    return () => {
      if (interval !== null) {
        view?.clearInterval(interval);
      }
    };
  }, [startedAt]);

  if (!startedAt || !preferences.presentation.showPresentationTimer) {
    return null;
  }

  return (
    <span
      ref={ref}
      className="studio-presentation-timer"
      title="Presentation time"
      aria-label="Presentation time"
    >
      {formatDuration(elapsed)}
    </span>
  );
};
