/**
 * 프론트엔드 JD 텍스트에서 기술 스택을 추출한다.
 * 단순 키워드 매칭 (API 비용 없음).
 */
export const FRONTEND_SKILLS = [
  // Core
  "JavaScript",
  "TypeScript",
  "HTML",
  "CSS",

  // Frameworks
  "React",
  "Next.js",
  "Vue",
  "Nuxt",
  "Angular",
  "Svelte",
  "Remix",
  "Astro",

  // State Management
  "Redux",
  "Zustand",
  "Recoil",
  "Jotai",
  "MobX",
  "Pinia",

  // Styling
  "Tailwind",
  "Sass",
  "SCSS",
  "styled-components",
  "Emotion",
  "CSS Modules",

  // Build Tools
  "Webpack",
  "Vite",
  "Rollup",
  "esbuild",
  "Turbopack",

  // Testing
  "Jest",
  "Vitest",
  "Playwright",
  "Cypress",
  "Testing Library",
  "Storybook",

  // Runtime / Backend
  "Node.js",
  "GraphQL",
  "REST API",
  "tRPC",

  // Mobile
  "React Native",

  // DevOps / Platform
  "Docker",
  "Vercel",
  "AWS",
  "Git",
  "CI/CD",
  "GitHub Actions",
] as const;

export type SkillName = (typeof FRONTEND_SKILLS)[number];

export function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  return FRONTEND_SKILLS.filter((skill) => {
    // 대소문자 무관 매칭, 단어 경계 고려
    const pattern = skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${pattern}\\b`).test(lower);
  });
}
