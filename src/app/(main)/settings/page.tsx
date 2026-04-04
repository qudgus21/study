import { Header } from "@/components/layout/header";
import { SettingsClient } from "@/components/settings/settings-client";

export default function SettingsPage() {
  return (
    <>
      <Header title="설정" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <SettingsClient />
      </div>
    </>
  );
}
