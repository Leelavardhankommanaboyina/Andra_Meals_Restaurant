const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Socket event types
const SOCKET_EVENTS = {
  ORDER_CREATED: 'order:created',
  ORDER_UPDATED: 'order:updated',
  ORDER_DELETED: 'order:deleted',
  ORDER_ITEM_DELIVERED: 'order:item-delivered',
  ORDER_COMPLETED: 'order:completed',
  ORDER_PAID: 'order:paid',
  ORDER_ASSIGNED: 'order:assigned',
  ORDER_CANCELLED: 'order:cancelled',
  MENU_ITEM_CREATED: 'menu:item-created',
  MENU_ITEM_UPDATED: 'menu:item-updated',
  MENU_ITEM_DELETED: 'menu:item-deleted',
  MENU_ITEM_TOGGLED: 'menu:item-toggled',
  SERVER_CREATED: 'server:created',
  SERVER_UPDATED: 'server:updated',
  SERVER_DELETED: 'server:deleted',
  SERVER_TOGGLED: 'server:toggled',
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
};

const ROOMS = {
  ADMIN: 'admin',
  SERVERS: 'servers',
};

const getTokenFromCookieHeader = (cookieHeader) => {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)auth-token=([^;]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    path: '/api/socketio',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Stability settings to prevent transport close
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000,
    transports: ['polling', 'websocket'],
    allowUpgrades: true,
  });

  // Make io available globally for API routes
  global.io = io;

  // Socket authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || getTokenFromCookieHeader(socket.handshake.headers.cookie);
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return next(new Error('JWT secret is not configured'));
    }
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      socket.data.authenticated = true;
      socket.data.user = decoded;
      return next();
    } catch {
      return next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id, `(${socket.data.user?.username})`);

    socket.on(SOCKET_EVENTS.JOIN_ROOM, (room) => {
      // Validate room based on user role
      if (room === ROOMS.ADMIN && socket.data.user?.role !== 'admin') {
        console.log(`Non-admin user ${socket.data.user?.username} tried to join admin room`);
        return;
      }

      socket.join(room);
      console.log(`Socket ${socket.id} (${socket.data.user?.username}) joined room: ${room}`);
    });

    socket.on(SOCKET_EVENTS.LEAVE_ROOM, (room) => {
      socket.leave(room);
      console.log(`Socket ${socket.id} left room: ${room}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log('> Socket.io server initialized with authentication');
  });
});
