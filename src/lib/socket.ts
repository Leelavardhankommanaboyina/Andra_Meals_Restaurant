import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

let io: SocketIOServer | null = null;

// Socket event types
export const SOCKET_EVENTS = {
  // Order events
  ORDER_CREATED: 'order:created',
  ORDER_UPDATED: 'order:updated',
  ORDER_DELETED: 'order:deleted',
  ORDER_ITEM_DELIVERED: 'order:item-delivered',
  ORDER_COMPLETED: 'order:completed',
  ORDER_PAID: 'order:paid',

  // Menu events
  MENU_ITEM_CREATED: 'menu:item-created',
  MENU_ITEM_UPDATED: 'menu:item-updated',
  MENU_ITEM_DELETED: 'menu:item-deleted',
  MENU_ITEM_TOGGLED: 'menu:item-toggled',

  // Server/Staff events
  SERVER_CREATED: 'server:created',
  SERVER_UPDATED: 'server:updated',
  SERVER_DELETED: 'server:deleted',
  SERVER_TOGGLED: 'server:toggled',

  // Connection events
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
} as const;

// Room names
export const ROOMS = {
  ADMIN: 'admin',
  SERVERS: 'servers',
} as const;

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

export function initializeSocket(httpServer: HTTPServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    path: '/api/socketio',
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    // Join room based on role
    socket.on(SOCKET_EVENTS.JOIN_ROOM, (room: string) => {
      socket.join(room);
      console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    socket.on(SOCKET_EVENTS.LEAVE_ROOM, (room: string) => {
      socket.leave(room);
      console.log(`Socket ${socket.id} left room: ${room}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function setIO(socketIO: SocketIOServer): void {
  io = socketIO;
}

// Helper to emit events
export function emitEvent(event: string, data: unknown, room?: string): void {
  if (!io) {
    console.warn('Socket.io not initialized');
    return;
  }

  if (room) {
    io.to(room).emit(event, data);
  } else {
    io.emit(event, data);
  }
}

// Emit functions for real-time updates
export function emitOrderUpdate(payload: OrderUpdatePayload): void {
  if (io) {
    io.to(ROOMS.ADMIN).emit('order_update', payload);
    io.to(ROOMS.SERVERS).emit('order_update', payload);
  }
}

export function emitMenuUpdate(payload: MenuUpdatePayload): void {
  if (io) {
    io.to(ROOMS.ADMIN).emit('menu_update', payload);
    io.to(ROOMS.SERVERS).emit('menu_update', payload);
  }
}

export function emitServerUpdate(payload: ServerUpdatePayload): void {
  if (io) {
    io.to(ROOMS.ADMIN).emit('server_update', payload);
  }
}
