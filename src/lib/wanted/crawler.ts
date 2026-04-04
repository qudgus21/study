import { extractSkills } from "./skill-extractor";

export interface WantedJob {
  wanted_id: string;
  company_name: string;
  position_title: string;
  required_skills: string[];
  preferred_skills: string[];
  experience_range: string;
  raw_description: string;
  url: string;
}

const BASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  Referer: "https://www.wanted.co.kr/",
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface WantedListItem {
  id: number;
  position: {
    title: string;
    name: string;
    experience_level?: { name?: string };
  };
  company: { name: string };
}

interface WantedDetailData {
  id: number;
  position: {
    title: string;
    name?: string;
    experience_level?: { name?: string };
    required_experience_years?: string;
    tasks?: string;
    requirements?: string;
    preferred_points?: string;
  };
  company: { name: string };
  skill_tags?: Array<{ title: string; category?: string }>;
}

/**
 * 원티드 프론트엔드 JD 목록을 가져온다.
 * tag_type_ids=518 = 프론트엔드 개발자
 */
export async function fetchWantedJobs(limit = 20): Promise<WantedJob[]> {
  const jobs: WantedJob[] = [];

  try {
    const listUrl =
      `https://www.wanted.co.kr/api/chaos/jobs/v1/fetch-jobs-by-filter` +
      `?country=kr&job_sort=job.latest_order&years=-1&locations=all` +
      `&tag_type_ids=518&limit=${limit}&offset=0`;

    const listRes = await fetch(listUrl, {
      headers: BASE_HEADERS,
      signal: AbortSignal.timeout(15_000),
    });

    if (!listRes.ok) {
      console.warn(`Wanted list fetch failed: ${listRes.status}`);
      return [];
    }

    const listData = (await listRes.json()) as { data?: { jobs?: WantedListItem[] } };
    const items: WantedListItem[] = listData?.data?.jobs ?? [];

    for (const item of items.slice(0, limit)) {
      // IP 밴 방지: 요청 사이 500ms 대기
      await sleep(500);

      try {
        const detailUrl = `https://www.wanted.co.kr/api/chaos/jobs/v1/${item.id}`;
        const detailRes = await fetch(detailUrl, {
          headers: BASE_HEADERS,
          signal: AbortSignal.timeout(10_000),
        });

        if (!detailRes.ok) continue;

        const detail = (await detailRes.json()) as { job?: WantedDetailData };
        const job = detail?.job;
        if (!job) continue;

        const pos = job.position;
        const fullText = [pos.tasks ?? "", pos.requirements ?? "", pos.preferred_points ?? ""].join(
          " ",
        );

        // skill_tags에서 우선 추출, 없으면 텍스트 추출
        const tagSkills = (job.skill_tags ?? []).map((t) => t.title);
        const textSkills = extractSkills(fullText);
        const allSkills = [...new Set([...tagSkills, ...textSkills])];

        // required/preferred 분리 (태그 없으면 모두 required로)
        const requiredSkills = tagSkills.length > 0 ? tagSkills : allSkills;
        const preferredSkills =
          tagSkills.length > 0 ? textSkills.filter((s) => !tagSkills.includes(s)) : [];

        jobs.push({
          wanted_id: String(job.id),
          company_name: job.company?.name ?? "",
          position_title: pos.title ?? pos.name ?? "",
          required_skills: requiredSkills,
          preferred_skills: preferredSkills,
          experience_range: pos.experience_level?.name ?? pos.required_experience_years ?? "",
          raw_description: fullText.slice(0, 2000),
          url: `https://www.wanted.co.kr/wd/${job.id}`,
        });
      } catch (err) {
        console.warn(`Wanted detail fetch error for ${item.id}:`, err);
      }
    }
  } catch (err) {
    console.warn("Wanted crawler error:", err);
  }

  return jobs;
}
