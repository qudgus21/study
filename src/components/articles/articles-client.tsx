"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArticleCard, type ArticleData } from "./article-card";
import { RSS_SOURCES } from "@/lib/rss/sources";

type FilterTab = "all" | "unread" | "bookmarked";

async function fetchArticles(params: {
  source?: string;
  unread?: boolean;
  bookmarked?: boolean;
  cursor?: string;
}) {
  const query = new URLSearchParams();
  if (params.source) query.set("source", params.source);
  if (params.unread) query.set("unread", "true");
  if (params.bookmarked) query.set("bookmarked", "true");
  if (params.cursor) query.set("cursor", params.cursor);
  query.set("limit", "20");

  const res = await fetch(`/api/articles?${query}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json() as Promise<{
    items: ArticleData[];
    nextCursor: string | null;
    hasMore: boolean;
  }>;
}

export function ArticlesClient() {
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [tab, setTab] = useState<FilterTab>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("");

  const load = useCallback(
    async (reset = true) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);

      try {
        const data = await fetchArticles({
          unread: tab === "unread",
          bookmarked: tab === "bookmarked",
          source: sourceFilter || undefined,
          cursor: reset ? undefined : (cursor ?? undefined),
        });

        setArticles((prev) => (reset ? data.items : [...prev, ...data.items]));
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch {
        toast.error("아티클을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tab, sourceFilter, cursor],
  );

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sourceFilter]);

  function handleUpdate(id: string, changes: Partial<ArticleData>) {
    setArticles((prev) => prev.map((a) => (a.id === id ? { ...a, ...changes } : a)));
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/cron/rss");
      const data = (await res.json()) as { totalAdded: number };
      toast.success(`${data.totalAdded}개 새 아티클 수집됨`);
      load(true);
    } catch {
      toast.error("RSS 수집에 실패했습니다.");
    } finally {
      setSyncing(false);
    }
  }

  const tabArticles = articles;

  return (
    <div className="space-y-4">
      {/* 상단 액션 */}
      <div className="flex items-center justify-between">
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
        >
          <option value="">전체 소스</option>
          {RSS_SOURCES.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
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
          RSS 수집
        </Button>
      </div>

      {/* 탭 필터 */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
        <TabsList>
          <TabsTrigger value="all">전체</TabsTrigger>
          <TabsTrigger value="unread">안 읽음</TabsTrigger>
          <TabsTrigger value="bookmarked">북마크</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : tabArticles.length === 0 ? (
            <div className="text-muted-foreground flex h-48 items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <p className="text-sm">아티클이 없습니다.</p>
                <p className="mt-1 text-xs">RSS 수집 버튼을 눌러 아티클을 가져오세요.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {tabArticles.map((article) => (
                <ArticleCard key={article.id} article={article} onUpdate={handleUpdate} />
              ))}

              {hasMore && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => load(false)}
                  disabled={loadingMore}
                >
                  {loadingMore ? "불러오는 중..." : "더 보기"}
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
