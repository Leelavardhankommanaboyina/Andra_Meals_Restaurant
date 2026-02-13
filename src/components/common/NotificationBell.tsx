'use client';

import { useMemo } from 'react';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAuthStore, useNotificationStore } from '@/store';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

const kindClasses: Record<'info' | 'success' | 'warning', string> = {
  info: 'bg-blue-50 border-blue-200',
  success: 'bg-green-50 border-green-200',
  warning: 'bg-amber-50 border-amber-200',
};

function formatNotificationTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const userId = useAuthStore((state) => state.user?.userId);
  const notifications = useNotificationStore((state) => state.notifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const clearForUser = useNotificationStore((state) => state.clearForUser);

  const userNotifications = useMemo(() => {
    if (!userId) return [];

    return notifications
      .filter((notification) => notification.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications, userId]);

  const unreadCount = userNotifications.filter((notification) => !notification.read).length;

  if (!userId) {
    return null;
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('relative', className)}
          aria-label="Open notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-orange-500 text-white text-[10px] font-semibold leading-[1.15rem] text-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-sm p-0">
        <SheetHeader className="px-4 py-4 border-b space-y-1">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-base">Notifications</SheetTitle>
            <span className="text-xs text-gray-500">{unreadCount} unread</span>
          </div>
          <SheetDescription className="text-xs">
            Live order alerts for your account.
          </SheetDescription>
          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={unreadCount === 0}
              onClick={() => markAllAsRead(userId)}
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Mark all read
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs text-red-600 hover:text-red-700"
              disabled={userNotifications.length === 0}
              onClick={() => clearForUser(userId)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Clear
            </Button>
          </div>
        </SheetHeader>

        {userNotifications.length === 0 ? (
          <div className="h-[calc(100vh-9rem)] flex items-center justify-center text-sm text-gray-500 px-6 text-center">
            No notifications yet.
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-9rem)]">
            <div className="p-4 space-y-3">
              {userNotifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => markAsRead(notification.id, userId)}
                  className={cn(
                    'w-full text-left border rounded-lg p-3 transition-colors',
                    kindClasses[notification.kind],
                    notification.read ? 'opacity-80' : 'ring-1 ring-orange-300'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
                    <span className="text-[11px] text-gray-600 whitespace-nowrap">
                      {formatNotificationTime(notification.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{notification.message}</p>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
