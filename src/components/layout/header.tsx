"use client";

import { Menu } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  title: string;
  action?: React.ReactNode;
}

export function Header({ title, action }: HeaderProps) {
  const { toggleSidebar } = useUIStore();

  return (
    <header className="bg-card border-border flex h-16 items-center justify-between border-b px-4 md:px-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">{title}</h1>
      </div>
      {action && <div>{action}</div>}
    </header>
  );
}
