'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store';
import { authApi } from '@/lib/api-client';
import { SocketProvider } from '@/components/providers/socket-provider';
import { NotificationBell } from '@/components/common/NotificationBell';

export default function ServantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAuthenticated, clearAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && (!isAuthenticated || user?.role !== 'servent')) {
      router.push('/');
    }
  }, [mounted, isAuthenticated, user, router]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
      clearAuth();
      toast.success('Logged out successfully');
      router.push('/');
    } catch {
      clearAuth();
      router.push('/');
    }
  };

  if (!mounted || !isAuthenticated || user?.role !== 'servent') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <SocketProvider>
      <div className="min-h-screen bg-gray-50">
        <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                <UtensilsCrossed className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-semibold text-gray-800">Andra Meals</span>
                <span className="text-sm text-gray-500 ml-2 hidden sm:inline">
                  Servent: {user?.username}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <NotificationBell />
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </header>
        <main className="pt-16">
          <div className="min-h-screen">{children}</div>
        </main>
      </div>
    </SocketProvider>
  );
}
