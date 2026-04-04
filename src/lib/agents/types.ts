export type MissionType = "concept" | "discussion" | "code";

export type AgentType =
  | "senior-interviewer"
  | "tech-lead-debater"
  | "strict-code-reviewer"
  | "junior-colleague"
  | "answer-evaluator";

export interface AgentPromptInput {
  missionType: MissionType;
  question: string;
  userAnswer: string;
  codeSnippet?: string;
  attemptNumber: number;
  previousFeedback?: string;
  categoryName: string;
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
  generatePrompt(input: AgentPromptInput): AgentPrompt;
}
