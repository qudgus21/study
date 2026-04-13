import { create } from "zustand";
import { persist } from "zustand/middleware";

export type QuestionStep = "answering" | "evaluating" | "result";

interface QuestionState {
  currentQuestionId: string | null;
  draftAnswer: string;
  evalResult: string | null;
  parsedScore: number | null;
  step: QuestionStep;

  // Claude Code 세션 연동
  sessionId: string | null;
  isEvaluating: boolean;
  streamingText: string;
  evalError: string | null;

  // 꼬리질문 생성 상태
  isGeneratingFollowUp: boolean;

  setCurrentQuestion: (id: string) => void;
  setDraftAnswer: (text: string) => void;
  setEvalResult: (result: string) => void;
  setParsedScore: (score: number | null) => void;
  setStep: (step: QuestionStep) => void;
  setSessionId: (id: string | null) => void;
  setIsEvaluating: (val: boolean) => void;
  appendStreamingText: (chunk: string) => void;
  setEvalError: (error: string | null) => void;
  setIsGeneratingFollowUp: (val: boolean) => void;
  resetForRetry: () => void;
  reset: () => void;
}

export const useQuestionStore = create<QuestionState>()(
  persist(
    (set) => ({
      currentQuestionId: null,
      draftAnswer: "",
      evalResult: null,
      parsedScore: null,
      step: "answering",
      sessionId: null,
      isEvaluating: false,
      streamingText: "",
      evalError: null,
      isGeneratingFollowUp: false,

      setCurrentQuestion: (id) =>
        set((state) => {
          if (state.currentQuestionId === id) return state;
          return {
            currentQuestionId: id,
            draftAnswer: "",
            evalResult: null,
            parsedScore: null,
            step: "answering",
            sessionId: null,
            isEvaluating: false,
            streamingText: "",
            evalError: null,
            isGeneratingFollowUp: false,
          };
        }),
      setDraftAnswer: (text) => set({ draftAnswer: text }),
      setEvalResult: (result) => set({ evalResult: result }),
      setParsedScore: (score) => set({ parsedScore: score }),
      setStep: (step) => set({ step }),
      setSessionId: (id) => set({ sessionId: id }),
      setIsEvaluating: (val) => set({ isEvaluating: val }),
      appendStreamingText: (chunk) =>
        set((state) => ({ streamingText: state.streamingText + chunk })),
      setEvalError: (error) => set({ evalError: error }),
      setIsGeneratingFollowUp: (val) => set({ isGeneratingFollowUp: val }),
      resetForRetry: () =>
        set({
          draftAnswer: "",
          evalResult: null,
          parsedScore: null,
          step: "answering",
          isEvaluating: false,
          streamingText: "",
          evalError: null,
          isGeneratingFollowUp: false,
          // sessionId 유지 — 같은 세션에서 재시도
        }),
      reset: () =>
        set({
          currentQuestionId: null,
          draftAnswer: "",
          evalResult: null,
          parsedScore: null,
          step: "answering",
          sessionId: null,
          isEvaluating: false,
          streamingText: "",
          evalError: null,
          isGeneratingFollowUp: false,
        }),
    }),
    {
      name: "question-draft",
      partialize: (state) => ({
        currentQuestionId: state.currentQuestionId,
        draftAnswer: state.draftAnswer,
        sessionId: state.sessionId,
        step: state.step,
        parsedScore: state.parsedScore,
        evalResult: state.evalResult,
      }),
    },
  ),
);
