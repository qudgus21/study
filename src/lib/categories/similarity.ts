import { spawnClaude, parseStreamOutput } from "@/lib/evaluate/claude-runner";

/**
 * 1차: 단어 기반 유사도 — 양쪽 단어 80% 이상 겹치면 유사 판정
 */
function isWordSimilar(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/\s+/g, "");
  const nb = b.toLowerCase().replace(/\s+/g, "");
  if (na === nb) return true;

  const wordsA = a.toLowerCase().split(/\s+/).filter(Boolean);
  const wordsB = b.toLowerCase().split(/\s+/).filter(Boolean);
  if (wordsA.length === 0 || wordsB.length === 0) return false;
  const common = wordsA.filter((w) => wordsB.includes(w)).length;
  return common / wordsA.length >= 0.8 && common / wordsB.length >= 0.8;
}

/**
 * 2차: AI 유사도 검증
 */
async function aiSimilarityCheck(
  candidates: string[],
  existingNames: string[],
): Promise<Set<string>> {
  if (candidates.length === 0 || existingNames.length === 0) return new Set();

  const prompt = `당신은 학습 카테고리 중복 검사기입니다.

## 기존 카테고리
${existingNames.map((n) => `- ${n}`).join("\n")}

## 새 후보
${candidates.map((n) => `- ${n}`).join("\n")}

## 작업
새 후보 중 기존 카테고리와 **사실상 같은 주제**인 것만 찾아주세요.
- "웹 성능 최적화"와 "프론트엔드 성능 튜닝"은 사실상 같음 → 중복
- "브라우저 렌더링 파이프라인"과 "브라우저 렌더링 최적화"는 관련 있지만 다른 주제 → 중복 아님
- "React 상태관리"와 "프론트엔드 상태관리 패턴"은 범위가 다름 → 중복 아님

엄격하게 판단하세요. 애매하면 중복이 아닙니다.

## 출력
중복인 후보 이름만 JSON 배열로 출력하세요. 중복이 없으면 빈 배열 \`[]\`을 출력하세요.
\`\`\`json
["중복인 후보1", "중복인 후보2"]
\`\`\``;

  try {
    const proc = spawnClaude({ agentName: "default", prompt, timeoutMs: 30_000 });
    let fullText = "";
    for await (const event of parseStreamOutput(proc, 30_000)) {
      if (event.type === "text" && event.content) fullText += event.content;
    }

    const match = fullText.match(/\[[\s\S]*?\]/);
    if (!match) return new Set();
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((s: string) => s.toLowerCase()));
  } catch {
    return new Set();
  }
}

export type SimilarityLog = (message: string) => void;

/**
 * 후보 카테고리 이름 목록에서 기존 카테고리와 중복/유사한 것을 제거하여 반환
 * 1차 단어 비교 → 2차 AI 검증
 */
export async function filterSimilarCategories(
  candidates: string[],
  existingNames: string[],
  log?: SimilarityLog,
): Promise<Set<string>> {
  const duplicates = new Set<string>();

  // 1차: 단어 기반 필터
  log?.("1차 유사도 검증 (단어 비교)...");
  for (const candidate of candidates) {
    if (existingNames.some((n) => isWordSimilar(n, candidate))) {
      duplicates.add(candidate.toLowerCase());
      log?.(`  ⚠ "${candidate}" — 기존 카테고리와 단어 유사 → 스킵`);
    }
  }

  // 1차 통과한 후보만 2차 AI 검증
  const passedFirstCheck = candidates.filter((c) => !duplicates.has(c.toLowerCase()));
  if (passedFirstCheck.length > 0 && existingNames.length > 0) {
    log?.(`2차 유사도 검증 (AI 판단) — ${passedFirstCheck.length}개 후보...`);
    const aiDuplicates = await aiSimilarityCheck(passedFirstCheck, existingNames);
    for (const d of aiDuplicates) {
      duplicates.add(d);
      log?.(`  ⚠ "${d}" — AI가 기존 카테고리와 유사 판정 → 스킵`);
    }
    if (aiDuplicates.size === 0) {
      log?.("  AI 유사도 검증 통과 — 중복 없음");
    }
  }

  return duplicates;
}
