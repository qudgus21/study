import { create } from "zustand";

interface NotificationState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  decrement: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),
  decrement: () => set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),
}));
