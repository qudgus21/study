export const queryKeys = {
  dashboard: ["dashboard"] as const,

  categories: {
    all: ["categories"] as const,
    detail: (id: string) => ["categories", id] as const,
    missions: (id: string) => ["categories", id, "missions"] as const,
  },

  articles: ["articles"] as const,

  missions: {
    all: ["missions"] as const,
    detail: (id: string) => ["missions", id] as const,
  },

  jd: {
    trends: ["jd", "trends"] as const,
    insights: ["jd", "insights"] as const,
  },

  settings: ["settings"] as const,
};
