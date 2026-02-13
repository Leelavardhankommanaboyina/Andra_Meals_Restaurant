import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotificationKind = 'info' | 'success' | 'warning';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  kind: NotificationKind;
  orderId?: string;
  createdAt: string;
  read: boolean;
}

interface NotificationState {
  notifications: AppNotification[];
  addNotification: (
    notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & {
      id?: string;
      createdAt?: string;
      read?: boolean;
    }
  ) => void;
  markAsRead: (id: string, userId: string) => void;
  markAllAsRead: (userId: string) => void;
  clearForUser: (userId: string) => void;
}

const MAX_NOTIFICATIONS = 200;
const DEDUPE_WINDOW_MS = 5000;

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: [],

      addNotification: (notification) =>
        set((state) => {
          const now = Date.now();
          const duplicate = state.notifications.find((entry) => {
            if (
              entry.userId !== notification.userId ||
              entry.title !== notification.title ||
              entry.message !== notification.message ||
              entry.orderId !== notification.orderId
            ) {
              return false;
            }
            return now - new Date(entry.createdAt).getTime() < DEDUPE_WINDOW_MS;
          });

          if (duplicate) {
            return state;
          }

          const nextEntry: AppNotification = {
            id:
              notification.id ||
              (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`),
            userId: notification.userId,
            title: notification.title,
            message: notification.message,
            kind: notification.kind,
            orderId: notification.orderId,
            createdAt: notification.createdAt || new Date().toISOString(),
            read: notification.read ?? false,
          };

          return {
            notifications: [nextEntry, ...state.notifications].slice(0, MAX_NOTIFICATIONS),
          };
        }),

      markAsRead: (id, userId) =>
        set((state) => ({
          notifications: state.notifications.map((entry) =>
            entry.id === id && entry.userId === userId ? { ...entry, read: true } : entry
          ),
        })),

      markAllAsRead: (userId) =>
        set((state) => ({
          notifications: state.notifications.map((entry) =>
            entry.userId === userId ? { ...entry, read: true } : entry
          ),
        })),

      clearForUser: (userId) =>
        set((state) => ({
          notifications: state.notifications.filter((entry) => entry.userId !== userId),
        })),
    }),
    {
      name: 'notification-storage',
      version: 1,
      partialize: (state) => ({
        notifications: state.notifications,
      }),
    }
  )
);
