import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

// GET: 현재 활성 이력서 조회
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("resumes")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: PDF 업로드 + 텍스트 추출 + 구조화 파싱
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json({ error: "PDF 파일이 필요합니다" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "파일 크기는 10MB 이하여야 합니다" }, { status: 400 });
    }

    // 기존 활성 이력서 비활성화
    await supabase.from("resumes").update({ is_active: false }).eq("is_active", true);

    // Supabase Storage에 업로드
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `resumes/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(filePath, fileBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    // Storage 버킷이 없으면 생성 시도
    if (uploadError?.message?.includes("not found") || uploadError?.message?.includes("Bucket")) {
      // 버킷이 없는 경우 — DB에만 저장하고 extracted_text로 진행
      console.warn("Storage bucket 'resumes' not found, storing in DB only");
    } else if (uploadError) {
      console.error("Storage upload error:", uploadError);
    }

    // PDF 텍스트 추출
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
    const pdfData = await pdfParse(fileBuffer);
    const extractedText = pdfData.text;

    // DB에 이력서 레코드 삽입
    const { data: resume, error: insertError } = await supabase
      .from("resumes")
      .insert({
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        extracted_text: extractedText,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 구조화 파싱 (Claude CLI로 비동기 처리)
    parseResumeAsync(resume.id, extractedText).catch(console.error);

    return NextResponse.json(resume, { status: 201 });
  } catch (error) {
    console.error("Failed to upload resume:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 비동기 이력서 파싱 (Claude CLI)
async function parseResumeAsync(resumeId: string, extractedText: string) {
  const { spawnClaude, parseStreamOutput } = await import("@/lib/evaluate/claude-runner");

  const prompt = `아래 텍스트는 프론트엔드 개발자의 이력서에서 추출한 원문입니다.
이 내용을 분석하여 아래 JSON 구조로 변환하세요.

## 이력서 원문
${extractedText.slice(0, 8000)}

## 출력 형식
반드시 아래 JSON만 출력하세요. 다른 텍스트는 포함하지 마세요.
\`\`\`json
{
  "summary": "2-3문장 요약 (경력 연차, 주요 기술, 핵심 역할)",
  "experience": [
    {
      "company": "회사명",
      "role": "직책",
      "period": "기간",
      "description": "주요 업무 요약",
      "tech_stack": ["React", "TypeScript"],
      "highlights": ["핵심 성과"]
    }
  ],
  "skills": {
    "primary": ["주력 기술"],
    "secondary": ["보조 기술"],
    "tools": ["도구/인프라"]
  },
  "projects": [
    {
      "name": "프로젝트명",
      "description": "프로젝트 설명",
      "role": "담당 역할",
      "tech_stack": [],
      "achievements": ["성과"]
    }
  ]
}
\`\`\`

규칙:
- 이력서에 명시되지 않은 정보는 추론하지 말 것
- 기술 스택은 정확한 이름 사용 (react → React)
- 반드시 한국어로 응답하세요`;

  const proc = spawnClaude({
    agentName: "follow-up-generator",
    prompt,
    timeoutMs: 60_000,
  });

  let fullText = "";
  for await (const event of parseStreamOutput(proc, 60_000)) {
    if (event.type === "text") fullText += event.content ?? "";
    if (event.type === "done") fullText = event.fullText ?? fullText;
  }

  try {
    const jsonMatch =
      fullText.match(/```json\s*([\s\S]*?)\s*```/) || fullText.match(/\{[\s\S]*"summary"[\s\S]*\}/);
    const jsonStr = jsonMatch?.[1] ?? jsonMatch?.[0] ?? fullText;
    const parsed = JSON.parse(jsonStr);

    await supabase
      .from("resumes")
      .update({ parsed_sections: parsed, updated_at: new Date().toISOString() })
      .eq("id", resumeId);
  } catch (err) {
    console.error("Resume parsing failed:", err);
  }
}
