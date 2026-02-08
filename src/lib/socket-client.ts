'use client';

import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS, SOCKET_ROOMS } from './constants';

// Use window object to persist socket across HMR reloads
declare global {
  interface Window {
    __socketInstance?: Socket | null;
    __socketToken?: string | undefined;
    __socketInitialized?: boolean;
  }
}

const getWindowSocket = () => {
  if (typeof window === 'undefined') return { socket: null, token: undefined, initialized: false };
  return {
    socket: window.__socketInstance ?? null,
    token: window.__socketToken,
    initialized: window.__socketInitialized ?? false,
  };
};

const setWindowSocket = (socket: Socket | null, token?: string, initialized = false) => {
  if (typeof window === 'undefined') return;
  window.__socketInstance = socket;
  window.__socketToken = token;
  window.__socketInitialized = initialized;
};

export const getSocket = (): Socket | null => getWindowSocket().socket;

export const isSocketConnected = (): boolean => getSocket()?.connected ?? false;

export const initSocket = (token?: string, forceNew = false): Socket => {
  const { socket, token: currentToken, initialized } = getWindowSocket();

  // If already initialized with same token, return existing socket
  if (initialized && socket && currentToken === token && !forceNew) {
    console.log('[Socket Client] Reusing existing socket:', socket.id, 'connected:', socket.connected);
    // Reconnect if disconnected
    if (socket.disconnected) {
      console.log('[Socket Client] Reconnecting disconnected socket');
      socket.connect();
    }
    return socket;
  }

  // If token changed or force new, cleanup old socket
  if (socket) {
    console.log('[Socket Client] Cleaning up old socket:', socket.id);
    socket.removeAllListeners();
    socket.disconnect();
  }

  console.log('[Socket Client] Creating new socket connection');

  // Create new socket
  const newSocket = io({
    path: '/api/socketio',
    addTrailingSlash: false,
    auth: {
      token: token,
    },
    withCredentials: true,
    // Stability optimizations
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 30000,
    // Allow polling fallback if WebSocket fails, but prefer WebSocket
    transports: ['polling', 'websocket'],
    upgrade: true,
    forceNew: false,
    autoConnect: true,
  });

  setWindowSocket(newSocket, token, true);
  return newSocket;
};

export const joinRoom = (room: string): void => {
  const socket = getSocket();
  if (socket?.connected) {
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, room);
  }
};

export const leaveRoom = (room: string): void => {
  const socket = getSocket();
  if (socket?.connected) {
    socket.emit(SOCKET_EVENTS.LEAVE_ROOM, room);
  }
};

export const disconnectSocket = (): void => {
  const socket = getSocket();
  if (socket) {
    console.log('[Socket Client] Disconnecting socket:', socket.id);
    socket.removeAllListeners();
    socket.disconnect();
  }
  setWindowSocket(null, undefined, false);
};

export { SOCKET_EVENTS, SOCKET_ROOMS as ROOMS };
