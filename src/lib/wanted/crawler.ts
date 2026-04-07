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
  position: string;
  company: { name: string };
  annual_from?: number;
  annual_to?: number;
}

interface WantedDetailJob {
  id: number;
  position: string;
  detail: {
    main_tasks?: string;
    requirements?: string;
    preferred_points?: string;
    intro?: string;
  };
  company: { name: string };
  skill_tags?: Array<{ title: string; kind_title?: string }>;
  annual_from?: number;
  annual_to?: number;
}

/**
 * 원티드 프론트엔드 JD 목록을 가져온다.
 * tag_type_ids=669 = 프론트엔드 개발자
 */
export async function fetchWantedJobs(limit = 20): Promise<WantedJob[]> {
  const jobs: WantedJob[] = [];

  try {
    const listUrl =
      `https://www.wanted.co.kr/api/v4/jobs` +
      `?country=kr&job_sort=job.latest_order&years=-1&locations=all` +
      `&tag_type_ids=669&limit=${limit}&offset=0`;

    const listRes = await fetch(listUrl, {
      headers: BASE_HEADERS,
      signal: AbortSignal.timeout(15_000),
    });

    if (!listRes.ok) {
      console.warn(`Wanted list fetch failed: ${listRes.status}`);
      return [];
    }

    const listData = (await listRes.json()) as { data?: WantedListItem[] };
    const items: WantedListItem[] = listData?.data ?? [];

    for (const item of items.slice(0, limit)) {
      await sleep(500);

      try {
        const detailUrl = `https://www.wanted.co.kr/api/v4/jobs/${item.id}`;
        const detailRes = await fetch(detailUrl, {
          headers: BASE_HEADERS,
          signal: AbortSignal.timeout(10_000),
        });

        if (!detailRes.ok) continue;

        const detailData = (await detailRes.json()) as { job?: WantedDetailJob };
        const job = detailData?.job;
        if (!job) continue;

        const detail = job.detail ?? {};
        const fullText = [
          detail.main_tasks ?? "",
          detail.requirements ?? "",
          detail.preferred_points ?? "",
        ].join(" ");

        // skill_tags에서 SKILL 종류만 추출
        const tagSkills = (job.skill_tags ?? [])
          .filter((t) => t.kind_title === "SKILL")
          .map((t) => t.title);
        const textSkills = extractSkills(fullText);
        const allSkills = [...new Set([...tagSkills, ...textSkills])];

        const requiredSkills = tagSkills.length > 0 ? tagSkills : allSkills;
        const preferredSkills =
          tagSkills.length > 0 ? textSkills.filter((s) => !tagSkills.includes(s)) : [];

        const expRange =
          job.annual_from != null && job.annual_to != null
            ? `${job.annual_from}~${job.annual_to}년`
            : "";

        jobs.push({
          wanted_id: String(job.id),
          company_name: job.company?.name ?? "",
          position_title: job.position ?? "",
          required_skills: requiredSkills,
          preferred_skills: preferredSkills,
          experience_range: expRange,
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
