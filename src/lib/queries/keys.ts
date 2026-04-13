export const queryKeys = {
  dashboard: ["dashboard"] as const,

  categories: {
    all: ["categories"] as const,
    detail: (id: string) => ["categories", id] as const,
    questions: (id: string) => ["categories", id, "questions"] as const,
  },

  articles: ["articles"] as const,

  questions: {
    all: ["questions"] as const,
    detail: (id: string) => ["questions", id] as const,
  },

  resumes: {
    all: ["resumes"] as const,
    detail: (id: string) => ["resumes", id] as const,
  },

  jd: {
    trends: ["jd", "trends"] as const,
    insights: ["jd", "insights"] as const,
  },

  settings: ["settings"] as const,
};
