import { spawnClaude, parseStreamOutput } from "@/lib/evaluate/claude-runner";

/**
 * AI 분석 결과 인터페이스
 */
export interface JdInsight {
  collected_date: string;
  total_jds: number;
  /** 역량/소프트스킬 (커뮤니케이션, 리더십, 문제해결 등) */
  competencies: Array<{ name: string; count: number; examples: string[] }>;
  /** 주요 업무 패턴 (설계, 코드리뷰, 성능최적화 등) */
  responsibilities: Array<{ name: string; count: number; description: string }>;
  /** 자격요건 패턴 (기술 외) */
  qualifications: Array<{ name: string; count: number; description: string }>;
  /** 우대사항 패턴 */
  preferred: Array<{ name: string; count: number; description: string }>;
  /** 팀/조직 문화 키워드 */
  culture: Array<{ name: string; count: number; description: string }>;
  /** 도메인/산업 분포 */
  domains: Array<{ name: string; count: number; companies: string[] }>;
  /** 종합 인사이트 (자유 텍스트) */
  summary: string;
}

/** 배치 분석용 중간 결과 (examples/companies 없이 가벼운 형태) */
interface BatchResult {
  competencies: Array<{ name: string; count: number; examples: string[] }>;
  responsibilities: Array<{ name: string; count: number; description: string }>;
  qualifications: Array<{ name: string; count: number; description: string }>;
  preferred: Array<{ name: string; count: number; description: string }>;
  culture: Array<{ name: string; count: number; description: string }>;
  domains: Array<{ name: string; count: number; companies: string[] }>;
}

const BATCH_SIZE = 50;

function buildBatchPrompt(
  jds: Array<{ company_name: string; position_title: string; raw_description: string }>,
  batchIndex: number,
  totalBatches: number,
): string {
  const jdTexts = jds
    .map(
      (jd, i) =>
        `--- JD #${i + 1}: ${jd.company_name} / ${jd.position_title} ---\n${jd.raw_description}`,
    )
    .join("\n\n");

  return `당신은 채용 시장 분석 전문가입니다.
아래는 원티드에서 수집한 프론트엔드 시니어(5년+) 채용공고 배치 ${batchIndex}/${totalBatches} (${jds.length}개)입니다.

이 JD들을 분석하여 **기술 스택을 제외한** 다음 항목들을 추출해주세요.
각 항목은 이 배치 내에서 언급되는 패턴을 찾아 빈도(count)와 함께 정리합니다.

## 추출 항목

### 1. competencies (역량/소프트스킬)
기술 스택이 아닌 **인적 역량**을 추출합니다.
예: 커뮤니케이션 능력, 문제 해결력, 자기주도성, 멘토링/코칭, 기술적 의사결정, 크로스펑셔널 협업, 문서화 능력, 코드 품질에 대한 오너십 등
- name: 역량명 (짧고 명확하게, 다른 배치와 합산할 수 있도록 일반적인 명칭 사용)
- count: 해당 역량이 언급된 JD 수
- examples: 실제 JD에서 관련 문구 2-3개 (원문 인용)

### 2. responsibilities (주요 업무 패턴)
시니어 프론트엔드 개발자에게 기대하는 **업무 범위**를 추출합니다.
예: 아키텍처 설계, 코드 리뷰, 성능 최적화, 모니터링/장애 대응, 주니어 멘토링, 기술 스택 선정, 디자인 시스템 구축, A/B 테스팅, 접근성 개선 등
- name: 업무명
- count: 해당 업무가 언급된 JD 수
- description: 구체적으로 어떤 수준/범위의 업무인지 1문장

### 3. qualifications (자격요건 패턴 - 기술 외)
기술 스택 나열이 아닌, **경험/역량 기반 자격요건**을 추출합니다.
예: 대규모 트래픽 서비스 경험, 레거시 마이그레이션 경험, 0→1 프로덕트 구축 경험, B2B/B2C 서비스 경험, 오픈소스 기여, CS 전공 등
- name: 요건명
- count: 해당 요건이 언급된 JD 수
- description: 구체적 맥락 1문장

### 4. preferred (우대사항 패턴)
우대사항에서 반복적으로 등장하는 항목을 추출합니다.
예: 테크 블로그/발표 경험, 오픈소스 컨트리뷰션, MSA 경험, 모노레포 경험, SSR/SSG 경험, 디자인 시스템 경험, CI/CD 파이프라인 구축 경험 등
- name: 우대항목명
- count: 언급된 JD 수
- description: 구체적 맥락 1문장

### 5. culture (팀/조직 문화 키워드)
JD에서 드러나는 **팀 문화, 일하는 방식**을 추출합니다.
예: 애자일/스크럼, 코드 리뷰 문화, 자율 출퇴근, 페어 프로그래밍, 스쿼드 조직, 수평적 문화, 빠른 배포 주기 등
- name: 문화 키워드
- count: 언급된 JD 수
- description: 어떤 맥락에서 언급되는지 1문장

### 6. domains (도메인/산업 분포)
채용 회사들의 **산업/도메인**을 분류합니다.
예: 핀테크, 이커머스, 헬스케어, 에드테크, SaaS, 모빌리티, 콘텐츠/미디어, AI/ML 등
- name: 도메인명
- count: 해당 도메인의 JD 수
- companies: 대표 회사명 최대 5개

## 출력 형식
반드시 아래 JSON만 출력하세요. 다른 텍스트는 포함하지 마세요.
각 배열은 count 내림차순으로 정렬해주세요.

\`\`\`json
{
  "competencies": [{ "name": "...", "count": 0, "examples": ["...", "..."] }],
  "responsibilities": [{ "name": "...", "count": 0, "description": "..." }],
  "qualifications": [{ "name": "...", "count": 0, "description": "..." }],
  "preferred": [{ "name": "...", "count": 0, "description": "..." }],
  "culture": [{ "name": "...", "count": 0, "description": "..." }],
  "domains": [{ "name": "...", "count": 0, "companies": ["..."] }]
}
\`\`\`

## JD 데이터
${jdTexts}`;
}

function buildMergePrompt(batchResults: BatchResult[], totalJds: number): string {
  const batchJson = JSON.stringify(batchResults, null, 2);

  return `당신은 채용 시장 분석 전문가입니다.
프론트엔드 시니어(5년+) 채용공고 총 ${totalJds}개를 ${batchResults.length}개 배치로 나누어 분석한 중간 결과입니다.

이 배치 결과들을 **병합**하여 최종 인사이트를 생성해주세요.

## 병합 규칙
- 같은 의미의 항목은 하나로 합치고 count를 합산 (예: "커뮤니케이션 능력"과 "소통 능력"은 하나로)
- examples는 가장 대표적인 2-3개만 선별
- companies는 중복 제거 후 최대 5개
- description은 가장 구체적인 것을 선택
- 각 배열은 합산된 count 내림차순 정렬
- **summary**: 병합된 전체 데이터를 바탕으로 시니어 프론트엔드 개발자 채용 시장의 핵심 트렌드와 시사점을 3-5문장으로 작성. 이직 준비 중인 10년차 프론트엔드 개발자에게 실질적으로 도움이 되는 인사이트를 담아주세요.

## 배치 분석 결과
${batchJson}

## 출력 형식
반드시 아래 JSON만 출력하세요.

\`\`\`json
{
  "competencies": [{ "name": "...", "count": 0, "examples": ["...", "..."] }],
  "responsibilities": [{ "name": "...", "count": 0, "description": "..." }],
  "qualifications": [{ "name": "...", "count": 0, "description": "..." }],
  "preferred": [{ "name": "...", "count": 0, "description": "..." }],
  "culture": [{ "name": "...", "count": 0, "description": "..." }],
  "domains": [{ "name": "...", "count": 0, "companies": ["..."] }],
  "summary": "..."
}
\`\`\``;
}

async function callClaude(
  prompt: string,
  onLog?: (msg: string) => void,
): Promise<Record<string, unknown> | null> {
  const proc = spawnClaude({ agentName: "default", prompt, timeoutMs: 300_000 });

  let fullText = "";
  for await (const event of parseStreamOutput(proc, 300_000)) {
    if (event.type === "text" && event.content) fullText += event.content;
    if (event.type === "error") {
      onLog?.(`AI 오류: ${event.message}`);
      return null;
    }
  }

  const jsonMatch = fullText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    onLog?.("AI 응답에서 JSON을 찾을 수 없습니다.");
    return null;
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    onLog?.("AI 응답 JSON 파싱 실패");
    return null;
  }
}

/**
 * 수집된 JD들을 배치로 나누어 로컬 Claude에 분석시키고 결과를 병합한다.
 */
export async function analyzeJds(
  jds: Array<{ company_name: string; position_title: string; raw_description: string }>,
  onLog?: (msg: string) => void,
): Promise<JdInsight | null> {
  if (jds.length === 0) return null;

  const batches: Array<typeof jds> = [];
  for (let i = 0; i < jds.length; i += BATCH_SIZE) {
    batches.push(jds.slice(i, i + BATCH_SIZE));
  }

  onLog?.(`${jds.length}개 JD → ${batches.length}개 배치로 분석 시작`);

  // 1단계: 배치별 분석
  const batchResults: BatchResult[] = [];

  for (let i = 0; i < batches.length; i++) {
    onLog?.(`배치 ${i + 1}/${batches.length} 분석 중... (${batches[i].length}개 JD)`);
    const prompt = buildBatchPrompt(batches[i], i + 1, batches.length);
    const result = await callClaude(prompt, onLog);

    if (result) {
      batchResults.push({
        competencies: (result.competencies as BatchResult["competencies"]) ?? [],
        responsibilities: (result.responsibilities as BatchResult["responsibilities"]) ?? [],
        qualifications: (result.qualifications as BatchResult["qualifications"]) ?? [],
        preferred: (result.preferred as BatchResult["preferred"]) ?? [],
        culture: (result.culture as BatchResult["culture"]) ?? [],
        domains: (result.domains as BatchResult["domains"]) ?? [],
      });
      onLog?.(`배치 ${i + 1} 완료`);
    } else {
      onLog?.(`배치 ${i + 1} 실패 — 건너뜀`);
    }
  }

  if (batchResults.length === 0) {
    onLog?.("모든 배치 분석 실패");
    return null;
  }

  // 배치가 1개면 병합 단계 생략
  let finalResult: Record<string, unknown> | null;

  if (batchResults.length === 1) {
    onLog?.("배치 1개 — 종합 인사이트 생성 중...");
    const summaryPrompt = buildMergePrompt(batchResults, jds.length);
    finalResult = await callClaude(summaryPrompt, onLog);
  } else {
    // 2단계: 병합
    onLog?.(`${batchResults.length}개 배치 결과 병합 중...`);
    const mergePrompt = buildMergePrompt(batchResults, jds.length);
    finalResult = await callClaude(mergePrompt, onLog);
  }

  if (!finalResult) {
    onLog?.("병합 실패");
    return null;
  }

  onLog?.("분석 완료");

  return {
    collected_date: new Date().toISOString().split("T")[0],
    total_jds: jds.length,
    competencies: (finalResult.competencies as JdInsight["competencies"]) ?? [],
    responsibilities: (finalResult.responsibilities as JdInsight["responsibilities"]) ?? [],
    qualifications: (finalResult.qualifications as JdInsight["qualifications"]) ?? [],
    preferred: (finalResult.preferred as JdInsight["preferred"]) ?? [],
    culture: (finalResult.culture as JdInsight["culture"]) ?? [],
    domains: (finalResult.domains as JdInsight["domains"]) ?? [],
    summary: (finalResult.summary as string) ?? "",
  };
}
