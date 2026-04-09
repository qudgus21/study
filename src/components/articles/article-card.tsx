"use client";

import {
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Trash2,
  Eye,
  EyeOff,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { blockIfDemo } from "@/lib/demo-mode";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUpdateArticle, useDeleteArticle, type ArticleData } from "@/lib/queries/use-articles";

export type { ArticleData };

interface ArticleCardProps {
  article: ArticleData;
  onMemo: (article: ArticleData) => void;
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

export function ArticleCard({ article, onMemo }: ArticleCardProps) {
  const updateArticle = useUpdateArticle();
  const deleteArticle = useDeleteArticle();

  function handleToggleRead(e: React.MouseEvent) {
    e.stopPropagation();
    if (blockIfDemo()) return;
    const next = !article.is_read;
    updateArticle.mutate(
      { id: article.id, changes: { is_read: next } },
      { onSuccess: () => toast.success(next ? "읽음 처리했습니다." : "읽음을 취소했습니다.") },
    );
  }

  function handleToggleBookmark(e: React.MouseEvent) {
    e.stopPropagation();
    if (blockIfDemo()) return;
    updateArticle.mutate({
      id: article.id,
      changes: { is_bookmarked: !article.is_bookmarked },
    });
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (blockIfDemo()) return;
    deleteArticle.mutate(article.id, {
      onError: () => toast.error("삭제에 실패했습니다."),
    });
  }

  function handleOpen() {
    window.open(article.url, "_blank", "noopener,noreferrer");
  }

  return (
    <Card
      className={`hover:bg-accent/50 cursor-pointer transition-colors ${article.is_read ? "opacity-60" : ""}`}
      onClick={handleOpen}
    >
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
            <p className="text-left text-sm leading-snug font-medium">
              {article.title}
              <ExternalLink className="ml-1 inline h-3 w-3 opacity-50" />
            </p>

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
              onClick={handleToggleRead}
              disabled={updateArticle.isPending}
              title={article.is_read ? "읽음 취소" : "읽음 표시"}
            >
              {article.is_read ? (
                <Eye className="h-4 w-4 text-green-500" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleToggleBookmark}
              disabled={updateArticle.isPending}
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
              onClick={(e) => {
                e.stopPropagation();
                onMemo(article);
              }}
              title="메모"
            >
              <StickyNote className={`h-4 w-4 ${article.memo ? "text-yellow-500" : ""}`} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleDelete}
              disabled={deleteArticle.isPending}
              title="삭제"
            >
              <Trash2 className="text-destructive h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
