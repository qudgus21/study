import { Sidebar } from "@/components/layout/sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
    </div>
  );
}
