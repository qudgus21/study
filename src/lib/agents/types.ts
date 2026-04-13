export type QuestionDifficulty = "junior" | "mid" | "senior";

export type QuestionSource = "resume" | "category" | "follow_up";

export type AgentType = "interview-evaluator" | "follow-up-generator";

export interface EvalPromptInput {
  questionTitle: string;
  questionDescription?: string;
  userAnswer: string;
  codeSnippet?: string;
  attemptNumber: number;
  previousFeedback?: string;
  categoryNames: string[];
  passScore?: number;
}

export interface FollowUpPromptInput {
  originalQuestion: string;
  userAnswer: string;
  score: number;
  feedbackSummary: string;
  categoryNames: string[];
}

export interface AgentPrompt {
  systemPrompt: string;
  userPrompt: string;
  fullClipboardText: string;
}

export interface Agent {
  type: AgentType;
  name: string;
  description: string;
  generatePrompt(input: EvalPromptInput | FollowUpPromptInput): AgentPrompt;
}
