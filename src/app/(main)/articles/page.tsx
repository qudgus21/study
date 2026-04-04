import { Header } from "@/components/layout/header";
import { ArticlesClient } from "@/components/articles/articles-client";

export default function ArticlesPage() {
  return (
    <>
      <Header title="아티클" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <ArticlesClient />
      </div>
    </>
  );
}
