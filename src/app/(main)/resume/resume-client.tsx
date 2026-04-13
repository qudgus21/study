"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  Sparkles,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useActiveResume, useUploadResume, useDeleteResume } from "@/lib/queries/use-resumes";
import type { ParsedResume } from "@/lib/queries/use-resumes";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";

export function ResumeClient() {
  const { data: resume, isLoading } = useActiveResume();
  const uploadMutation = useUploadResume();
  const deleteMutation = useDeleteResume();
  const queryClient = useQueryClient();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const [genResult, setGenResult] = useState<{ saved: number; total: number } | null>(null);

  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      uploadMutation.mutate(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [uploadMutation],
  );

  const handleGenerateQuestions = useCallback(async () => {
    if (!resume) return;
    setGenerating(true);
    setGenProgress("질문 생성 중...");
    setGenResult(null);

    try {
      const res = await fetch(`/api/resumes/${resume.id}/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 15 }),
      });

      if (!res.ok) throw new Error("생성 요청 실패");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) setGenProgress((p) => p + ".");
              if (data.saved_count != null) {
                setGenResult({ saved: data.saved_count, total: data.total_generated });
                queryClient.invalidateQueries({ queryKey: queryKeys.questions.all });
              }
              if (data.message) setGenProgress(`오류: ${data.message}`);
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (err) {
      setGenProgress(`오류: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    } finally {
      setGenerating(false);
    }
  }, [resume, queryClient]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">이력서</h1>
        <p className="text-muted-foreground mt-1">
          PDF 이력서를 업로드하고, AI 면접 질문을 생성하세요
        </p>
      </div>

      {/* 업로드 영역 */}
      {!resume ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
            <Upload className="text-muted-foreground h-12 w-12" />
            <div className="text-center">
              <p className="font-medium">PDF 이력서를 업로드하세요</p>
              <p className="text-muted-foreground mt-1 text-sm">최대 10MB</p>
            </div>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              PDF 선택
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleUpload}
            />
            {uploadMutation.isError && (
              <p className="text-sm text-red-500">
                {uploadMutation.error instanceof Error
                  ? uploadMutation.error.message
                  : "업로드 실패"}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 이력서 정보 카드 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="text-primary h-8 w-8" />
                <div>
                  <CardTitle className="text-base">{resume.fileName}</CardTitle>
                  <p className="text-muted-foreground text-xs">
                    {(resume.fileSize / 1024).toFixed(0)}KB ·{" "}
                    {new Date(resume.createdAt).toLocaleDateString("ko-KR")} 업로드
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  교체
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(resume.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleUpload}
            />
          </Card>

          {/* 파싱된 이력서 내용 */}
          {resume.parsedSections && <ParsedResumeView data={resume.parsedSections} />}

          {/* 파싱 진행 중 */}
          {!resume.parsedSections && resume.extractedText && (
            <Card>
              <CardContent className="flex items-center gap-3 py-6">
                <Loader2 className="text-primary h-5 w-5 animate-spin" />
                <span className="text-muted-foreground text-sm">
                  이력서를 분석하고 있습니다... 새로고침 후 확인해주세요
                </span>
              </CardContent>
            </Card>
          )}

          {/* 질문 생성 */}
          <Card>
            <CardContent className="space-y-4 py-6">
              <Button
                onClick={handleGenerateQuestions}
                disabled={generating}
                className="w-full"
                size="lg"
              >
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                이력서 기반 면접 질문 생성
              </Button>

              {generating && (
                <p className="text-muted-foreground text-center text-sm">{genProgress}</p>
              )}

              {genResult && (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>
                    {genResult.total}개 생성, {genResult.saved}개 저장 완료
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ParsedResumeView({ data }: { data: ParsedResume }) {
  return (
    <div className="space-y-4">
      {/* 요약 */}
      {data.summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">요약</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{data.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* 기술 스택 */}
      {data.skills && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">기술 스택</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.skills.primary?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {data.skills.primary.map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
            )}
            {data.skills.secondary?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {data.skills.secondary.map((s) => (
                  <Badge key={s} variant="secondary">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
            {data.skills.tools?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {data.skills.tools.map((s) => (
                  <Badge key={s} variant="outline">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 경력 */}
      {data.experience && data.experience.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">경력</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.experience.map((exp, i) => (
              <div key={i} className="border-l-2 pl-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{exp.company}</span>
                  <span className="text-muted-foreground text-xs">{exp.role}</span>
                </div>
                <p className="text-muted-foreground text-xs">{exp.period}</p>
                {exp.description && <p className="mt-1 text-sm">{exp.description}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 프로젝트 */}
      {data.projects && data.projects.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">프로젝트</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.projects.map((proj, i) => (
              <div key={i} className="border-l-2 pl-3">
                <span className="text-sm font-medium">{proj.name}</span>
                {proj.description && (
                  <p className="text-muted-foreground mt-0.5 text-xs">{proj.description}</p>
                )}
                {proj.tech_stack?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {proj.tech_stack.map((t) => (
                      <Badge key={t} variant="outline" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
