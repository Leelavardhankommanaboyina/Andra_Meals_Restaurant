'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  UtensilsCrossed,
  Users,
  UserCircle,
  ClipboardList,
  Armchair,
  Receipt,
  BarChart3,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuthStore, useAdminStore } from '@/store';
import { authApi } from '@/lib/api-client';
import { SocketProvider, useSocket } from '@/components/providers/socket-provider';
import { NotificationBell } from '@/components/common/NotificationBell';

const navItems = [
  { href: '/admin/menu-items', label: 'Menu Items', icon: UtensilsCrossed },
  { href: '/admin/servers', label: 'Servers', icon: Users },
  { href: '/admin/customers', label: 'Customers', icon: UserCircle },
  { href: '/admin/take-order', label: 'Take Order', icon: ClipboardList },
  { href: '/admin/tables', label: 'Tables', icon: Armchair },
  { href: '/admin/bills-history', label: 'Bills History', icon: Receipt },
  { href: '/admin/metrics', label: 'Business Metrics', icon: BarChart3 },
];

function AdminConnectionBadge({
  pathname,
  compact = false,
}: {
  pathname: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const { isConnected } = useSocket();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncNow = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    try {
      const adminStore = useAdminStore.getState();

      if (pathname.startsWith('/admin/customers')) {
        await adminStore.fetchOrders();
      } else if (pathname.startsWith('/admin/menu-items')) {
        await adminStore.fetchMenuItems();
      } else if (pathname.startsWith('/admin/servers')) {
        await adminStore.fetchServers();
      } else if (pathname.startsWith('/admin/bills-history')) {
        await adminStore.fetchBills();
      }

      router.refresh();
      toast.success('Data synced');
    } catch {
      toast.error('Failed to sync data');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? 'icon' : 'sm'}
      onClick={handleSyncNow}
      disabled={isSyncing}
      className={
        compact
          ? `${isConnected ? 'text-green-700 border-green-200 hover:bg-green-50' : 'text-red-700 border-red-200 hover:bg-red-50'}`
          : `h-8 justify-start gap-2 ${isConnected ? 'text-green-700 border-green-200 hover:bg-green-50' : 'text-red-700 border-red-200 hover:bg-red-50'}`
      }
      title={isConnected ? 'Realtime connected. Click to sync now.' : 'Connection lost. Click to retry sync.'}
    >
      {isSyncing ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : isConnected ? (
        <Wifi className="w-4 h-4" />
      ) : (
        <WifiOff className="w-4 h-4" />
      )}
      {!compact && (
        <span className="text-xs font-medium">
          {isConnected ? 'Realtime On' : 'Connection Lost'}
        </span>
      )}
    </Button>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, clearAuth } = useAuthStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && (!isAuthenticated || user?.role !== 'admin')) {
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

  if (!mounted || !isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                ? 'bg-orange-500 text-white'
                : 'text-gray-700 hover:bg-orange-100'
              }`}
          >
            <Icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <SocketProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Mobile Header */}
        <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <UtensilsCrossed className="w-5 h-5 text-orange-500" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                        <UtensilsCrossed className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">Andra Meals</p>
                        <p className="text-sm text-gray-500">Admin: {user?.username}</p>
                      </div>
                    </div>
                  </div>
                  <nav className="flex-1 p-4 space-y-2">
                    <NavLinks onClick={() => setIsMenuOpen(false)} />
                  </nav>
                  <div className="p-4 border-t">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-5 h-5 mr-3" />
                      Logout
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <span className="font-semibold text-gray-800">Admin Panel</span>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <AdminConnectionBadge pathname={pathname} compact />
            </div>
          </div>
        </header>

        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 bg-white border-r">
          <div className="p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Andra Meals</p>
                <p className="text-sm text-gray-500">Admin: {user?.username}</p>
                <div className="mt-2 flex items-center gap-2">
                  <AdminConnectionBadge pathname={pathname} />
                  <NotificationBell />
                </div>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <NavLinks />
          </nav>
          <div className="p-4 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="lg:pl-64 pt-14 lg:pt-0">
          <div className="min-h-screen">{children}</div>
        </main>
      </div>
    </SocketProvider>
  );
}
