import { Header } from "@/components/layout/header";
import { MissionDetailClient } from "./mission-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MissionDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <>
      <Header title="미션" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <MissionDetailClient missionId={id} />
      </div>
    </>
  );
}
