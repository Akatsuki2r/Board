import { createContext, useContext } from "react";

import type { useStudioNavigation } from "./navigation/useStudioNavigation";
import type { useStudioRecording } from "./recording/useStudioRecording";
import type { useStudioTools } from "./tools/useStudioTools";
import type { usePresentationMode } from "./usePresentationMode";

export type StudioContextValue = ReturnType<typeof usePresentationMode> &
  ReturnType<typeof useStudioNavigation> &
  ReturnType<typeof useStudioTools> &
  ReturnType<typeof useStudioRecording>;

const StudioContext = createContext<StudioContextValue | null>(null);

export const StudioProvider = StudioContext.Provider;

export const useStudio = (): StudioContextValue => {
  const value = useContext(StudioContext);
  if (!value) {
    throw new Error("useStudio must be used inside a StudioProvider");
  }
  return value;
};
