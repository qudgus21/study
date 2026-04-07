"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Target,
  Newspaper,
  BarChart3,
  Library,
  Settings,
  X,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

const navItems = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/missions", label: "미션", icon: Target },
  { href: "/articles", label: "아티클", icon: Newspaper },
  { href: "/jd-analysis", label: "JD 분석", icon: BarChart3 },

  { href: "/topics", label: "토픽 관리", icon: Library },
  { href: "/settings", label: "설정", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  return (
    <>
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="bg-background/80 fixed inset-0 z-40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={cn(
          "bg-card border-border fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r transition-transform duration-200 md:static md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* 로고 */}
        <div className="border-border flex h-16 items-center justify-between border-b px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <GraduationCap className="text-primary h-6 w-6" />
            <span className="text-lg font-bold">Senior FE</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="cursor-pointer md:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
