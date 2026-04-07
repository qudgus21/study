"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, BookOpen, MessageSquare, Code, Filter } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface TopicData {
  id: string;
  title: string;
  description: string | null;
  mission_type: "concept" | "discussion" | "code";
  category_name: string;
  source_type: string;
  is_used: boolean;
  created_at: string;
}

interface NewTopicForm {
  title: string;
  description: string;
  mission_type: "concept" | "discussion" | "code";
  category_name: string;
  code_snippet: string;
}

const typeIcons = {
  concept: BookOpen,
  discussion: MessageSquare,
  code: Code,
};

const sourceLabels: Record<string, string> = {
  ai: "AI 생성",
  jd: "JD 갭 분석",
  article: "아티클",
};

const emptyForm: NewTopicForm = {
  title: "",
  description: "",
  mission_type: "concept",
  category_name: "",
  code_snippet: "",
};

export function TopicsClient() {
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewTopicForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [unusedOnly, setUnusedOnly] = useState(false);

  useEffect(() => {
    const url = unusedOnly ? "/api/topics?unused=true" : "/api/topics";
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((data: { items: TopicData[] }) => setTopics(data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [unusedOnly]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.category_name) {
      toast.error("제목과 카테고리는 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const created = (await res.json()) as TopicData;
      setTopics((prev) => [created, ...prev]);
      setForm(emptyForm);
      setShowForm(false);
      toast.success("토픽이 추가됐습니다.");
    } catch {
      toast.error("토픽 생성에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/topics/${id}`, { method: "DELETE" });
      setTopics((prev) => prev.filter((t) => t.id !== id));
      toast.success("삭제됐습니다.");
    } catch {
      toast.error("삭제에 실패했습니다.");
    }
  }

  return (
    <div className="space-y-4">
      {/* 상단 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUnusedOnly((v) => !v)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
              unusedOnly ? "border-primary text-primary" : "text-muted-foreground"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            미사용만
          </button>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)} className="gap-2">
          <Plus className="h-3.5 w-3.5" />
          토픽 추가
        </Button>
      </div>

      {/* 추가 폼 */}
      {showForm && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                type="text"
                placeholder="제목 *"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              />
              <textarea
                placeholder="설명 (선택)"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                rows={2}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.mission_type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      mission_type: e.target.value as NewTopicForm["mission_type"],
                    }))
                  }
                  className="border-input bg-background rounded-md border px-2 py-2 text-sm"
                >
                  <option value="concept">개념</option>
                  <option value="discussion">토론</option>
                  <option value="code">코드</option>
                </select>
                <input
                  type="text"
                  placeholder="카테고리 *"
                  value={form.category_name}
                  onChange={(e) => setForm((f) => ({ ...f, category_name: e.target.value }))}
                  className="border-input bg-background rounded-md border px-2 py-2 text-sm"
                />
              </div>
              <textarea
                placeholder="코드 스니펫 (코드 타입일 경우)"
                value={form.code_snippet}
                onChange={(e) => setForm((f) => ({ ...f, code_snippet: e.target.value }))}
                className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs"
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  취소
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : topics.length === 0 ? (
        <div className="text-muted-foreground flex h-48 items-center justify-center rounded-lg border border-dashed text-sm">
          토픽이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {topics.map((topic) => {
            const Icon = typeIcons[topic.mission_type];
            return (
              <Card key={topic.id} className={topic.is_used ? "opacity-50" : ""}>
                <CardContent className="flex items-center gap-3 p-3">
                  <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{topic.title}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {topic.category_name}
                      </Badge>
                      <span className="text-muted-foreground text-[10px]">
                        {sourceLabels[topic.source_type] ?? topic.source_type}
                      </span>
                      {topic.is_used && (
                        <span className="text-muted-foreground text-[10px]">사용됨</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleDelete(topic.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
