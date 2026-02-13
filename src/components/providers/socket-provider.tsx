'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Socket } from 'socket.io-client';
import { disconnectSocket, initSocket, joinRoom, leaveRoom, getSocket, SOCKET_EVENTS, ROOMS } from '@/lib/socket-client';
import { useAuthStore } from '@/store/auth-store';
import { useAdminStore, MenuItem, Server, Customer } from '@/store/admin-store';
import { useOrderStore, Order } from '@/store/order-store';
import { useNotificationStore, type NotificationKind } from '@/store/notification-store';
import { ordersApi } from '@/lib/api-client';
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
  joinRoom: () => {},
  leaveRoom: () => {},
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

    const syncAfterConnect = async (currentUser: ReturnType<typeof useAuthStore.getState>['user']) => {
      if (currentUser?.role === 'admin') {
        // Re-sync orders on (re)connect to recover any events missed while disconnected.
        await useAdminStore.getState().fetchOrders();
        return;
      }

      if (currentUser?.role === 'server' || currentUser?.role === 'servent') {
        try {
          const [ongoingRes, historyRes] = await Promise.all([
            ordersApi.getAll({ myOrders: true, status: 'ongoing', page: 1, limit: 100 }),
            ordersApi.getAll({ myOrders: true, status: 'history', page: 1, limit: 100 }),
          ]);
          const orderStore = useOrderStore.getState();
          orderStore.setMyOrders(ongoingRes.data.orders as Order[]);
          orderStore.setOrderHistory(historyRes.data.orders as Order[]);
        } catch (error) {
          console.error('Realtime reconnect sync failed:', error);
        }
      }
    };

    // If no user after hydration, ensure no active socket remains.
    if (!user) {
      disconnectSocket();
      setSocket(null);
      setIsConnected(false);
      windowState.setup = false;
      windowState.listeners = false;
      return;
    }

    // Check if we already have a valid socket with listeners
    const existingSocket = getSocket();
    if (existingSocket?.connected && windowState.listeners) {
      setSocket(existingSocket);
      setIsConnected(true);
      if (user.role === 'admin') {
        joinRoom(ROOMS.ADMIN);
      } else if (user.role === 'server' || user.role === 'servent') {
        joinRoom(ROOMS.SERVERS);
      }
      void syncAfterConnect(user);
      return;
    }

    // If already set up but not connected, just wait for reconnection
    if (windowState.setup && windowState.listeners && existingSocket) {
      setSocket(existingSocket);
      setIsConnected(existingSocket.connected);
      return;
    }

    // Initialize socket
    const socketInstance = initSocket();
    setSocket(socketInstance);
    windowState.setup = true;

    const onConnect = () => {
      setIsConnected(true);
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.role === 'admin') {
        joinRoom(ROOMS.ADMIN);
      } else if (currentUser?.role === 'server' || currentUser?.role === 'servent') {
        joinRoom(ROOMS.SERVERS);
      }
      void syncAfterConnect(currentUser);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onConnectError = (error: Error) => {
      const message = error.message.toLowerCase();
      if (message.includes('authentication') || message.includes('token')) {
        useAuthStore.getState().clearAuth();
        disconnectSocket();
        setSocket(null);
        setIsConnected(false);
        windowState.setup = false;
        windowState.listeners = false;
      }
    };

    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);
    socketInstance.on('connect_error', onConnectError);

    if (socketInstance.connected) {
      onConnect();
    }

    if (!windowState.listeners) {
      attachEventListeners(socketInstance);
      windowState.listeners = true;
    }

    return () => {
      socketInstance.off('connect', onConnect);
      socketInstance.off('disconnect', onDisconnect);
      socketInstance.off('connect_error', onConnectError);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, user?.userId, user?.role]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, joinRoom, leaveRoom }}>
      {children}
    </SocketContext.Provider>
  );
}

function hasUndeliveredItems(order: Order): boolean {
  return order.items.some((item) => !item.isDelivered);
}

function isOrderAssignedToUser(order: Order, userId?: string): boolean {
  if (!userId) return false;
  return order.deliveryAssigneeId?.toString() === userId;
}

function hasUserUndeliveredItems(order: Order, userId?: string): boolean {
  if (!userId) return false;
  return order.items.some(
    (item) => item.addedByServerId?.toString() === userId && !item.isDelivered
  );
}

function hasUserItems(order: Order, userId?: string): boolean {
  if (!userId) return false;
  return order.items.some((item) => item.addedByServerId?.toString() === userId);
}

function shouldShowInMyOrders(
  order: Order,
  currentUser: ReturnType<typeof useAuthStore.getState>['user']
): boolean {
  if (!currentUser || currentUser.role === 'admin') {
    return false;
  }

  if (!hasUndeliveredItems(order)) {
    return false;
  }

  if (isOrderAssignedToUser(order, currentUser.userId)) {
    return true;
  }

  // Legacy fallback for historical orders without assignment.
  if (currentUser.role === 'server' && !order.deliveryAssigneeId) {
    return hasUserUndeliveredItems(order, currentUser.userId);
  }

  return false;
}

function toComparableId(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;

  if (typeof value === 'object' && value !== null && 'toString' in value) {
    try {
      return String((value as { toString: () => string }).toString());
    } catch {
      return undefined;
    }
  }

  return String(value);
}

function matchesUserId(value: unknown, userId?: string): boolean {
  if (!userId) return false;
  const comparable = toComparableId(value);
  return comparable === userId;
}

function addRealtimeNotification(params: {
  userId: string;
  title: string;
  message: string;
  kind?: NotificationKind;
  orderId?: string;
}) {
  useNotificationStore.getState().addNotification({
    userId: params.userId,
    title: params.title,
    message: params.message,
    kind: params.kind || 'info',
    orderId: params.orderId,
  });
}

// Separate function for event listeners to keep them stable
function attachEventListeners(socketInstance: Socket) {
  // =====================
  // ORDER EVENTS
  // =====================
  socketInstance.on(SOCKET_EVENTS.ORDER_CREATED, (order: Customer & Order) => {
    const currentUser = useAuthStore.getState().user;

    if (currentUser?.role === 'admin') {
      toast.info('New order received', { duration: 1000 });
      addRealtimeNotification({
        userId: currentUser.userId,
        title: 'New order added',
        message: `Table ${order.tableNumber} - ${order.customerName}`,
        kind: 'info',
        orderId: order._id,
      });
    }

    const adminStore = useAdminStore.getState();
    if (order.status === 'ongoing') {
      adminStore.setOngoingOrders([
        order as Customer,
        ...adminStore.ongoingOrders.filter((o) => o._id !== order._id),
      ]);
    }

    const orderStore = useOrderStore.getState();
    if (shouldShowInMyOrders(order as Order, currentUser)) {
      orderStore.addToMyOrders(order as Order);
    } else {
      orderStore.removeFromMyOrders(order._id);
    }
  });

  socketInstance.on(SOCKET_EVENTS.ORDER_UPDATED, (order: Customer & Order) => {
    const currentUser = useAuthStore.getState().user;
    const adminStore = useAdminStore.getState();

    if (order.status === 'ongoing') {
      const newOngoing = adminStore.ongoingOrders.map((o) =>
        o._id === order._id ? (order as Customer) : o
      );
      if (!newOngoing.find((o) => o._id === order._id)) {
        newOngoing.unshift(order as Customer);
      }
      adminStore.setOngoingOrders(newOngoing);
      adminStore.setCompletedOrders(adminStore.completedOrders.filter((o) => o._id !== order._id));
    } else if (order.status === 'completed') {
      adminStore.setOngoingOrders(adminStore.ongoingOrders.filter((o) => o._id !== order._id));
      adminStore.setCompletedOrders([
        order as Customer,
        ...adminStore.completedOrders.filter((o) => o._id !== order._id),
      ]);
    } else if (order.status === 'paid' || order.status === 'cancelled') {
      adminStore.setOngoingOrders(adminStore.ongoingOrders.filter((o) => o._id !== order._id));
      adminStore.setCompletedOrders(adminStore.completedOrders.filter((o) => o._id !== order._id));
    }

    const orderStore = useOrderStore.getState();
    if (shouldShowInMyOrders(order as Order, currentUser)) {
      const existingOrder = orderStore.myOrders.find((o) => o._id === order._id);
      if (existingOrder) {
        orderStore.updateOrderInMyOrders(order._id, order as Order);
      } else {
        orderStore.addToMyOrders(order as Order);
      }
    } else {
      orderStore.removeFromMyOrders(order._id);
    }
  });

  socketInstance.on(SOCKET_EVENTS.ORDER_ASSIGNED, (order: Customer & Order) => {
    const currentUser = useAuthStore.getState().user;
    const adminStore = useAdminStore.getState();

    if (order.status === 'ongoing') {
      const updatedOngoing = adminStore.ongoingOrders.map((o) =>
        o._id === order._id ? (order as Customer) : o
      );
      if (!updatedOngoing.find((o) => o._id === order._id)) {
        updatedOngoing.unshift(order as Customer);
      }
      adminStore.setOngoingOrders(updatedOngoing);
    }

    if (currentUser?.userId && matchesUserId(order.deliveryAssigneeId, currentUser.userId)) {
      // If you assign an order to yourself (common when a server creates an order),
      // don't show the "assigned" notification to the same person.
      const isSelfAssignment =
        matchesUserId(order.assignedById, currentUser.userId) ||
        (!order.assignedById && matchesUserId(order.serverId, currentUser.userId));

      if (!isSelfAssignment) {
        toast.success(`Order assigned: Table ${order.tableNumber} (${order.customerName})`, {
          duration: 1500,
        });
        addRealtimeNotification({
          userId: currentUser.userId,
          title: 'New order assigned',
          message: `Table ${order.tableNumber} - ${order.customerName}`,
          kind: 'info',
          orderId: order._id,
        });
      }
    }

    const orderStore = useOrderStore.getState();
    if (shouldShowInMyOrders(order as Order, currentUser)) {
      orderStore.addToMyOrders(order as Order);
    } else {
      orderStore.removeFromMyOrders(order._id);
    }
  });

  socketInstance.on(SOCKET_EVENTS.ORDER_COMPLETED, (order: Customer & Order) => {
    const adminStore = useAdminStore.getState();
    adminStore.setOngoingOrders(adminStore.ongoingOrders.filter((o) => o._id !== order._id));
    adminStore.setCompletedOrders([
      order,
      ...adminStore.completedOrders.filter((o) => o._id !== order._id),
    ]);
    const orderStore = useOrderStore.getState();
    orderStore.removeFromMyOrders(order._id);
  });

  socketInstance.on(SOCKET_EVENTS.ORDER_PAID, (order: Customer) => {
    const currentUser = useAuthStore.getState().user;
    if (currentUser?.role === 'admin') {
      toast.success('Payment completed', { duration: 1000 });
    }
    const adminStore = useAdminStore.getState();
    adminStore.setCompletedOrders(adminStore.completedOrders.filter((o) => o._id !== order._id));
    adminStore.fetchBills();
    const orderStore = useOrderStore.getState();
    orderStore.removeFromMyOrders(order._id);
  });

  socketInstance.on(SOCKET_EVENTS.ORDER_ITEM_DELIVERED, (order: Customer & Order) => {
    const currentUser = useAuthStore.getState().user;
    const adminStore = useAdminStore.getState();

    if (currentUser?.role === 'admin' && order.status === 'completed') {
      toast.success(`Order delivered: Table ${order.tableNumber} (${order.customerName})`, {
        duration: 1500,
      });
      addRealtimeNotification({
        userId: currentUser.userId,
        title: 'Order delivered',
        message: `Table ${order.tableNumber} - ${order.customerName} is fully delivered`,
        kind: 'success',
        orderId: order._id,
      });
    }

    if (order.status === 'completed') {
      adminStore.setOngoingOrders(adminStore.ongoingOrders.filter((o) => o._id !== order._id));
      adminStore.setCompletedOrders([
        order as Customer,
        ...adminStore.completedOrders.filter((o) => o._id !== order._id),
      ]);
    } else {
      adminStore.setOngoingOrders(
        adminStore.ongoingOrders.map((o) => (o._id === order._id ? (order as Customer) : o))
      );
    }

    const orderStore = useOrderStore.getState();
    const existingMyOrder = orderStore.myOrders.find((o) => o._id === order._id);
    const shouldKeepVisibleUntilDone =
      Boolean(
        currentUser &&
          currentUser.role !== 'admin' &&
          existingMyOrder &&
          (isOrderAssignedToUser(order as Order, currentUser.userId) ||
            (currentUser.role === 'server' && hasUserItems(order as Order, currentUser.userId)))
      ) &&
      !hasUndeliveredItems(order as Order);

    if (shouldShowInMyOrders(order as Order, currentUser)) {
      if (existingMyOrder) {
        orderStore.updateOrderInMyOrders(order._id, order as Order);
      } else {
        orderStore.addToMyOrders(order as Order);
      }
    } else if (shouldKeepVisibleUntilDone) {
      orderStore.updateOrderInMyOrders(order._id, order as Order);
    } else {
      orderStore.removeFromMyOrders(order._id);
    }
  });

  socketInstance.on(SOCKET_EVENTS.ORDER_DELETED, (data: { _id: string }) => {
    const adminStore = useAdminStore.getState();
    adminStore.setOngoingOrders(adminStore.ongoingOrders.filter((o) => o._id !== data._id));
    adminStore.setCompletedOrders(adminStore.completedOrders.filter((o) => o._id !== data._id));
    const orderStore = useOrderStore.getState();
    orderStore.removeFromMyOrders(data._id);
  });

  // =====================
  // MENU EVENTS
  // =====================
  socketInstance.on(SOCKET_EVENTS.MENU_ITEM_CREATED, (item: MenuItem) => {
    const adminStore = useAdminStore.getState();
    adminStore.addMenuItem(item);
    toast.info('New menu item added', { duration: 1000 });
  });

  socketInstance.on(SOCKET_EVENTS.MENU_ITEM_UPDATED, (item: MenuItem) => {
    const adminStore = useAdminStore.getState();
    adminStore.updateMenuItem(item._id, item);
  });

  socketInstance.on(SOCKET_EVENTS.MENU_ITEM_DELETED, (data: { _id: string }) => {
    const adminStore = useAdminStore.getState();
    adminStore.removeMenuItem(data._id);
    toast.info('Menu item removed', { duration: 1000 });
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
    toast.info('New staff account created', { duration: 1000 });
  });

  socketInstance.on(SOCKET_EVENTS.SERVER_UPDATED, (server: Server) => {
    const adminStore = useAdminStore.getState();
    adminStore.updateServer(server._id, server);
  });

  socketInstance.on(SOCKET_EVENTS.SERVER_DELETED, (data: { _id: string }) => {
    const adminStore = useAdminStore.getState();
    adminStore.removeServer(data._id);
    toast.info('Staff account removed', { duration: 1000 });
  });

  socketInstance.on(SOCKET_EVENTS.SERVER_TOGGLED, (server: Server) => {
    const adminStore = useAdminStore.getState();
    adminStore.updateServer(server._id, { isActive: server.isActive });
  });
}
