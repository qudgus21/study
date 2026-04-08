import { Header } from "@/components/layout/header";
import { CategoriesClient } from "@/components/categories/categories-client";

export default function CategoriesPage() {
  return (
    <>
      <Header title="카테고리" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <CategoriesClient />
      </div>
    </>
  );
}
