import type { Agent, AgentType } from "./types";
import interviewEvaluator from "./interview-evaluator";
import followUpGenerator from "./follow-up-generator";

const agents: Record<AgentType, Agent> = {
  "interview-evaluator": interviewEvaluator,
  "follow-up-generator": followUpGenerator,
};

export function getAgent(type: AgentType): Agent {
  return agents[type];
}

export { agents };
export type {
  Agent,
  AgentType,
  EvalPromptInput,
  FollowUpPromptInput,
  AgentPrompt,
  QuestionDifficulty,
  QuestionSource,
} from "./types";
