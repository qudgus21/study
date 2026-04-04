import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { WATCHED_REPOS, fetchLatestRelease } from "@/lib/github/releases";

/**
 * GET /api/cron/github
 * 9개 repo의 최신 릴리즈를 확인하고 새 릴리즈 저장 + 알림 + 토픽 자동 생성
 */
export async function GET() {
  const results: { repo: string; status: string }[] = [];

  for (const repo of WATCHED_REPOS) {
    const release = await fetchLatestRelease(repo);
    if (!release) {
      results.push({ repo, status: "fetch_failed" });
      continue;
    }

    // 이미 저장된 릴리즈인지 확인 (repo + tag_name 복합)
    const existing = await adminDb
      .collection("github_releases")
      .where("repo", "==", repo)
      .where("tag_name", "==", release.tag_name)
      .limit(1)
      .get();

    if (!existing.empty) {
      results.push({ repo, status: "already_exists" });
      continue;
    }

    const now = new Date().toISOString();

    // 릴리즈 저장
    const docRef = await adminDb.collection("github_releases").add({
      ...release,
      topic_generated: false,
      created_at: now,
    });

    // 알림 생성
    await adminDb.collection("notifications").add({
      type: "release",
      title: `새 릴리즈: ${repo}`,
      body: `${release.release_name} (${release.tag_name})`,
      ref_url: release.url,
      is_read: false,
      created_at: now,
    });

    // 토픽 자동 생성 (릴리즈 → 개념 학습 토픽)
    const repoShortName = repo.split("/")[1] ?? repo;
    await adminDb.collection("topics").add({
      title: `${repoShortName} ${release.tag_name} 릴리즈 변경사항 분석`,
      description:
        release.body_summary ||
        `${repo} 최신 릴리즈 ${release.tag_name}의 주요 변경사항을 분석하세요.`,
      mission_type: "concept",
      category_id: null,
      category_name: repoShortName,
      difficulty: "intermediate",
      source_type: "github",
      source_ref: release.url,
      code_snippet: null,
      is_used: false,
      created_at: now,
    });

    await docRef.update({ topic_generated: true });
    results.push({ repo, status: "added" });
  }

  const added = results.filter((r) => r.status === "added").length;
  return NextResponse.json({ ok: true, added, results });
}
