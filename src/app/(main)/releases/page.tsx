import { Header } from "@/components/layout/header";
import { ReleasesClient } from "@/components/releases/releases-client";

export default function ReleasesPage() {
  return (
    <>
      <Header title="릴리즈" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <ReleasesClient />
      </div>
    </>
  );
}
