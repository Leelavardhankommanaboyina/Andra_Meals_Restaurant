'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Socket } from 'socket.io-client';
import { initSocket, disconnectSocket, joinRoom, leaveRoom, getSocket, SOCKET_EVENTS, ROOMS } from '@/lib/socket-client';
import { useAuthStore } from '@/store/auth-store';
import { useAdminStore, MenuItem, Server, Customer } from '@/store/admin-store';
import { useOrderStore, Order } from '@/store/order-store';
import { toast } from 'sonner';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  joinRoom: () => { },
  leaveRoom: () => { },
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: ReactNode;
}

// Use window to persist state across HMR - this survives hot reloads
declare global {
  interface Window {
    __socketState?: {
      setup: boolean;
      listeners: boolean;
    };
  }
}

const getWindowState = () => {
  if (typeof window === 'undefined') return { setup: false, listeners: false };
  if (!window.__socketState) {
    window.__socketState = { setup: false, listeners: false };
  }
  return window.__socketState;
};

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(() => getSocket());
  const [isConnected, setIsConnected] = useState(() => getSocket()?.connected ?? false);
  const [mounted, setMounted] = useState(false);
  const { user } = useAuthStore();

  // Wait for mount to ensure hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Single effect to manage socket lifecycle
  useEffect(() => {
    // Don't run until mounted (hydrated)
    if (!mounted) return;

    const windowState = getWindowState();

    // If no user after hydration, don't create socket (layouts handle redirect)
    if (!user) {
      console.log('[Socket Provider] No user, skipping socket setup');
      return;
    }

    // Check if we already have a valid socket with listeners
    const existingSocket = getSocket();
    if (existingSocket?.connected && windowState.listeners) {
      // Socket already set up and connected, just sync state
      console.log('[Socket Provider] Reusing existing connected socket');
      setSocket(existingSocket);
      setIsConnected(true);
      return;
    }

    // If already set up but not connected, just wait for reconnection
    if (windowState.setup && windowState.listeners && existingSocket) {
      console.log('[Socket Provider] Socket exists, waiting for reconnection');
      setSocket(existingSocket);
      setIsConnected(existingSocket.connected);
      return;
    }

    // Get token
    const authData = localStorage.getItem('auth-storage');
    let token: string | undefined;
    try {
      const parsed = JSON.parse(authData || '{}');
      token = parsed?.state?.token;
    } catch {
      token = undefined;
    }

    // Initialize socket
    console.log('[Socket Provider] Initializing new socket');
    const socketInstance = initSocket(token);
    setSocket(socketInstance);
    windowState.setup = true;

    // Connection handlers
    const onConnect = () => {
      console.log('[Socket] Connected - socket.id:', socketInstance.id);
      setIsConnected(true);
      const currentUser = useAuthStore.getState().user;
      console.log('[Socket] Current user role:', currentUser?.role);
      if (currentUser?.role === 'admin') {
        joinRoom(ROOMS.ADMIN);
        console.log('[Socket] Admin joining ADMIN room');
      } else if (currentUser?.role === 'server') {
        joinRoom(ROOMS.SERVERS);
        console.log('[Socket] Server joining SERVERS room');
      }
    };

    const onDisconnect = (reason: string) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    };

    // Attach connection handlers
    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);

    // If already connected, manually trigger
    if (socketInstance.connected) {
      onConnect();
    }

    // Attach event listeners only once
    if (!windowState.listeners) {
      attachEventListeners(socketInstance);
      windowState.listeners = true;
    }

    // Cleanup function - DON'T disconnect, just remove connection state handlers
    return () => {
      socketInstance.off('connect', onConnect);
      socketInstance.off('disconnect', onDisconnect);
    };
  }, [mounted, user?.userId, user?.role]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, joinRoom, leaveRoom }}>
      {children}
    </SocketContext.Provider>
  );
}

// Separate function for event listeners to keep them stable
function attachEventListeners(socketInstance: Socket) {
  // =====================
  // ORDER EVENTS
  // =====================
  socketInstance.on(SOCKET_EVENTS.ORDER_CREATED, (order: Customer & Order) => {
    console.log('[Socket] ✅ ORDER_CREATED received:', order._id, order.customerName);
    toast.info('New order received', { duration: 3000 });
    // Update admin store
    const adminStore = useAdminStore.getState();
    if (order.status === 'ongoing') {
      adminStore.setOngoingOrders([order as Customer, ...adminStore.ongoingOrders.filter(o => o._id !== order._id)]);
    }
    // Update order store for servers
    const orderStore = useOrderStore.getState();
    orderStore.addToMyOrders(order as Order);
  });

  socketInstance.on(SOCKET_EVENTS.ORDER_UPDATED, (order: Customer & Order) => {
    console.log('[Socket] ✅ ORDER_UPDATED received:', order._id, 'status:', order.status);
    const adminStore = useAdminStore.getState();
    console.log('[Socket] Current ongoing orders:', adminStore.ongoingOrders.length, 'completed:', adminStore.completedOrders.length);
    if (order.status === 'ongoing') {
      const newOngoing = adminStore.ongoingOrders.map(o => o._id === order._id ? order as Customer : o);
      // If order wasn't in ongoing, add it (might have been reset from completed)
      if (!newOngoing.find(o => o._id === order._id)) {
        newOngoing.unshift(order as Customer);
      }
      adminStore.setOngoingOrders(newOngoing);
      // Remove from completed if it was there
      adminStore.setCompletedOrders(adminStore.completedOrders.filter(o => o._id !== order._id));
    } else if (order.status === 'completed') {
      adminStore.setOngoingOrders(adminStore.ongoingOrders.filter(o => o._id !== order._id));
      adminStore.setCompletedOrders([order as Customer, ...adminStore.completedOrders.filter(o => o._id !== order._id)]);
    }
    // Update order store - add or update based on whether it exists
    const orderStore = useOrderStore.getState();
    const existingOrder = orderStore.myOrders.find(o => o._id === order._id);
    if (existingOrder) {
      orderStore.updateOrderInMyOrders(order._id, order as Order);
    } else if (order.status === 'ongoing') {
      orderStore.addToMyOrders(order as Order);
    }
  });

  socketInstance.on(SOCKET_EVENTS.ORDER_COMPLETED, (order: Customer & Order) => {
    console.log('[Socket] ORDER_COMPLETED received:', order._id);
    const adminStore = useAdminStore.getState();
    adminStore.setOngoingOrders(adminStore.ongoingOrders.filter(o => o._id !== order._id));
    adminStore.setCompletedOrders([order, ...adminStore.completedOrders.filter(o => o._id !== order._id)]);
    const orderStore = useOrderStore.getState();
    orderStore.removeFromMyOrders(order._id);
  });

  socketInstance.on(SOCKET_EVENTS.ORDER_PAID, (order: Customer) => {
    console.log('[Socket] ORDER_PAID received:', order._id);
    toast.success('Payment completed', { duration: 3000 });
    const adminStore = useAdminStore.getState();
    adminStore.setCompletedOrders(adminStore.completedOrders.filter(o => o._id !== order._id));
    adminStore.fetchBills();
  });

  socketInstance.on(SOCKET_EVENTS.ORDER_ITEM_DELIVERED, (order: Customer & Order) => {
    console.log('[Socket] ✅ ORDER_ITEM_DELIVERED received:', order._id, 'status:', order.status);
    const adminStore = useAdminStore.getState();
    console.log('[Socket] Current ongoing orders:', adminStore.ongoingOrders.length, 'completed:', adminStore.completedOrders.length);

    // Check if order status changed to completed - move to completed list
    if (order.status === 'completed') {
      // Remove from ongoing, add to completed
      adminStore.setOngoingOrders(adminStore.ongoingOrders.filter(o => o._id !== order._id));
      adminStore.setCompletedOrders([order as Customer, ...adminStore.completedOrders.filter(o => o._id !== order._id)]);
      console.log('[Socket] Moved order to completed list');
    } else {
      // Just update the order in place in ongoing list
      adminStore.setOngoingOrders(adminStore.ongoingOrders.map(o => o._id === order._id ? order as Customer : o));
    }
    console.log('[Socket] Updated admin store with delivered item');
    const orderStore = useOrderStore.getState();
    orderStore.updateOrderInMyOrders(order._id, order as Order);
  });

  socketInstance.on(SOCKET_EVENTS.ORDER_DELETED, (data: { _id: string }) => {
    console.log('[Socket] ORDER_DELETED received:', data._id);
    const adminStore = useAdminStore.getState();
    adminStore.setOngoingOrders(adminStore.ongoingOrders.filter(o => o._id !== data._id));
    adminStore.setCompletedOrders(adminStore.completedOrders.filter(o => o._id !== data._id));
    const orderStore = useOrderStore.getState();
    orderStore.removeFromMyOrders(data._id);
  });

  // =====================
  // MENU EVENTS
  // =====================
  socketInstance.on(SOCKET_EVENTS.MENU_ITEM_CREATED, (item: MenuItem) => {
    const adminStore = useAdminStore.getState();
    adminStore.addMenuItem(item);
    toast.info('New menu item added', { duration: 2000 });
  });

  socketInstance.on(SOCKET_EVENTS.MENU_ITEM_UPDATED, (item: MenuItem) => {
    const adminStore = useAdminStore.getState();
    adminStore.updateMenuItem(item._id, item);
  });

  socketInstance.on(SOCKET_EVENTS.MENU_ITEM_DELETED, (data: { _id: string }) => {
    const adminStore = useAdminStore.getState();
    adminStore.removeMenuItem(data._id);
    toast.info('Menu item removed', { duration: 2000 });
  });

  socketInstance.on(SOCKET_EVENTS.MENU_ITEM_TOGGLED, (item: MenuItem) => {
    const adminStore = useAdminStore.getState();
    adminStore.updateMenuItem(item._id, { isActive: item.isActive });
  });

  // =====================
  // SERVER/STAFF EVENTS
  // =====================
  socketInstance.on(SOCKET_EVENTS.SERVER_CREATED, (server: Server) => {
    const adminStore = useAdminStore.getState();
    adminStore.addServer(server);
    toast.info('New server account created', { duration: 2000 });
  });

  socketInstance.on(SOCKET_EVENTS.SERVER_UPDATED, (server: Server) => {
    const adminStore = useAdminStore.getState();
    adminStore.updateServer(server._id, server);
  });

  socketInstance.on(SOCKET_EVENTS.SERVER_DELETED, (data: { _id: string }) => {
    const adminStore = useAdminStore.getState();
    adminStore.removeServer(data._id);
    toast.info('Server account removed', { duration: 2000 });
  });

  socketInstance.on(SOCKET_EVENTS.SERVER_TOGGLED, (server: Server) => {
    const adminStore = useAdminStore.getState();
    adminStore.updateServer(server._id, { isActive: server.isActive });
  });
}
