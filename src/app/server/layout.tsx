'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LogOut,
  UtensilsCrossed,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store';
import { authApi } from '@/lib/api-client';
import { SocketProvider } from '@/components/providers/socket-provider';

const navItems = [
  { href: '/server/new-order', label: 'New' },
  { href: '/server/old-order', label: 'Older' },
  { href: '/server/my-orders', label: 'My orders' },
  { href: '/server/order-history', label: 'History' },
];

export default function ServerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, clearAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && (!isAuthenticated || user?.role !== 'server')) {
      router.push('/');
    }
  }, [mounted, isAuthenticated, user, router]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
      clearAuth();
      toast.success('Logged out successfully');
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      clearAuth();
      router.push('/');
    }
  };

  if (!mounted || !isAuthenticated || user?.role !== 'server') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <SocketProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Fixed Header with Navbar */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
          {/* Top Navbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                <UtensilsCrossed className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-semibold text-gray-800">Andra Meals</span>
                <span className="text-sm text-gray-500 ml-2 hidden sm:inline">
                  Server: {user?.username}
                </span>
              </div>
            </div>
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

          {/* Navigation Buttons Bar */}
          <nav className="flex items-center justify-center gap-2 sm:gap-4 md:gap-6 px-4 py-2 bg-gray-50">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 sm:px-4 md:px-6 py-2 rounded-full text-sm sm:text-base font-medium transition-all ${
                    isActive
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-orange-100 border border-gray-200'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        {/* Main Content with padding for fixed header */}
        <main className="pt-28 sm:pt-28">
          <div className="min-h-screen">{children}</div>
        </main>
      </div>
    </SocketProvider>
  );
}
