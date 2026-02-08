// Helper function to emit socket events from API routes
export const emitSocketEvent = (event: string, data: unknown, room?: string): void => {
  const io = global.io;
  
  if (!io) {
    console.warn('Socket.io not initialized - event not emitted:', event);
    return;
  }

  // Log connected clients for debugging
  const connectedSockets = io.sockets.sockets.size;
  console.log(`Emitting ${event} to ${connectedSockets} connected clients`);

  if (room) {
    io.to(room).emit(event, data);
  } else {
    io.emit(event, data);
  }
};

// Socket event constants
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
} as const;

export const ROOMS = {
  ADMIN: 'admin',
  SERVERS: 'servers',
} as const;
