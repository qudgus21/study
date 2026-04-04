import { Header } from "@/components/layout/header";
import { JdClient } from "@/components/jd/jd-client";

export default function JdAnalysisPage() {
  return (
    <>
      <Header title="JD 분석" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <JdClient />
      </div>
    </>
  );
}
