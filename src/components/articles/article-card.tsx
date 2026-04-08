"use client";

import { useState } from "react";
import { ExternalLink, Bookmark, BookmarkCheck, PlusCircle, Check } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ArticleData {
  id: string;
  title: string;
  url: string;
  source: string;
  summary: string;
  published_at: string;
  is_read: boolean;
  is_bookmarked: boolean;
  topic_generated?: boolean;
}

interface ArticleCardProps {
  article: ArticleData;
  onUpdate: (id: string, changes: Partial<ArticleData>) => void;
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "방금";
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(isoDate).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export function ArticleCard({ article, onUpdate }: ArticleCardProps) {
  const [loadingBookmark, setLoadingBookmark] = useState(false);
  const [loadingTopic, setLoadingTopic] = useState(false);

  async function handleMarkRead() {
    if (article.is_read) return;
    onUpdate(article.id, { is_read: true });
    await fetch(`/api/articles/${article.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_read: true }),
    });
  }

  async function handleToggleBookmark() {
    setLoadingBookmark(true);
    const next = !article.is_bookmarked;
    onUpdate(article.id, { is_bookmarked: next });
    await fetch(`/api/articles/${article.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_bookmarked: next }),
    });
    setLoadingBookmark(false);
  }

  async function handleGenerateTopic() {
    setLoadingTopic(true);
    try {
      const res = await fetch(`/api/articles/${article.id}/generate-category`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed");
      onUpdate(article.id, { topic_generated: true });
      toast.success("카테고리가 생성됐습니다.");
    } catch {
      toast.error("카테고리 생성에 실패했습니다.");
    } finally {
      setLoadingTopic(false);
    }
  }

  function handleOpen() {
    handleMarkRead();
    window.open(article.url, "_blank", "noopener,noreferrer");
  }

  return (
    <Card className={article.is_read ? "opacity-60" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {/* 헤더 */}
            <div className="mb-1 flex items-center gap-2">
              <Badge variant="outline" className="shrink-0 text-xs">
                {article.source}
              </Badge>
              <span className="text-muted-foreground text-xs">{timeAgo(article.published_at)}</span>
              {article.is_read && <span className="text-muted-foreground text-xs">읽음</span>}
            </div>

            {/* 제목 */}
            <button
              onClick={handleOpen}
              className="hover:text-primary text-left text-sm leading-snug font-medium transition-colors"
            >
              {article.title}
              <ExternalLink className="ml-1 inline h-3 w-3 opacity-50" />
            </button>

            {/* 요약 */}
            {article.summary && (
              <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{article.summary}</p>
            )}
          </div>

          {/* 액션 버튼 */}
          <div className="flex shrink-0 flex-col gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleToggleBookmark}
              disabled={loadingBookmark}
              title={article.is_bookmarked ? "북마크 해제" : "북마크"}
            >
              {article.is_bookmarked ? (
                <BookmarkCheck className="h-4 w-4 text-blue-500" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleGenerateTopic}
              disabled={loadingTopic || article.topic_generated}
              title={article.topic_generated ? "카테고리 생성됨" : "카테고리로 만들기"}
            >
              {article.topic_generated ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <PlusCircle className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
