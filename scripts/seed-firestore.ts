/**
 * Firestore Seed Script
 *
 * Seeds categories, topics, missions, weeks, and settings into Firestore.
 * Run with: npx tsx scripts/seed-firestore.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// 1. Load .env.local before importing firebase-admin
// ---------------------------------------------------------------------------
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const eqIndex = line.indexOf("=");
  if (eqIndex === -1) continue;
  const key = line.slice(0, eqIndex).trim();
  let value = line.slice(eqIndex + 1).trim();
  // Remove surrounding quotes
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (key) {
    process.env[key] = value;
  }
}

// ---------------------------------------------------------------------------
// 2. Firebase Admin init
// ---------------------------------------------------------------------------
import admin from "firebase-admin";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "Missing FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, or FIREBASE_ADMIN_PRIVATE_KEY in .env.local",
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
});

const db = admin.firestore();

// ---------------------------------------------------------------------------
// 3. Helpers
// ---------------------------------------------------------------------------
function now(): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.now();
}

/** Return the most recent Monday (or today if today is Monday) at midnight UTC */
function currentWeekMonday(): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, …
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// ---------------------------------------------------------------------------
// 4. Data definitions
// ---------------------------------------------------------------------------

// ── Categories ──────────────────────────────────────────────────────────────
interface CategoryData {
  id: string;
  name: string;
  group_name: string;
  color: string;
  sort_order: number;
}

const categories: CategoryData[] = [
  // 언어/런타임
  { id: "cat-js", name: "JavaScript", group_name: "언어/런타임", color: "#F7DF1E", sort_order: 1 },
  { id: "cat-ts", name: "TypeScript", group_name: "언어/런타임", color: "#3178C6", sort_order: 2 },
  {
    id: "cat-browser",
    name: "브라우저 API",
    group_name: "언어/런타임",
    color: "#FF6B35",
    sort_order: 3,
  },
  { id: "cat-node", name: "Node.js", group_name: "언어/런타임", color: "#339933", sort_order: 4 },

  // 프론트엔드 프레임워크
  {
    id: "cat-react",
    name: "React",
    group_name: "프론트엔드 프레임워크",
    color: "#61DAFB",
    sort_order: 5,
  },
  {
    id: "cat-nextjs",
    name: "Next.js",
    group_name: "프론트엔드 프레임워크",
    color: "#000000",
    sort_order: 6,
  },
  {
    id: "cat-vue",
    name: "Vue",
    group_name: "프론트엔드 프레임워크",
    color: "#4FC08D",
    sort_order: 7,
  },
  {
    id: "cat-svelte",
    name: "Svelte",
    group_name: "프론트엔드 프레임워크",
    color: "#FF3E00",
    sort_order: 8,
  },
  {
    id: "cat-angular",
    name: "Angular",
    group_name: "프론트엔드 프레임워크",
    color: "#DD0031",
    sort_order: 9,
  },
  {
    id: "cat-remix",
    name: "Remix",
    group_name: "프론트엔드 프레임워크",
    color: "#121212",
    sort_order: 10,
  },
  {
    id: "cat-preact",
    name: "Preact",
    group_name: "프론트엔드 프레임워크",
    color: "#673AB8",
    sort_order: 11,
  },

  // 설계/아키텍처
  {
    id: "cat-component",
    name: "컴포넌트 설계",
    group_name: "설계/아키텍처",
    color: "#9C27B0",
    sort_order: 12,
  },
  {
    id: "cat-state",
    name: "상태관리",
    group_name: "설계/아키텍처",
    color: "#764ABC",
    sort_order: 13,
  },
  {
    id: "cat-monorepo",
    name: "모노레포",
    group_name: "설계/아키텍처",
    color: "#5C6BC0",
    sort_order: 14,
  },
  {
    id: "cat-mfe",
    name: "마이크로프론트엔드",
    group_name: "설계/아키텍처",
    color: "#0097A7",
    sort_order: 15,
  },

  // 성능
  {
    id: "cat-rendering",
    name: "렌더링 최적화",
    group_name: "성능",
    color: "#F44336",
    sort_order: 16,
  },
  { id: "cat-bundle", name: "번들 최적화", group_name: "성능", color: "#FF9800", sort_order: 17 },
  { id: "cat-cwv", name: "Core Web Vitals", group_name: "성능", color: "#4CAF50", sort_order: 18 },

  // 인프라/배포
  { id: "cat-cicd", name: "CI/CD", group_name: "인프라/배포", color: "#2196F3", sort_order: 19 },
  { id: "cat-docker", name: "Docker", group_name: "인프라/배포", color: "#2496ED", sort_order: 20 },
  { id: "cat-cdn", name: "CDN", group_name: "인프라/배포", color: "#FF6F00", sort_order: 21 },
  {
    id: "cat-monitoring",
    name: "모니터링",
    group_name: "인프라/배포",
    color: "#E91E63",
    sort_order: 22,
  },

  // AI/최신 트렌드
  {
    id: "cat-llm",
    name: "LLM 활용",
    group_name: "AI/최신 트렌드",
    color: "#00BCD4",
    sort_order: 23,
  },
  {
    id: "cat-ai-tools",
    name: "AI 코딩 도구",
    group_name: "AI/최신 트렌드",
    color: "#8BC34A",
    sort_order: 24,
  },

  // 커뮤니케이션
  {
    id: "cat-explain",
    name: "기술 설명",
    group_name: "커뮤니케이션",
    color: "#795548",
    sort_order: 25,
  },
  {
    id: "cat-decision",
    name: "의사결정",
    group_name: "커뮤니케이션",
    color: "#607D8B",
    sort_order: 26,
  },
  {
    id: "cat-codereview",
    name: "코드리뷰",
    group_name: "커뮤니케이션",
    color: "#9E9E9E",
    sort_order: 27,
  },
];

// ── Topics ───────────────────────────────────────────────────────────────────
interface TopicData {
  id: string;
  title: string;
  description: string;
  mission_type: "concept" | "discussion" | "code";
  category_id: string;
  category_name: string;
  difficulty: "easy" | "medium" | "hard";
  source_type: "generated" | "manual";
  code_snippet: string | null;
  is_used: boolean;
}

const topics: TopicData[] = [
  // ── CONCEPT (20) ─────────────────────────────────────────────────────────
  {
    id: "topic-c-01",
    title: "JavaScript 이벤트 루프 동작 원리",
    description:
      "Call Stack, Task Queue, Microtask Queue, Web API의 관계와 이벤트 루프가 비동기 코드를 처리하는 순서를 설명하세요. Promise와 setTimeout의 실행 순서 차이도 포함하세요.",
    mission_type: "concept",
    category_id: "cat-js",
    category_name: "JavaScript",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-c-02",
    title: "TypeScript 제네릭(Generics)과 조건부 타입",
    description:
      "제네릭의 기본 개념부터 조건부 타입(Conditional Types), infer 키워드 활용까지 설명하세요. 실제 유틸리티 타입(Awaited, ReturnType 등) 구현 예시를 들어 설명하세요.",
    mission_type: "concept",
    category_id: "cat-ts",
    category_name: "TypeScript",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-c-03",
    title: "React 렌더링 최적화: React.memo, useMemo, useCallback",
    description:
      "React.memo, useMemo, useCallback의 차이점과 각각 언제 사용해야 하는지 설명하세요. 잘못된 최적화(premature optimization)의 위험성도 함께 논의하세요.",
    mission_type: "concept",
    category_id: "cat-react",
    category_name: "React",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-c-04",
    title: "Next.js App Router: Server Component vs Client Component",
    description:
      "Next.js 13+ App Router에서 Server Component와 Client Component의 차이, 데이터 페칭 전략, 'use client' 디렉티브의 경계와 trade-off를 설명하세요.",
    mission_type: "concept",
    category_id: "cat-nextjs",
    category_name: "Next.js",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-c-05",
    title: "브라우저 Critical Rendering Path",
    description:
      "HTML 파싱부터 픽셀 출력까지 브라우저가 페이지를 렌더링하는 전체 과정(DOM 생성 → CSSOM → Render Tree → Layout → Paint → Composite)을 설명하고, 각 단계에서 성능을 최적화하는 방법을 논하세요.",
    mission_type: "concept",
    category_id: "cat-browser",
    category_name: "브라우저 API",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-c-06",
    title: "JavaScript 클로저(Closure)와 실용적 활용",
    description:
      "클로저의 정의와 스코프 체인 동작 원리를 설명하고, 모듈 패턴·커링·메모이제이션 등 실전에서 클로저를 활용하는 패턴을 예시와 함께 설명하세요.",
    mission_type: "concept",
    category_id: "cat-js",
    category_name: "JavaScript",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-c-07",
    title: "React Concurrent Features: Suspense와 Transitions",
    description:
      "React 18의 Concurrent Mode에서 Suspense, useTransition, useDeferredValue가 어떻게 동작하며, 기존 Blocking Rendering 방식과 어떤 차이가 있는지 설명하세요.",
    mission_type: "concept",
    category_id: "cat-react",
    category_name: "React",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-c-08",
    title: "CSS-in-JS vs CSS Modules vs Tailwind 비교",
    description:
      "각 CSS 방법론의 동작 원리, 번들 크기 영향, SSR 호환성, 성능 특성, DX 차이를 비교 분석하고 프로젝트 성격별 권장 선택 기준을 제시하세요.",
    mission_type: "concept",
    category_id: "cat-component",
    category_name: "컴포넌트 설계",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-c-09",
    title: "웹 성능 지표: Core Web Vitals 완전 정복",
    description:
      "LCP, FID/INP, CLS의 정의, 측정 방법, 각 지표에 영향을 주는 요인과 개선 전략을 구체적인 기법과 함께 설명하세요.",
    mission_type: "concept",
    category_id: "cat-cwv",
    category_name: "Core Web Vitals",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-c-10",
    title: "TypeScript 타입 시스템: 구조적 타이핑(Structural Typing)",
    description:
      "TypeScript가 왜 Nominal Typing이 아닌 Structural Typing을 채택했는지, duck typing과의 관계, 그리고 이로 인해 발생할 수 있는 예상치 못한 동작과 해결 방법을 설명하세요.",
    mission_type: "concept",
    category_id: "cat-ts",
    category_name: "TypeScript",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-c-11",
    title: "상태관리 라이브러리 비교: Redux vs Zustand vs Jotai vs TanStack Query",
    description:
      "각 라이브러리의 설계 철학, boilerplate 양, 렌더링 최적화 방식, 서버 상태와 클라이언트 상태 분리 전략을 비교하고 프로젝트 규모별 선택 기준을 제시하세요.",
    mission_type: "concept",
    category_id: "cat-state",
    category_name: "상태관리",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-c-12",
    title: "JavaScript 프로토타입 체인과 상속",
    description:
      "프로토타입 체인의 동작 원리, __proto__와 prototype의 차이, ES6 class가 내부적으로 어떻게 프로토타입을 활용하는지, 그리고 instanceof 연산자 동작을 설명하세요.",
    mission_type: "concept",
    category_id: "cat-js",
    category_name: "JavaScript",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-c-13",
    title: "번들러 동작 원리: Webpack vs Vite vs Turbopack",
    description:
      "각 번들러의 모듈 처리 방식, Dev Server 전략(번들링 vs ESM native), Tree Shaking 메커니즘, HMR 구현 방식의 차이를 설명하고 선택 기준을 제시하세요.",
    mission_type: "concept",
    category_id: "cat-bundle",
    category_name: "번들 최적화",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-c-14",
    title: "React Hook의 동작 규칙과 내부 구현",
    description:
      "React Hooks가 왜 최상위에서만 호출되어야 하는지 내부 Fiber 노드의 linked list 구조로 설명하고, 커스텀 훅 설계 원칙과 좋은 커스텀 훅의 특성을 설명하세요.",
    mission_type: "concept",
    category_id: "cat-react",
    category_name: "React",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-c-15",
    title: "마이크로프론트엔드 아키텍처 패턴",
    description:
      "Module Federation, iFrame, Web Components, Single SPA 기반의 마이크로프론트엔드 구현 방법을 비교하고, 공유 의존성 관리, 스타일 격리, 팀 간 통신 전략을 설명하세요.",
    mission_type: "concept",
    category_id: "cat-mfe",
    category_name: "마이크로프론트엔드",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-c-16",
    title: "브라우저 스토리지 비교: Cookie vs localStorage vs sessionStorage vs IndexedDB",
    description:
      "각 스토리지의 용량 제한, 만료 정책, 보안 특성(HttpOnly, SameSite), 접근 범위, SSR 호환성을 비교하고 인증 토큰·캐시·대용량 데이터 저장 시 각각 언제 사용해야 하는지 설명하세요.",
    mission_type: "concept",
    category_id: "cat-browser",
    category_name: "브라우저 API",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-c-17",
    title: "Node.js 스트림(Stream)과 백프레셔(Backpressure)",
    description:
      "Node.js의 Readable·Writable·Transform Stream 동작 원리, 파이프라인(pipeline), 백프레셔 메커니즘을 설명하고 대용량 파일 처리나 HTTP 스트리밍에서 메모리를 효율적으로 사용하는 방법을 논하세요.",
    mission_type: "concept",
    category_id: "cat-node",
    category_name: "Node.js",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-c-18",
    title: "모노레포 구성 전략: Turborepo vs Nx",
    description:
      "모노레포의 장단점, 패키지 경계 설계, 빌드 캐싱·태스크 오케스트레이션, 공유 패키지(ui, utils, types) 관리 전략을 Turborepo와 Nx를 비교하며 설명하세요.",
    mission_type: "concept",
    category_id: "cat-monorepo",
    category_name: "모노레포",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-c-19",
    title: "LLM API 통합: 스트리밍 응답과 에러 처리 전략",
    description:
      "OpenAI/Anthropic API의 스트리밍 응답(SSE)을 프론트엔드에서 처리하는 방법, 토큰 제한·Rate Limit 에러 핸들링, 재시도 전략, 사용자 경험 개선을 위한 점진적 렌더링 기법을 설명하세요.",
    mission_type: "concept",
    category_id: "cat-llm",
    category_name: "LLM 활용",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-c-20",
    title: "CI/CD 파이프라인 설계: 프론트엔드 최적화",
    description:
      "프론트엔드 CI/CD 파이프라인에서 타입 체크·린트·테스트·빌드·배포 각 단계의 병렬화 전략, 캐싱 활용, Preview 배포, Canary 릴리즈 구현 방법을 GitHub Actions 기준으로 설명하세요.",
    mission_type: "concept",
    category_id: "cat-cicd",
    category_name: "CI/CD",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },

  // ── DISCUSSION (20) ───────────────────────────────────────────────────────
  {
    id: "topic-d-01",
    title: "팀에서 TypeScript 도입을 반대하는 시니어를 어떻게 설득하겠습니까?",
    description:
      "TypeScript 도입의 비용(학습 곡선, 빌드 시간, 초기 타입 작성 오버헤드)과 장기적 이점을 균형 있게 제시하고, 점진적 마이그레이션 전략과 팀 설득 방법을 논하세요.",
    mission_type: "discussion",
    category_id: "cat-decision",
    category_name: "의사결정",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-d-02",
    title: "SPA vs MPA vs SSR vs SSG: 어떤 기준으로 선택하겠습니까?",
    description:
      "각 렌더링 전략의 특성(초기 로드 속도, SEO, 동적 콘텐츠, 인프라 복잡도)을 비교하고, 커머스·대시보드·마케팅 사이트·SaaS 앱 등 구체적인 비즈니스 시나리오별 선택 근거를 논하세요.",
    mission_type: "discussion",
    category_id: "cat-decision",
    category_name: "의사결정",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-d-03",
    title: "레거시 jQuery 코드베이스를 현대 프레임워크로 마이그레이션하는 전략",
    description:
      "Big Bang 마이그레이션 vs 점진적 마이그레이션의 장단점, Strangler Fig 패턴 적용, 팀 역량·비즈니스 연속성을 고려한 실행 계획 수립, 리스크 관리 방법을 논하세요.",
    mission_type: "discussion",
    category_id: "cat-decision",
    category_name: "의사결정",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-d-04",
    title: "프론트엔드 테스트 전략: 무엇을 어느 수준까지 테스트해야 하는가?",
    description:
      "Unit · Integration · E2E 테스트의 비용 대비 효과, Testing Trophy vs Testing Pyramid, 비즈니스 로직·UI 인터랙션·접근성 테스트 우선순위, 테스트 커버리지 목표 설정 방법을 논하세요.",
    mission_type: "discussion",
    category_id: "cat-codereview",
    category_name: "코드리뷰",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-d-05",
    title: "디자인 시스템 구축 vs 오픈소스 UI 라이브러리 사용: 어떻게 결정하겠습니까?",
    description:
      "팀 규모·제품 개수·브랜드 일관성 요구사항·유지보수 비용을 기준으로 자체 디자인 시스템과 외부 라이브러리 도입을 비교하고, 하이브리드 접근법과 점진적 구축 전략을 논하세요.",
    mission_type: "discussion",
    category_id: "cat-component",
    category_name: "컴포넌트 설계",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-d-06",
    title: "코드 리뷰 문화를 개선하려면 어떻게 해야 하는가?",
    description:
      "형식적인 리뷰를 넘어 실질적인 지식 공유와 코드 품질 향상으로 이어지는 리뷰 프로세스 설계, 리뷰 기준 문서화, 심리적 안전감 형성, 자동화로 줄일 수 있는 리뷰 포인트를 논하세요.",
    mission_type: "discussion",
    category_id: "cat-codereview",
    category_name: "코드리뷰",
    difficulty: "easy",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-d-07",
    title: "프론트엔드 성능 개선 작업의 우선순위를 어떻게 정하겠습니까?",
    description:
      "비즈니스 지표(전환율, 이탈율)와 기술 지표(Core Web Vitals, TTI) 연결 방법, 성능 측정·분석 도구 활용, 개선 ROI 산정, 개발팀과 비즈니스 팀에게 각각 설득하는 커뮤니케이션 방법을 논하세요.",
    mission_type: "discussion",
    category_id: "cat-explain",
    category_name: "기술 설명",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-d-08",
    title: "AI 코딩 도구가 시니어 개발자의 역할을 어떻게 변화시키는가?",
    description:
      "GitHub Copilot·Cursor 등 AI 도구가 코드 작성·리뷰·설계에 미치는 영향, 시니어 개발자가 집중해야 할 고차원 역량의 변화, AI-assisted 개발에서 코드 품질·보안 유지 전략을 논하세요.",
    mission_type: "discussion",
    category_id: "cat-ai-tools",
    category_name: "AI 코딩 도구",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-d-09",
    title: "모노레포 vs 폴리레포: 프로젝트 규모별 전략",
    description:
      "팀 독립성·공유 코드 관리·빌드 시간·배포 전략 관점에서 모노레포와 폴리레포를 비교하고, 조직 구조(Conway's Law)와의 연관성, 스케일업 시나리오별 전환 기준을 논하세요.",
    mission_type: "discussion",
    category_id: "cat-monorepo",
    category_name: "모노레포",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-d-10",
    title: "비개발자(기획자/디자이너)에게 기술 부채를 어떻게 설명하겠습니까?",
    description:
      "기술 부채의 개념을 비기술적 이해관계자가 이해할 수 있는 비유로 설명하고, 부채 규모 시각화, 비즈니스 리스크와의 연결, 리팩토링 시간 확보를 위한 설득 전략을 논하세요.",
    mission_type: "discussion",
    category_id: "cat-explain",
    category_name: "기술 설명",
    difficulty: "easy",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-d-11",
    title: "마이크로프론트엔드 도입의 득과 실",
    description:
      "팀 자율성·독립 배포·기술 스택 자유도의 이점과 공유 상태 관리 복잡도·성능 오버헤드·중복 번들·UX 일관성 유지 비용을 균형 있게 평가하고, 도입이 적합한 조직 규모와 시나리오를 논하세요.",
    mission_type: "discussion",
    category_id: "cat-mfe",
    category_name: "마이크로프론트엔드",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-d-12",
    title: "접근성(Accessibility)을 처음부터 고려하지 않은 제품을 어떻게 개선하겠습니까?",
    description:
      "WCAG 기준 우선순위 설정, 자동화 도구(axe, Lighthouse)와 수동 테스트의 결합, 접근성 개선을 개발 프로세스에 통합하는 방법, 비즈니스 케이스로 설득하는 전략을 논하세요.",
    mission_type: "discussion",
    category_id: "cat-explain",
    category_name: "기술 설명",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-d-13",
    title: "실시간 협업 기능(Google Docs 유사) 구현 시 아키텍처 결정사항",
    description:
      "WebSocket vs SSE vs WebRTC, CRDT vs OT(Operational Transformation) 충돌 해결 전략, 오프라인 지원, 낙관적 업데이트, 상태 동기화 아키텍처 선택 근거를 논하세요.",
    mission_type: "discussion",
    category_id: "cat-decision",
    category_name: "의사결정",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-d-14",
    title: "프론트엔드 모니터링 체계를 처음부터 구축한다면?",
    description:
      "에러 추적(Sentry), 성능 모니터링(RUM), 사용자 행동 분석, 커스텀 비즈니스 지표 수집, 알림 전략, On-call 프로세스를 포함한 종합적인 관찰가능성(Observability) 체계 설계를 논하세요.",
    mission_type: "discussion",
    category_id: "cat-monitoring",
    category_name: "모니터링",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-d-15",
    title: "주니어 개발자에게 효과적으로 멘토링하는 방법",
    description:
      "기술 역량 성장과 소프트 스킬 발전을 균형 있게 지원하는 멘토링 방법, 페어 프로그래밍·코드 리뷰·1on1 활용 전략, 자율성과 지도 사이의 균형, 성장 측정 방법을 논하세요.",
    mission_type: "discussion",
    category_id: "cat-codereview",
    category_name: "코드리뷰",
    difficulty: "easy",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-d-16",
    title: "프론트엔드에서 보안 취약점을 예방하는 개발 문화",
    description:
      "XSS·CSRF·의존성 취약점 등 프론트엔드 주요 보안 이슈를 개발 프로세스에서 예방하는 방법, 보안 코드 리뷰 체크리스트, 자동화 스캔 도구 통합, 보안 인식 문화 형성 전략을 논하세요.",
    mission_type: "discussion",
    category_id: "cat-decision",
    category_name: "의사결정",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-d-17",
    title: "Next.js에서 App Router와 Pages Router 중 무엇을 선택하겠습니까?",
    description:
      "App Router의 Server Components·스트리밍·중첩 레이아웃의 장점과 생태계 성숙도·학습 곡선·마이그레이션 비용을 비교하고, 새 프로젝트·기존 프로젝트·팀 숙련도별 선택 기준을 논하세요.",
    mission_type: "discussion",
    category_id: "cat-nextjs",
    category_name: "Next.js",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-d-18",
    title: "무한 스크롤 vs 페이지네이션: 언제 무엇을 선택해야 하는가?",
    description:
      "UX 관점(사용자 제어감, URL 공유 가능성), 성능 관점(DOM 노드 수, 데이터 페칭), SEO 관점, 접근성 관점, 비즈니스 목표(탐색 vs 목적 검색)를 종합해 각 패턴의 적합한 사용 시나리오를 논하세요.",
    mission_type: "discussion",
    category_id: "cat-explain",
    category_name: "기술 설명",
    difficulty: "easy",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-d-19",
    title: "GraphQL vs REST API: 프론트엔드 개발자 관점에서 선택 기준",
    description:
      "Over-fetching·Under-fetching 문제 해결, 타입 안전성, 클라이언트 캐싱 전략(Apollo, TanStack Query), 실시간 구독, 팀 간 협업 방식, 보안 고려사항을 비교하며 각 API 방식의 적합한 시나리오를 논하세요.",
    mission_type: "discussion",
    category_id: "cat-decision",
    category_name: "의사결정",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },
  {
    id: "topic-d-20",
    title: "프로덕션 장애 발생 시 프론트엔드 엔지니어의 대응 프로세스",
    description:
      "장애 탐지·초기 대응·원인 분석·임시 조치·근본 해결·사후 회고의 각 단계에서 프론트엔드 엔지니어가 취해야 할 행동, 롤백 전략, 팀 커뮤니케이션, Postmortem 작성 방법을 논하세요.",
    mission_type: "discussion",
    category_id: "cat-monitoring",
    category_name: "모니터링",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: null,
    is_used: false,
  },

  // ── CODE (20) ─────────────────────────────────────────────────────────────
  {
    id: "topic-code-01",
    title: "React useEffect 무한 루프 디버깅",
    description:
      "아래 컴포넌트는 무한 렌더링이 발생합니다. 원인을 찾고 수정하세요. 또한 컴포넌트가 언마운트될 때 fetch를 취소하는 코드도 추가하세요.",
    mission_type: "code",
    category_id: "cat-react",
    category_name: "React",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: `function UserList() {
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ role: 'admin' });

  useEffect(() => {
    fetch(\`/api/users?role=\${filters.role}\`)
      .then(res => res.json())
      .then(data => setUsers(data));
  }, [filters]); // filters 객체가 매 렌더마다 새로 생성됨

  const handleRoleChange = (role) => {
    setFilters({ role }); // 새 객체 생성 → 참조 변경 → useEffect 재실행
  };

  return (
    <div>
      <button onClick={() => handleRoleChange('admin')}>Admin</button>
      <button onClick={() => handleRoleChange('user')}>User</button>
      {users.map(u => <div key={u.id}>{u.name}</div>)}
    </div>
  );
}`,
    is_used: false,
  },
  {
    id: "topic-code-02",
    title: "클로저로 인한 stale state 문제 수정",
    description:
      "아래 타이머 컴포넌트에서 카운트 값이 항상 1로 표시됩니다. 원인을 분석하고 useRef 또는 함수형 업데이트를 사용해 수정하세요.",
    mission_type: "code",
    category_id: "cat-js",
    category_name: "JavaScript",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: `function Timer() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      // 클로저가 초기 count 값(0)을 캡처
      setCount(count + 1); // 항상 0 + 1 = 1
    }, 1000);

    return () => clearInterval(interval);
  }, []); // 빈 배열: 마운트 시 한 번만 실행

  return <div>Count: {count}</div>;
}`,
    is_used: false,
  },
  {
    id: "topic-code-03",
    title: "불필요한 리렌더링 최적화",
    description:
      "아래 코드에서 ChildComponent는 parent 상태가 변경될 때마다 리렌더링됩니다. React DevTools Profiler로 확인되는 문제를 찾고, React.memo, useCallback, useMemo를 적절히 적용해 최적화하세요.",
    mission_type: "code",
    category_id: "cat-react",
    category_name: "React",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: `function ParentComponent() {
  const [count, setCount] = useState(0);
  const [text, setText] = useState('');

  // 매 렌더마다 새 함수 객체 생성
  const handleClick = () => {
    console.log('clicked');
  };

  // 매 렌더마다 새 배열 생성
  const items = [1, 2, 3].map(n => ({ id: n, value: n * count }));

  return (
    <div>
      <input value={text} onChange={e => setText(e.target.value)} />
      <button onClick={() => setCount(c => c + 1)}>+</button>
      <ChildComponent onClick={handleClick} items={items} />
    </div>
  );
}

// memo가 없어서 부모 렌더링 시 항상 재렌더링
function ChildComponent({ onClick, items }) {
  console.log('ChildComponent rendered');
  return (
    <ul>
      {items.map(item => (
        <li key={item.id} onClick={onClick}>{item.value}</li>
      ))}
    </ul>
  );
}`,
    is_used: false,
  },
  {
    id: "topic-code-04",
    title: "TypeScript 타입 가드와 discriminated union 리팩토링",
    description:
      "아래 코드는 as 타입 단언을 남용하고 런타임 에러가 발생할 수 있습니다. Discriminated Union과 타입 가드를 사용해 타입 안전한 코드로 리팩토링하세요.",
    mission_type: "code",
    category_id: "cat-ts",
    category_name: "TypeScript",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: `type ApiResponse = {
  data?: User | Product | Order;
  error?: string;
  type?: string;
};

function processResponse(response: ApiResponse) {
  if (response.type === 'user') {
    const user = response.data as User; // 위험한 타입 단언
    console.log(user.email);
  } else if (response.type === 'product') {
    const product = response.data as Product; // 위험한 타입 단언
    console.log(product.price);
  } else if (response.type === 'order') {
    const order = response.data as Order; // 위험한 타입 단언
    console.log(order.items.length);
  }
}

// 개선 목표: 각 타입에 literal type discriminant 추가,
// is 타입 가드 함수 또는 switch narrowing으로 타입 안전성 확보`,
    is_used: false,
  },
  {
    id: "topic-code-05",
    title: "Promise 병렬 처리 최적화",
    description:
      "아래 코드는 API 요청을 순차적으로 실행해 불필요하게 느립니다. Promise.all과 Promise.allSettled를 적절히 활용해 병렬 처리하고 에러 처리도 개선하세요.",
    mission_type: "code",
    category_id: "cat-js",
    category_name: "JavaScript",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: `async function getDashboardData(userId: string) {
  // 순차 실행: 각 요청이 이전 요청 완료 후 시작
  const user = await fetchUser(userId);         // 200ms
  const posts = await fetchPosts(userId);       // 300ms
  const followers = await fetchFollowers(userId); // 150ms
  const analytics = await fetchAnalytics(userId); // 400ms
  // 총 소요: ~1050ms

  return { user, posts, followers, analytics };
}

// 개선 목표:
// 1. 독립적인 요청들을 병렬로 실행 (~400ms)
// 2. 일부 요청 실패 시 나머지는 정상 반환
// 3. 각 요청의 실패를 개별적으로 처리`,
    is_used: false,
  },
  {
    id: "topic-code-06",
    title: "커스텀 훅으로 로직 추출 및 재사용",
    description:
      "아래 두 컴포넌트에 중복된 fetch 로직이 있습니다. 제네릭 타입을 지원하는 useFetch 커스텀 훅을 만들어 중복을 제거하고, 로딩·에러·취소 처리를 포함하세요.",
    mission_type: "code",
    category_id: "cat-react",
    category_name: "React",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: `// 컴포넌트 1: 중복 로직
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(\`/api/users/\${userId}\`)
      .then(r => r.json())
      .then(data => { setUser(data); setLoading(false); })
      .catch(err => { setError(err); setLoading(false); });
  }, [userId]);

  if (loading) return <Spinner />;
  if (error) return <Error message={error.message} />;
  return <div>{user?.name}</div>;
}

// 컴포넌트 2: 동일한 중복 로직
function ProductDetail({ productId }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(\`/api/products/\${productId}\`)
      .then(r => r.json())
      .then(data => { setProduct(data); setLoading(false); })
      .catch(err => { setError(err); setLoading(false); });
  }, [productId]);

  if (loading) return <Spinner />;
  if (error) return <Error message={error.message} />;
  return <div>{product?.name}</div>;
}`,
    is_used: false,
  },
  {
    id: "topic-code-07",
    title: "메모리 누수 찾기 및 수정",
    description:
      "아래 컴포넌트들에 3가지 메모리 누수가 있습니다. 각 누수의 원인을 설명하고 cleanup 함수를 사용해 수정하세요.",
    mission_type: "code",
    category_id: "cat-react",
    category_name: "React",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: `function DataPolling({ url }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    // 누수 1: setInterval cleanup 없음
    const interval = setInterval(async () => {
      const res = await fetch(url);
      const json = await res.json();
      setData(json); // 언마운트 후에도 setState 호출
    }, 5000);
  }, [url]);

  return <div>{JSON.stringify(data)}</div>;
}

function EventTracker() {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // 누수 2: removeEventListener 없음
    window.addEventListener('mousemove', (e) => {
      setPosition({ x: e.clientX, y: e.clientY });
    });
  }, []);

  return <div>({position.x}, {position.y})</div>;
}

function WebSocketComponent({ roomId }) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // 누수 3: WebSocket close 없음
    const ws = new WebSocket(\`wss://chat.example.com/\${roomId}\`);
    ws.onmessage = (e) => {
      setMessages(prev => [...prev, JSON.parse(e.data)]);
    };
  }, [roomId]);

  return <div>{messages.length} messages</div>;
}`,
    is_used: false,
  },
  {
    id: "topic-code-08",
    title: "Context API 성능 문제 해결",
    description:
      "아래 Context 구현은 value의 일부만 사용하는 컴포넌트도 전체 상태 변경 시 리렌더링됩니다. Context 분리 또는 useMemo를 사용해 불필요한 리렌더링을 방지하세요.",
    mission_type: "code",
    category_id: "cat-react",
    category_name: "React",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: `// 단일 Context에 너무 많은 상태
const AppContext = createContext(null);

function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [notifications, setNotifications] = useState([]);
  const [cart, setCart] = useState([]);

  // 매 렌더마다 새 객체 생성 → 모든 Consumer 리렌더링
  const value = {
    user, setUser,
    theme, setTheme,
    notifications, setNotifications,
    cart, setCart,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// theme만 필요하지만 cart 변경 시에도 리렌더링됨
function ThemeToggle() {
  const { theme, setTheme } = useContext(AppContext);
  console.log('ThemeToggle rendered');
  return <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>{theme}</button>;
}

// cart만 필요하지만 user 변경 시에도 리렌더링됨
function CartBadge() {
  const { cart } = useContext(AppContext);
  console.log('CartBadge rendered');
  return <span>{cart.length}</span>;
}`,
    is_used: false,
  },
  {
    id: "topic-code-09",
    title: "배열 렌더링의 key prop 문제 및 수정",
    description:
      "아래 코드들에서 key prop 관련 문제를 찾고, 각각 왜 문제가 되는지 설명한 뒤 올바르게 수정하세요. 또한 key를 index로 사용하면 안 되는 경우를 예시로 보여주세요.",
    mission_type: "code",
    category_id: "cat-react",
    category_name: "React",
    difficulty: "easy",
    source_type: "generated",
    code_snippet: `// 케이스 1: index를 key로 사용 (재정렬/삭제 시 버그)
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map((todo, index) => (
        <TodoItem key={index} todo={todo} />  {/* ❌ */}
      ))}
    </ul>
  );
}

// 케이스 2: 중복 key (형제 간 유니크해야 함)
function CategoryList({ categories }) {
  return (
    <>
      <h2>Featured</h2>
      {featured.map(c => <Category key={c.id} {...c} />)}
      <h2>All</h2>
      {all.map(c => <Category key={c.id} {...c} />)}  {/* id가 겹칠 수 있음 */}
    </>
  );
}

// 케이스 3: key에 Math.random() 사용 (매 렌더마다 새 key)
function NotificationList({ items }) {
  return (
    <div>
      {items.map(item => (
        <Notification key={Math.random()} message={item.message} />  {/* ❌ */}
      ))}
    </div>
  );
}`,
    is_used: false,
  },
  {
    id: "topic-code-10",
    title: "Redux 불변성 위반 수정 및 Immer 적용",
    description:
      "아래 Redux reducer들은 상태를 직접 변경(mutate)해 React의 변경 감지를 깨뜨립니다. 각 케이스의 문제를 설명하고 올바른 불변 업데이트로 수정하세요. 그리고 Immer를 사용한 버전도 작성하세요.",
    mission_type: "code",
    category_id: "cat-state",
    category_name: "상태관리",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: `// 불변성을 위반하는 reducer들
const cartReducer = (state = { items: [], total: 0 }, action) => {
  switch (action.type) {
    case 'ADD_ITEM':
      state.items.push(action.payload);  // ❌ 직접 push
      state.total += action.payload.price;  // ❌ 직접 수정
      return state;  // 동일 참조 반환 → React 변경 미감지

    case 'REMOVE_ITEM':
      const idx = state.items.findIndex(i => i.id === action.payload);
      state.items.splice(idx, 1);  // ❌ splice는 원본 변경
      return state;

    case 'UPDATE_QUANTITY':
      const item = state.items.find(i => i.id === action.payload.id);
      item.quantity = action.payload.quantity;  // ❌ 중첩 객체 직접 수정
      return state;

    default:
      return state;
  }
};`,
    is_used: false,
  },
  {
    id: "topic-code-11",
    title: "비동기 에러 경계(Error Boundary) 구현",
    description:
      "React의 Error Boundary는 비동기 에러를 잡지 못합니다. 아래 클래스형 Error Boundary를 개선하고, 비동기 에러도 처리할 수 있도록 커스텀 훅과 함께 완전한 에러 처리 솔루션을 구현하세요.",
    mission_type: "code",
    category_id: "cat-react",
    category_name: "React",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: `// 불완전한 Error Boundary
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  // 동기 렌더 에러만 잡음
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;  // 에러 정보 없음, 재시도 불가
    }
    return this.props.children;
  }
}

// 이 에러는 Error Boundary가 잡지 못함
function AsyncComponent() {
  const [data, setData] = useState(null);

  const handleClick = async () => {
    const res = await fetch('/api/data');  // 실패해도 Error Boundary 미동작
    const json = await res.json();
    setData(json);
  };

  return <button onClick={handleClick}>Load</button>;
}

// 개선 목표:
// 1. 에러 상세 정보 표시 + 재시도 버튼
// 2. 비동기 에러를 Error Boundary로 전파하는 useAsyncError 훅
// 3. 에러 리포팅(Sentry 등) 연동 포인트`,
    is_used: false,
  },
  {
    id: "topic-code-12",
    title: "디바운스/쓰로틀 구현과 React 통합",
    description:
      "아래 검색 컴포넌트는 키 입력마다 API를 호출합니다. debounce 함수를 직접 구현하고, React에서 useRef를 사용해 올바르게 통합하세요. useDebounce 커스텀 훅도 작성하세요.",
    mission_type: "code",
    category_id: "cat-js",
    category_name: "JavaScript",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: `// 최적화 전: 키 입력마다 API 호출
function SearchInput() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleChange = async (e) => {
    const value = e.target.value;
    setQuery(value);
    // 매 keystroke마다 API 호출 - 과도한 요청
    const res = await fetch(\`/api/search?q=\${value}\`);
    const data = await res.json();
    setResults(data);
  };

  return (
    <div>
      <input value={query} onChange={handleChange} />
      <ul>{results.map(r => <li key={r.id}>{r.title}</li>)}</ul>
    </div>
  );
}

// 개선 목표:
// 1. debounce(fn, delay) 함수 직접 구현
// 2. useDebounce(value, delay) 커스텀 훅 구현
// 3. 컴포넌트 리렌더 시 debounce 타이머가 리셋되지 않도록 useRef 활용
// 4. 컴포넌트 언마운트 시 타이머 클리어`,
    is_used: false,
  },
  {
    id: "topic-code-13",
    title: "Next.js API Route 보안 취약점 수정",
    description:
      "아래 Next.js API Route에는 여러 보안 취약점이 있습니다. 각 취약점을 찾아 설명하고 안전한 코드로 수정하세요.",
    mission_type: "code",
    category_id: "cat-nextjs",
    category_name: "Next.js",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: `// pages/api/user/[id].ts
export default async function handler(req, res) {
  // 취약점 1: 인증 없음 - 누구나 모든 유저 데이터 접근 가능
  const { id } = req.query;

  // 취약점 2: SQL Injection 가능 (파라미터 미검증)
  const user = await db.query(\`SELECT * FROM users WHERE id = \${id}\`);

  // 취약점 3: 민감 정보 노출 (password hash 포함)
  res.json(user);

  // 취약점 4: HTTP 메서드 미구분 (GET/POST/DELETE 동일 처리)
  if (req.method === 'POST') {
    // 취약점 5: CSRF 보호 없음
    const { email, role } = req.body;
    // 취약점 6: 권한 확인 없이 role 변경 가능
    await db.query(\`UPDATE users SET email='\${email}', role='\${role}' WHERE id=\${id}\`);
    res.json({ success: true });
  }
}`,
    is_used: false,
  },
  {
    id: "topic-code-14",
    title: "가상 스크롤(Virtual Scroll) 구현",
    description:
      "10만 개의 아이템을 렌더링하는 아래 컴포넌트는 브라우저를 멈춥니다. Intersection Observer 또는 고정 높이 가상 스크롤을 직접 구현해 최적화하세요.",
    mission_type: "code",
    category_id: "cat-rendering",
    category_name: "렌더링 최적화",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: `// 문제: 100,000개 DOM 노드 생성 → 브라우저 멈춤
function HugeList({ items }) {
  // items.length = 100,000
  return (
    <div style={{ height: '600px', overflow: 'auto' }}>
      {items.map(item => (
        <div
          key={item.id}
          style={{ height: '50px', borderBottom: '1px solid #eee' }}
        >
          {item.title}
        </div>
      ))}
    </div>
  );
}

// 개선 목표:
// 1. 화면에 보이는 아이템만 렌더링 (뷰포트 기준 ±buffer)
// 2. 스크롤 위치에 따라 동적으로 렌더링 범위 계산
// 3. 스크롤 컨테이너의 전체 높이는 유지 (스크롤바 정상 동작)
// 4. 각 아이템 높이: 50px 고정`,
    is_used: false,
  },
  {
    id: "topic-code-15",
    title: "TypeScript 유틸리티 타입 직접 구현",
    description:
      "TypeScript 내장 유틸리티 타입을 직접 구현하세요. 각 구현의 동작 원리를 주석으로 설명하고, 응용 타입도 만들어보세요.",
    mission_type: "code",
    category_id: "cat-ts",
    category_name: "TypeScript",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: `// 직접 구현해야 할 유틸리티 타입들
// (내장 타입을 사용하지 말고 mapped types, conditional types으로 구현)

// 1. MyPartial<T> - 모든 속성을 optional로
type MyPartial<T> = /* TODO */;

// 2. MyRequired<T> - 모든 속성을 required로
type MyRequired<T> = /* TODO */;

// 3. MyReadonly<T> - 모든 속성을 readonly로
type MyReadonly<T> = /* TODO */;

// 4. MyPick<T, K> - T에서 K 키만 선택
type MyPick<T, K extends keyof T> = /* TODO */;

// 5. MyOmit<T, K> - T에서 K 키 제외
type MyOmit<T, K extends keyof T> = /* TODO */;

// 6. MyReturnType<T> - 함수의 반환 타입 추출
type MyReturnType<T extends (...args: any) => any> = /* TODO */;

// 7. DeepPartial<T> - 중첩 객체까지 모두 optional (응용)
type DeepPartial<T> = /* TODO */;

// 테스트용 타입
type User = {
  id: number;
  name: string;
  address: {
    city: string;
    country: string;
  };
};`,
    is_used: false,
  },
  {
    id: "topic-code-16",
    title: "React 폼 상태 관리 최적화",
    description:
      "아래 폼은 각 필드 입력 시 전체 폼이 리렌더링됩니다. 비제어 컴포넌트 또는 상태 분리를 활용해 최적화하고, 유효성 검사도 효율적으로 구현하세요.",
    mission_type: "code",
    category_id: "cat-react",
    category_name: "React",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: `// 문제: 단일 객체 상태로 관리 → 한 필드 변경 시 전체 리렌더
function RegistrationForm() {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    bio: '',
    website: '',
    // ... 10개 이상의 필드
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    // 매번 새 객체 생성 → 모든 필드 컴포넌트 리렌더
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 유효성 검사 없이 바로 제출
    submitForm(form);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={form.username} onChange={handleChange('username')} />
      <input value={form.email} onChange={handleChange('email')} />
      <input value={form.password} onChange={handleChange('password')} />
      {/* ... more fields */}
      <button type="submit">Register</button>
    </form>
  );
}`,
    is_used: false,
  },
  {
    id: "topic-code-17",
    title: "Intersection Observer로 무한 스크롤 구현",
    description:
      "scroll 이벤트 기반의 아래 구현을 Intersection Observer API를 사용해 리팩토링하고, 로딩 상태·에러 처리·중복 요청 방지를 포함한 완전한 무한 스크롤을 구현하세요.",
    mission_type: "code",
    category_id: "cat-browser",
    category_name: "브라우저 API",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: `// 성능 문제가 있는 scroll 이벤트 기반 구현
function InfiniteList() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handleScroll = () => {
      // 매 스크롤 이벤트마다 실행 (throttle 없음)
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        setPage(p => p + 1);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // 중복 요청 방지 없음
    fetch(\`/api/items?page=\${page}\`)
      .then(r => r.json())
      .then(data => setItems(prev => [...prev, ...data]));
  }, [page]);

  return <div>{items.map(item => <Item key={item.id} {...item} />)}</div>;
}`,
    is_used: false,
  },
  {
    id: "topic-code-18",
    title: "웹 워커(Web Worker)로 메인 스레드 블로킹 해결",
    description:
      "아래 코드는 대용량 데이터 처리로 UI가 멈춥니다. Web Worker를 사용해 무거운 계산을 별도 스레드로 분리하고, Comlink 또는 직접 postMessage API를 사용해 구현하세요.",
    mission_type: "code",
    category_id: "cat-browser",
    category_name: "브라우저 API",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: `// 문제: 메인 스레드에서 무거운 계산 → UI 멈춤
function DataProcessor() {
  const [result, setResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const processData = (rawData: number[]) => {
    setIsProcessing(true);
    // 이 동안 UI가 완전히 멈춤 (수백ms ~ 수초)
    const processed = rawData
      .filter(n => n % 2 === 0)
      .map(n => n ** 2)
      .reduce((acc, n) => {
        // 의도적으로 무거운 연산
        for (let i = 0; i < 1000; i++) {
          acc += Math.sqrt(n);
        }
        return acc;
      }, 0);
    setResult(processed);
    setIsProcessing(false);
  };

  const handleProcess = () => {
    const bigData = Array.from({ length: 1_000_000 }, (_, i) => i);
    processData(bigData);
  };

  return (
    <div>
      <button onClick={handleProcess} disabled={isProcessing}>
        {isProcessing ? 'Processing...' : 'Process 1M items'}
      </button>
      {result && <p>Result: {result}</p>}
    </div>
  );
}`,
    is_used: false,
  },
  {
    id: "topic-code-19",
    title: "Node.js 이벤트 루프 블로킹 수정",
    description:
      "아래 Express 서버는 특정 요청에서 이벤트 루프를 블로킹합니다. 각 문제를 찾고 비동기·스트림·worker_threads로 수정해 모든 요청이 응답하도록 개선하세요.",
    mission_type: "code",
    category_id: "cat-node",
    category_name: "Node.js",
    difficulty: "hard",
    source_type: "generated",
    code_snippet: `import express from 'express';
import fs from 'fs';

const app = express();

// 문제 1: 동기 파일 읽기로 이벤트 루프 블로킹
app.get('/config', (req, res) => {
  const config = fs.readFileSync('./config.json', 'utf-8');  // ❌ 동기
  res.json(JSON.parse(config));
});

// 문제 2: CPU 집약적 작업으로 이벤트 루프 블로킹
app.get('/compute', (req, res) => {
  let result = 0;
  // 이 동안 다른 모든 요청 처리 불가
  for (let i = 0; i < 10_000_000_000; i++) {
    result += Math.sqrt(i);
  }
  res.json({ result });
});

// 문제 3: 대용량 파일을 메모리에 전부 로드
app.get('/download', (req, res) => {
  const file = fs.readFileSync('./large-file.csv');  // ❌ 수GB 파일
  res.send(file);
});

app.listen(3000);`,
    is_used: false,
  },
  {
    id: "topic-code-20",
    title: "Zustand 스토어 설계 및 성능 최적화",
    description:
      "아래 Zustand 스토어는 구조적 문제로 불필요한 리렌더링이 발생합니다. 셀렉터 최적화, 스토어 분리, shallow 비교를 활용해 리팩토링하고 타입 안전성도 개선하세요.",
    mission_type: "code",
    category_id: "cat-state",
    category_name: "상태관리",
    difficulty: "medium",
    source_type: "generated",
    code_snippet: `// 문제가 있는 단일 거대 스토어
const useStore = create((set) => ({
  // 서로 관련 없는 상태가 하나의 스토어에
  user: null,
  cart: [],
  theme: 'light',
  notifications: [],
  searchQuery: '',
  searchResults: [],
  isLoading: false,

  setUser: (user) => set({ user }),
  addToCart: (item) => set((state) => ({ cart: [...state.cart, item] })),
  setTheme: (theme) => set({ theme }),
  // ...
}));

// 문제: 스토어 전체를 구독 → cart 변경 시 ThemeToggle도 리렌더
function ThemeToggle() {
  const store = useStore(); // ❌ 전체 스토어 구독
  return <button onClick={() => store.setTheme(t => t === 'light' ? 'dark' : 'light')}>{store.theme}</button>;
}

// 문제: 비교 함수 없이 객체 반환 → 항상 리렌더
function UserAvatar() {
  const { user, notifications } = useStore(); // ❌ 매번 새 구조분해
  return <img src={user?.avatar} />;
}`,
    is_used: false,
  },
];

// ── Weeks ─────────────────────────────────────────────────────────────────
const weekStart = currentWeekMonday();

// ── Missions (first 15 topics: 5 concept, 5 discussion, 5 code) ───────────
const conceptTopics = topics.filter((t) => t.mission_type === "concept").slice(0, 5);
const discussionTopics = topics.filter((t) => t.mission_type === "discussion").slice(0, 5);
const codeTopics = topics.filter((t) => t.mission_type === "code").slice(0, 5);
const missionTopics = [...conceptTopics, ...discussionTopics, ...codeTopics];

// ---------------------------------------------------------------------------
// 5. Seed function
// ---------------------------------------------------------------------------
async function seed() {
  console.log("Starting Firestore seed...\n");

  // ── Categories ──────────────────────────────────────────────────────────
  console.log(`Seeding ${categories.length} categories...`);
  const catBatch = db.batch();
  for (const cat of categories) {
    const ref = db.collection("categories").doc(cat.id);
    catBatch.set(ref, {
      name: cat.name,
      group_name: cat.group_name,
      color: cat.color,
      sort_order: cat.sort_order,
      created_at: now(),
    });
  }
  await catBatch.commit();
  console.log("  ✓ Categories done\n");

  // ── Topics (batched in groups of 500) ───────────────────────────────────
  console.log(`Seeding ${topics.length} topics...`);
  const BATCH_LIMIT = 400;
  for (let i = 0; i < topics.length; i += BATCH_LIMIT) {
    const chunk = topics.slice(i, i + BATCH_LIMIT);
    const topicBatch = db.batch();
    for (const topic of chunk) {
      const ref = db.collection("topics").doc(topic.id);
      topicBatch.set(ref, {
        title: topic.title,
        description: topic.description,
        mission_type: topic.mission_type,
        category_id: topic.category_id,
        category_name: topic.category_name,
        difficulty: topic.difficulty,
        source_type: topic.source_type,
        code_snippet: topic.code_snippet ?? null,
        is_used: topic.is_used,
        created_at: now(),
      });
    }
    await topicBatch.commit();
  }
  console.log("  ✓ Topics done\n");

  // ── Week ─────────────────────────────────────────────────────────────────
  console.log(`Seeding week (${weekStart})...`);
  const weekId = `week-${weekStart}`;
  await db.collection("weeks").doc(weekId).set({
    week_start: weekStart,
    goal_concept: 5,
    goal_discussion: 5,
    goal_code: 5,
    carried_over_count: 0,
    created_at: now(),
  });
  console.log("  ✓ Week done\n");

  // ── Missions ──────────────────────────────────────────────────────────────
  console.log(`Seeding ${missionTopics.length} missions...`);
  const missionBatch = db.batch();
  missionTopics.forEach((topic, idx) => {
    const missionId = `mission-${weekStart}-${topic.id}`;
    const ref = db.collection("missions").doc(missionId);
    missionBatch.set(ref, {
      week_id: weekId,
      topic_id: topic.id,
      mission_type: topic.mission_type,
      status: "pending",
      sort_order: idx + 1,
      is_carried_over: false,
      topic_title: topic.title,
      category_name: topic.category_name,
      created_at: now(),
      completed_at: null,
    });
  });
  await missionBatch.commit();
  console.log("  ✓ Missions done\n");

  // ── Settings ──────────────────────────────────────────────────────────────
  console.log("Seeding settings/global...");
  await db.collection("settings").doc("global").set({
    carry_over_limit: 5,
    weekly_goal_concept: 5,
    weekly_goal_discussion: 5,
    weekly_goal_code: 5,
    pass_score: 80,
    updated_at: now(),
  });
  console.log("  ✓ Settings done\n");

  console.log("Seed complete!");
  console.log(`  categories : ${categories.length}`);
  console.log(`  topics     : ${topics.length}`);
  console.log(`  weeks      : 1  (${weekStart})`);
  console.log(`  missions   : ${missionTopics.length}`);
  console.log(`  settings   : 1  (global)`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
