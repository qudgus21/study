import { Header } from "@/components/layout/header";
import { MissionListClient } from "./mission-list-client";

export default function MissionsPage() {
  return (
    <>
      <Header title="이번 주 미션" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <MissionListClient />
      </div>
    </>
  );
}
