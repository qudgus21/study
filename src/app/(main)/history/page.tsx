import { Header } from "@/components/layout/header";
import { HistoryClient } from "@/components/dashboard/history-client";

export default function HistoryPage() {
  return (
    <>
      <Header title="히스토리" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <HistoryClient />
      </div>
    </>
  );
}
