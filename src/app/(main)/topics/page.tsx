import { Header } from "@/components/layout/header";
import { TopicsClient } from "@/components/topics/topics-client";

export default function TopicsPage() {
  return (
    <>
      <Header title="토픽 관리" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <TopicsClient />
      </div>
    </>
  );
}
