"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { useNotificationStore } from "@/stores/notification-store";

export function NotificationBell() {
  const { unreadCount, setUnreadCount } = useNotificationStore();
  const [marking, setMarking] = useState(false);

  // 마운트 시 미읽음 수 가져오기
  useEffect(() => {
    fetch("/api/notifications?unread=true")
      .then((r) => r.json())
      .then((data: { unreadCount: number }) => {
        setUnreadCount(data.unreadCount ?? 0);
      })
      .catch(() => {});
  }, [setUnreadCount]);

  async function handleMarkAllRead() {
    if (unreadCount === 0 || marking) return;
    setMarking(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setUnreadCount(0);
      toast.success("모든 알림을 읽음 처리했습니다.");
    } catch {
      toast.error("처리에 실패했습니다.");
    } finally {
      setMarking(false);
    }
  }

  return (
    <button
      onClick={handleMarkAllRead}
      disabled={unreadCount === 0 || marking}
      className="flex w-full items-center gap-2 text-sm disabled:cursor-default"
      title={unreadCount > 0 ? "클릭해서 전체 읽음 처리" : "새 알림 없음"}
    >
      <div className="relative">
        <Bell className="text-muted-foreground h-4 w-4" />
        {unreadCount > 0 && (
          <span className="bg-destructive text-destructive-foreground absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>
      <span className="text-muted-foreground">
        {unreadCount > 0 ? `알림 ${unreadCount}개` : "알림"}
      </span>
    </button>
  );
}
