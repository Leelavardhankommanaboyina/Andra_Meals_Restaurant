'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';

export interface OrderUpdatePayload {
  type: 'new_order' | 'order_updated' | 'order_completed' | 'order_paid' | 'items_added';
  order: {
    _id: string;
    tableNumber: number;
    customerName: string;
    status: string;
    items: Array<{
      name: string;
      price: number;
      quantity: number;
      isDelivered: boolean;
    }>;
    totalAmount: number;
    serverName: string;
    createdAt: string;
  };
}

export interface MenuUpdatePayload {
  type: 'item_added' | 'item_updated' | 'item_deleted';
  item: {
    _id: string;
    name: string;
    price: number;
    category: string;
    isActive: boolean;
  };
}

export interface ServerUpdatePayload {
  type: 'server_added' | 'server_updated' | 'server_deleted';
  server: {
    _id: string;
    username: string;
    isActive: boolean;
  };
}

interface UseSocketOptions {
  onOrderUpdate?: (payload: OrderUpdatePayload) => void;
  onMenuUpdate?: (payload: MenuUpdatePayload) => void;
  onServerUpdate?: (payload: ServerUpdatePayload) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const { user, isAuthenticated } = useAuthStore();

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socketRef.current.on('connect', () => {
      console.log('Socket connected');
      // Join appropriate room based on role
      if (user?.role === 'admin') {
        socketRef.current?.emit('join_room', 'admin');
      } else if (user?.role === 'server') {
        socketRef.current?.emit('join_room', 'servers');
      }
    });

    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    // Set up event listeners
    if (options.onOrderUpdate) {
      socketRef.current.on('order_update', options.onOrderUpdate);
    }

    if (options.onMenuUpdate) {
      socketRef.current.on('menu_update', options.onMenuUpdate);
    }

    if (options.onServerUpdate) {
      socketRef.current.on('server_update', options.onServerUpdate);
    }
  }, [user?.role, options]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, user, connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected || false,
    connect,
    disconnect,
  };
}
