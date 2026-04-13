import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";

export interface ResumeData {
  id: string;
  fileName: string;
  fileSize: number;
  extractedText: string | null;
  parsedSections: ParsedResume | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedResume {
  summary?: string;
  experience?: {
    company: string;
    role: string;
    period: string;
    description: string;
    tech_stack: string[];
    highlights: string[];
  }[];
  skills?: {
    primary: string[];
    secondary: string[];
    tools: string[];
  };
  projects?: {
    name: string;
    description: string;
    role: string;
    tech_stack: string[];
    achievements: string[];
  }[];
}

export function useActiveResume() {
  return useQuery({
    queryKey: queryKeys.resumes.all,
    queryFn: async (): Promise<ResumeData | null> => {
      const res = await fetch("/api/resumes");
      if (!res.ok) throw new Error("Failed to fetch resume");
      const data = await res.json();
      if (!data) return null;
      return {
        id: data.id,
        fileName: data.file_name,
        fileSize: data.file_size,
        extractedText: data.extracted_text,
        parsedSections: data.parsed_sections,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    },
  });
}

export function useUploadResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/resumes", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resumes.all });
    },
  });
}

export function useDeleteResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (resumeId: string) => {
      const res = await fetch(`/api/resumes/${resumeId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resumes.all });
    },
  });
}
