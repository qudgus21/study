"use client";

import { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArticleCard } from "./article-card";
import { RSS_SOURCES } from "@/lib/rss/sources";
import { useArticles } from "@/lib/queries/use-articles";

type FilterTab = "all" | "unread" | "bookmarked";

const PER_PAGE = 5;
const PAGE_GROUP_SIZE = 5;

const TECH_BLOG_SOURCES = [
  "Korean FE Article",
  "카카오 기술블로그",
  "토스 기술블로그",
  "우아한형제들 기술블로그",
];
const NEWS_SOURCES = ["긱뉴스", "요즘IT"];

type SourceGroup = "" | "tech" | "news" | string;

export function ArticlesClient() {
  const { data: allArticles = [], isLoading } = useArticles();
  const [tab, setTab] = useState<FilterTab>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceGroup>("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 드롭다운 외부 클릭 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // 소스 필터 적용
  const sourceFiltered = allArticles.filter((a) => {
    if (!sourceFilter) return true;
    if (sourceFilter === "tech") return TECH_BLOG_SOURCES.includes(a.source);
    if (sourceFilter === "news") return NEWS_SOURCES.includes(a.source);
    return a.source === sourceFilter;
  });

  // 검색 필터
  const keyword = search.trim().toLowerCase();
  const searchFiltered = keyword
    ? sourceFiltered.filter(
        (a) =>
          a.title.toLowerCase().includes(keyword) ||
          a.summary?.toLowerCase().includes(keyword) ||
          a.source.toLowerCase().includes(keyword),
      )
    : sourceFiltered;

  const filtered =
    tab === "unread"
      ? searchFiltered.filter((a) => !a.is_read)
      : tab === "bookmarked"
        ? searchFiltered.filter((a) => a.is_bookmarked)
        : searchFiltered;

  const counts = {
    all: searchFiltered.length,
    unread: searchFiltered.filter((a) => !a.is_read).length,
    bookmarked: searchFiltered.filter((a) => a.is_bookmarked).length,
  };

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function goToPage(p: number) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const sourceLabels: Record<string, string> = {
    "": "전체",
    tech: "기술 블로그",
    news: "뉴스",
  };
  const sourceLabel = sourceLabels[sourceFilter] ?? sourceFilter;

  function selectSource(value: SourceGroup) {
    setSourceFilter(value);
    setDropdownOpen(false);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* 검색 */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <input
          type="text"
          placeholder="제목, 요약, 소스 검색..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="border-input bg-background w-full rounded-md border py-2 pr-3 pl-9 text-sm"
        />
      </div>

      {/* 소스 드롭다운 */}
      <div ref={dropdownRef} className="relative inline-block">
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className="border-input bg-background hover:bg-accent flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors"
        >
          {sourceLabel}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </button>
        {dropdownOpen && (
          <div className="bg-popover border-border absolute left-0 z-50 mt-1 w-56 rounded-md border py-1 shadow-md">
            <button
              onClick={() => selectSource("")}
              className={`hover:bg-accent w-full px-3 py-1.5 text-left text-sm transition-colors ${
                !sourceFilter ? "text-primary font-medium" : ""
              }`}
            >
              전체
            </button>
            <div className="border-border my-1 border-t" />
            <button
              onClick={() => selectSource("tech")}
              className={`hover:bg-accent w-full px-3 py-2 text-left transition-colors ${
                sourceFilter === "tech" ? "text-primary font-medium" : ""
              }`}
            >
              <span className="text-sm">기술 블로그</span>
              <span className="text-muted-foreground block text-[11px]">
                Korean FE · 카카오 · 토스 · 우아한
              </span>
            </button>
            <button
              onClick={() => selectSource("news")}
              className={`hover:bg-accent w-full px-3 py-2 text-left transition-colors ${
                sourceFilter === "news" ? "text-primary font-medium" : ""
              }`}
            >
              <span className="text-sm">뉴스</span>
              <span className="text-muted-foreground block text-[11px]">긱뉴스 · 요즘IT</span>
            </button>
            <div className="border-border my-1 border-t" />
            {RSS_SOURCES.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSource(s.name)}
                className={`hover:bg-accent w-full px-3 py-1.5 text-left text-sm transition-colors ${
                  sourceFilter === s.name ? "text-primary font-medium" : ""
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 탭 필터 */}
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as FilterTab);
          setPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="all">전체 ({counts.all})</TabsTrigger>
          <TabsTrigger value="unread">안 읽음 ({counts.unread})</TabsTrigger>
          <TabsTrigger value="bookmarked">북마크 ({counts.bookmarked})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : total === 0 ? (
            <div className="text-muted-foreground flex h-48 items-center justify-center rounded-lg border border-dashed">
              <p className="text-sm">아티클이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paged.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <Pagination page={page} totalPages={totalPages} onPage={goToPage} />
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  const groupStart = Math.floor((page - 1) / PAGE_GROUP_SIZE) * PAGE_GROUP_SIZE + 1;
  const groupEnd = Math.min(groupStart + PAGE_GROUP_SIZE - 1, totalPages);
  const pages = Array.from({ length: groupEnd - groupStart + 1 }, (_, i) => groupStart + i);

  const btnClass =
    "flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors disabled:opacity-30 disabled:cursor-default";

  return (
    <div className="flex items-center justify-center gap-1 pt-2">
      <button
        onClick={() => onPage(1)}
        disabled={page === 1}
        className={`${btnClass} hover:bg-accent text-muted-foreground`}
      >
        <ChevronsLeft className="h-4 w-4" />
      </button>
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
        className={`${btnClass} hover:bg-accent text-muted-foreground`}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPage(p)}
          className={`${btnClass} ${
            p === page
              ? "bg-primary text-primary-foreground font-medium"
              : "hover:bg-accent text-muted-foreground"
          }`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
        className={`${btnClass} hover:bg-accent text-muted-foreground`}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <button
        onClick={() => onPage(totalPages)}
        disabled={page === totalPages}
        className={`${btnClass} hover:bg-accent text-muted-foreground`}
      >
        <ChevronsRight className="h-4 w-4" />
      </button>
    </div>
  );
}
