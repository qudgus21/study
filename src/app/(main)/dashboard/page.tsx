import { Header } from "@/components/layout/header";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default function DashboardPage() {
  return (
    <>
      <Header title="대시보드" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <DashboardClient />
      </div>
    </>
  );
}
