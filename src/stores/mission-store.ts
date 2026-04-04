import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MissionStep = "answering" | "evaluating" | "result";

interface MissionState {
  currentMissionId: string | null;
  draftAnswer: string;
  generatedPrompt: string | null;
  evalResult: string | null;
  parsedScore: number | null;
  step: MissionStep;

  setCurrentMission: (id: string) => void;
  setDraftAnswer: (text: string) => void;
  setGeneratedPrompt: (prompt: string) => void;
  setEvalResult: (result: string) => void;
  setParsedScore: (score: number | null) => void;
  setStep: (step: MissionStep) => void;
  reset: () => void;
}

export const useMissionStore = create<MissionState>()(
  persist(
    (set) => ({
      currentMissionId: null,
      draftAnswer: "",
      generatedPrompt: null,
      evalResult: null,
      parsedScore: null,
      step: "answering",

      setCurrentMission: (id) =>
        set((state) => {
          if (state.currentMissionId === id) return state;
          return {
            currentMissionId: id,
            draftAnswer: "",
            generatedPrompt: null,
            evalResult: null,
            parsedScore: null,
            step: "answering",
          };
        }),
      setDraftAnswer: (text) => set({ draftAnswer: text }),
      setGeneratedPrompt: (prompt) => set({ generatedPrompt: prompt, step: "evaluating" }),
      setEvalResult: (result) => set({ evalResult: result }),
      setParsedScore: (score) => set({ parsedScore: score }),
      setStep: (step) => set({ step }),
      reset: () =>
        set({
          currentMissionId: null,
          draftAnswer: "",
          generatedPrompt: null,
          evalResult: null,
          parsedScore: null,
          step: "answering",
        }),
    }),
    { name: "mission-draft" },
  ),
);
