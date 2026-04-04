"use client";

import { useEffect, useState } from "react";
import { RefreshCw, GitBranch, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WATCHED_REPOS } from "@/lib/github/releases";

interface ReleaseData {
  id: string;
  repo: string;
  tag_name: string;
  release_name: string;
  body_summary: string;
  published_at: string;
  url: string;
  topic_generated: boolean;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "오늘";
  if (d < 7) return `${d}일 전`;
  if (d < 30) return `${Math.floor(d / 7)}주 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function repoShortName(repo: string): string {
  return repo.split("/")[1] ?? repo;
}

export function ReleasesClient() {
  const [releases, setReleases] = useState<ReleaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [repoFilter, setRepoFilter] = useState("");

  useEffect(() => {
    const url = repoFilter
      ? `/api/releases?repo=${encodeURIComponent(repoFilter)}`
      : "/api/releases";
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((data: { items: ReleaseData[] }) => setReleases(data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [repoFilter]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/cron/github");
      const data = (await res.json()) as { added: number };
      toast.success(`${data.added}개 새 릴리즈 발견`);
      // 목록 갱신
      const updated = (await fetch("/api/releases").then((r) => r.json())) as {
        items: ReleaseData[];
      };
      setReleases(updated.items);
    } catch {
      toast.error("릴리즈 수집에 실패했습니다.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <select
          value={repoFilter}
          onChange={(e) => setRepoFilter(e.target.value)}
          className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
        >
          <option value="">전체 repo</option>
          {WATCHED_REPOS.map((r) => (
            <option key={r} value={r}>
              {repoShortName(r)}
            </option>
          ))}
        </select>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          릴리즈 수집
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : releases.length === 0 ? (
        <div className="text-muted-foreground flex h-48 items-center justify-center rounded-lg border border-dashed text-sm">
          <div className="text-center">
            <p>릴리즈 데이터가 없습니다.</p>
            <p className="mt-1 text-xs">수집 버튼을 눌러 최신 릴리즈를 가져오세요.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {releases.map((release) => (
            <Card key={release.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <GitBranch className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {repoShortName(release.repo)}
                      </Badge>
                      <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                        {release.tag_name}
                      </code>
                      <span className="text-muted-foreground text-xs">
                        {timeAgo(release.published_at)}
                      </span>
                      {release.topic_generated && (
                        <Badge variant="secondary" className="text-xs">
                          토픽 생성됨
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium">{release.release_name}</p>
                    {release.body_summary && (
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                        {release.body_summary}
                      </p>
                    )}
                  </div>
                  <a
                    href={release.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
