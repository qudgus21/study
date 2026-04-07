import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

const GLOBAL_DOC = "global";

const DEFAULT_KEYWORDS = [
  // 언어 & 런타임
  "JavaScript",
  "TypeScript",
  "Node.js",
  "Deno",
  "Bun",
  // 프레임워크 & 라이브러리
  "React",
  "Next.js",
  "Vue",
  "Nuxt",
  "Svelte",
  "Angular",
  "Remix",
  "Astro",
  "Solid",
  // 스타일링
  "CSS",
  "Tailwind",
  "Sass",
  "CSS-in-JS",
  "styled-components",
  // 상태관리
  "상태관리",
  "Zustand",
  "Redux",
  "Jotai",
  "TanStack",
  "React Query",
  // 빌드 & 번들러
  "번들러",
  "Vite",
  "Webpack",
  "Turbopack",
  "esbuild",
  "Rollup",
  // 테스팅
  "테스트",
  "Jest",
  "Vitest",
  "Playwright",
  "Cypress",
  "Testing Library",
  "Storybook",
  // 웹 기술 핵심
  "HTML",
  "DOM",
  "Web API",
  "WebSocket",
  "Service Worker",
  "Web Worker",
  "PWA",
  // 성능 & 최적화
  "웹 성능",
  "Core Web Vitals",
  "Lighthouse",
  "렌더링",
  "SSR",
  "SSG",
  "ISR",
  "RSC",
  "Server Component",
  "Streaming",
  "Hydration",
  "코드 스플리팅",
  "Tree Shaking",
  "Lazy Loading",
  // 아키텍처 & 패턴
  "SPA",
  "MPA",
  "마이크로프론트엔드",
  "모노레포",
  "디자인 시스템",
  "컴포넌트",
  "디자인 패턴",
  "클린 코드",
  "리팩토링",
  // 패키지 매니저 & 도구
  "npm",
  "pnpm",
  "yarn",
  "Turborepo",
  "Nx",
  // 브라우저 & 접근성
  "브라우저",
  "크롬",
  "DevTools",
  "접근성",
  "a11y",
  "ARIA",
  // 프론트엔드 일반
  "프론트엔드",
  "프런트엔드",
  "frontend",
  "웹 개발",
  "UI",
  "UX",
  // AI & 개발 도구
  "AI",
  "LLM",
  "Copilot",
  "Claude",
  "코딩 에이전트",
];

/** GET /api/settings */
export async function GET() {
  try {
    const doc = await adminDb.collection("settings").doc(GLOBAL_DOC).get();

    if (!doc.exists) {
      const defaults = {
        pass_score: 80,
        article_keywords: DEFAULT_KEYWORDS,
        updated_at: new Date().toISOString(),
      };
      await adminDb.collection("settings").doc(GLOBAL_DOC).set(defaults);
      return NextResponse.json(defaults);
    }

    const data = doc.data()!;
    // 키워드가 없으면 기본값 세팅
    if (!data.article_keywords) {
      await adminDb
        .collection("settings")
        .doc(GLOBAL_DOC)
        .update({ article_keywords: DEFAULT_KEYWORDS });
      data.article_keywords = DEFAULT_KEYWORDS;
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** PATCH /api/settings */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if ("pass_score" in body && typeof body.pass_score === "number") {
      updateData.pass_score = body.pass_score;
    }
    if ("article_keywords" in body && Array.isArray(body.article_keywords)) {
      updateData.article_keywords = body.article_keywords;
    }

    await adminDb.collection("settings").doc(GLOBAL_DOC).set(updateData, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
