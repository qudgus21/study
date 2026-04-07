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

  // Claude Code 세션 연동
  sessionId: string | null;
  isEvaluating: boolean;
  streamingText: string;
  evalError: string | null;

  setCurrentMission: (id: string) => void;
  setDraftAnswer: (text: string) => void;
  setGeneratedPrompt: (prompt: string) => void;
  setEvalResult: (result: string) => void;
  setParsedScore: (score: number | null) => void;
  setStep: (step: MissionStep) => void;
  setSessionId: (id: string | null) => void;
  setIsEvaluating: (val: boolean) => void;
  appendStreamingText: (chunk: string) => void;
  setEvalError: (error: string | null) => void;
  resetForRetry: () => void;
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
      sessionId: null,
      isEvaluating: false,
      streamingText: "",
      evalError: null,

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
            sessionId: null,
            isEvaluating: false,
            streamingText: "",
            evalError: null,
          };
        }),
      setDraftAnswer: (text) => set({ draftAnswer: text }),
      setGeneratedPrompt: (prompt) => set({ generatedPrompt: prompt, step: "evaluating" }),
      setEvalResult: (result) => set({ evalResult: result }),
      setParsedScore: (score) => set({ parsedScore: score }),
      setStep: (step) => set({ step }),
      setSessionId: (id) => set({ sessionId: id }),
      setIsEvaluating: (val) => set({ isEvaluating: val }),
      appendStreamingText: (chunk) =>
        set((state) => ({ streamingText: state.streamingText + chunk })),
      setEvalError: (error) => set({ evalError: error }),
      resetForRetry: () =>
        set({
          draftAnswer: "",
          evalResult: null,
          parsedScore: null,
          step: "answering",
          isEvaluating: false,
          streamingText: "",
          evalError: null,
          // sessionId 유지 — 같은 세션에서 재시도
        }),
      reset: () =>
        set({
          currentMissionId: null,
          draftAnswer: "",
          generatedPrompt: null,
          evalResult: null,
          parsedScore: null,
          step: "answering",
          sessionId: null,
          isEvaluating: false,
          streamingText: "",
          evalError: null,
        }),
    }),
    {
      name: "mission-draft",
      partialize: (state) => ({
        currentMissionId: state.currentMissionId,
        draftAnswer: state.draftAnswer,
        sessionId: state.sessionId,
        step: state.step,
        parsedScore: state.parsedScore,
        evalResult: state.evalResult,
      }),
    },
  ),
);
