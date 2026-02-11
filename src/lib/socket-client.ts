'use client';

import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS, SOCKET_ROOMS } from './constants';

// Use window object to persist socket across HMR reloads
declare global {
  interface Window {
    __socketInstance?: Socket | null;
    __socketInitialized?: boolean;
  }
}

const getWindowSocket = () => {
  if (typeof window === 'undefined') return { socket: null, initialized: false };
  return {
    socket: window.__socketInstance ?? null,
    initialized: window.__socketInitialized ?? false,
  };
};

const setWindowSocket = (socket: Socket | null, initialized = false) => {
  if (typeof window === 'undefined') return;
  window.__socketInstance = socket;
  window.__socketInitialized = initialized;
};

export const getSocket = (): Socket | null => getWindowSocket().socket;

export const isSocketConnected = (): boolean => getSocket()?.connected ?? false;

export const initSocket = (forceNew = false): Socket => {
  const { socket, initialized } = getWindowSocket();

  if (initialized && socket && !forceNew) {
    console.log('[Socket Client] Reusing existing socket:', socket.id, 'connected:', socket.connected);
    // Reconnect if disconnected
    if (socket.disconnected) {
      console.log('[Socket Client] Reconnecting disconnected socket');
      socket.connect();
    }
    return socket;
  }

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

  setWindowSocket(newSocket, true);
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
  setWindowSocket(null, false);
};

export { SOCKET_EVENTS, SOCKET_ROOMS as ROOMS };
