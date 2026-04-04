import type { Agent, AgentType, MissionType } from "./types";
import seniorInterviewer from "./senior-interviewer";
import techLeadDebater from "./tech-lead-debater";
import strictCodeReviewer from "./strict-code-reviewer";
import juniorColleague from "./junior-colleague";
import answerEvaluator from "./answer-evaluator";

const agents: Record<AgentType, Agent> = {
  "senior-interviewer": seniorInterviewer,
  "tech-lead-debater": techLeadDebater,
  "strict-code-reviewer": strictCodeReviewer,
  "junior-colleague": juniorColleague,
  "answer-evaluator": answerEvaluator,
};

const missionAgentMap: Record<MissionType, AgentType> = {
  concept: "senior-interviewer",
  discussion: "tech-lead-debater",
  code: "strict-code-reviewer",
};

export function getAgentForMission(missionType: MissionType): Agent {
  return agents[missionAgentMap[missionType]];
}

export function getAgent(type: AgentType): Agent {
  return agents[type];
}

export { agents };
export type { Agent, AgentType, MissionType, AgentPromptInput, AgentPrompt } from "./types";
