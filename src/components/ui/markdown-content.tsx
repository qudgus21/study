"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  children: string;
  className?: string;
}

export function MarkdownContent({ children, className = "" }: MarkdownContentProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown>
    </div>
  );
}
