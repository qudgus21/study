import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

type Params = { params: Promise<{ id: string }> };

// GET: 이력서 상세 (파싱된 섹션 포함)
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await supabase.from("resumes").select("*").eq("id", id).single();

    if (error || !data) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// DELETE: 이력서 삭제
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    // Storage에서 파일 삭제
    const { data: resume } = await supabase
      .from("resumes")
      .select("file_path")
      .eq("id", id)
      .single();

    if (resume?.file_path) {
      await supabase.storage.from("resumes").remove([resume.file_path]);
    }

    // DB 레코드 삭제
    await supabase.from("resumes").delete().eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
