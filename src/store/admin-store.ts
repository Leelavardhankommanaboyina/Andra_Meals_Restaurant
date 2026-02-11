import { create } from 'zustand';
import { menuApi, serversApi, ordersApi, billsApi } from '@/lib/api-client';

export interface MenuItem {
  _id: string;
  name: string;
  price: number;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Server {
  _id: string;
  username: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  _id: string;
  tableNumber: number;
  customerName: string;
  groupSize?: number | null;
  status: 'ongoing' | 'completed' | 'paid';
  items: Array<{
    _id?: string;
    name: string;
    price: number;
    quantity: number;
    isDelivered: boolean;
    addedByServerId?: string;
    addedByServerName?: string;
  }>;
  totalAmount: number;
  serverName: string;
  createdAt: string;
}

export interface Bill {
  _id: string;
  tableNumber: number;
  customerName: string;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  totalAmount: number;
  serverName: string;
  paidAt: string;
}

interface AdminState {
  // Menu items
  menuItems: MenuItem[];
  menuCategories: string[];
  
  // Servers
  servers: Server[];
  
  // Customers/Orders
  ongoingOrders: Customer[];
  completedOrders: Customer[];
  
  // Bills
  bills: Bill[];
  
  // Loading states
  isLoading: boolean;
  
  // Fetch actions
  fetchMenuItems: () => Promise<void>;
  fetchServers: () => Promise<void>;
  fetchOrders: () => Promise<void>;
  fetchBills: (startDate?: string, endDate?: string) => Promise<void>;
  
  // Menu actions
  setMenuItems: (items: MenuItem[]) => void;
  addMenuItem: (item: MenuItem) => void;
  updateMenuItem: (itemId: string, updates: Partial<MenuItem>) => void;
  removeMenuItem: (itemId: string) => void;
  setMenuCategories: (categories: string[]) => void;
  
  // Server actions
  setServers: (servers: Server[]) => void;
  addServer: (server: Server) => void;
  updateServer: (serverId: string, updates: Partial<Server>) => void;
  removeServer: (serverId: string) => void;
  
  // Order/Customer actions
  setOngoingOrders: (orders: Customer[]) => void;
  setCompletedOrders: (orders: Customer[]) => void;
  updateOrderStatus: (orderId: string, status: 'ongoing' | 'completed' | 'paid') => void;
  
  // Bill actions
  setBills: (bills: Bill[]) => void;
  addBill: (bill: Bill) => void;
  
  // Loading
  setLoading: (loading: boolean) => void;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  menuItems: [],
  menuCategories: [],
  servers: [],
  ongoingOrders: [],
  completedOrders: [],
  bills: [],
  isLoading: false,

  // Fetch actions with loading states
  fetchMenuItems: async () => {
    const currentItems = get().menuItems;
    // Skip if already loading or has data (for socket refreshes)
    if (get().isLoading && currentItems.length > 0) return;
    
    if (currentItems.length === 0) set({ isLoading: true });
    try {
      const response = await menuApi.getAll({ activeOnly: false });
      const items = response.data.items as MenuItem[];
      const categories = Array.from(new Set(items.map((item: MenuItem) => item.category)));
      set({ menuItems: items, menuCategories: categories, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch menu items:', error);
      set({ isLoading: false });
    }
  },

  fetchServers: async () => {
    const currentServers = get().servers;
    if (currentServers.length === 0) set({ isLoading: true });
    try {
      const response = await serversApi.getAll();
      set({ servers: response.data.servers as Server[], isLoading: false });
    } catch (error) {
      console.error('Failed to fetch servers:', error);
      set({ isLoading: false });
    }
  },

  fetchOrders: async () => {
    const currentOngoing = get().ongoingOrders;
    if (currentOngoing.length === 0) set({ isLoading: true });
    try {
      const [ongoingRes, completedRes] = await Promise.all([
        ordersApi.getAll({ status: 'ongoing', page: 1, limit: 100 }),
        ordersApi.getAll({ status: 'completed', page: 1, limit: 100 }),
      ]);
      set({
        ongoingOrders: ongoingRes.data.orders as Customer[],
        completedOrders: completedRes.data.orders as Customer[],
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      set({ isLoading: false });
    }
  },

  fetchBills: async (startDate?: string, endDate?: string) => {
    const currentBills = get().bills;
    if (currentBills.length === 0) set({ isLoading: true });
    try {
      const response = await billsApi.getAll({ startDate, endDate, page: 1, limit: 200 });
      set({ bills: response.data.bills as Bill[], isLoading: false });
    } catch (error) {
      console.error('Failed to fetch bills:', error);
      set({ isLoading: false });
    }
  },

  // Menu actions
  setMenuItems: (menuItems) => {
    const categories = Array.from(new Set(menuItems.map((item) => item.category)));
    set({ menuItems, menuCategories: categories });
  },

  addMenuItem: (item) =>
    set((state) => {
      const existingIndex = state.menuItems.findIndex((menuItem) => menuItem._id === item._id);
      const categories = state.menuCategories.includes(item.category)
        ? state.menuCategories
        : [...state.menuCategories, item.category];

      if (existingIndex >= 0) {
        const updatedItems = [...state.menuItems];
        updatedItems[existingIndex] = item;
        return {
          menuItems: updatedItems,
          menuCategories: categories,
        };
      }

      return {
        menuItems: [item, ...state.menuItems],
        menuCategories: categories,
      };
    }),

  updateMenuItem: (itemId, updates) =>
    set((state) => ({
      menuItems: state.menuItems.map((item) =>
        item._id === itemId ? { ...item, ...updates } : item
      ),
    })),

  removeMenuItem: (itemId) =>
    set((state) => ({
      menuItems: state.menuItems.filter((item) => item._id !== itemId),
    })),

  setMenuCategories: (categories) => set({ menuCategories: categories }),

  // Server actions
  setServers: (servers) => set({ servers }),

  addServer: (server) =>
    set((state) => {
      const existingIndex = state.servers.findIndex((existingServer) => existingServer._id === server._id);
      if (existingIndex >= 0) {
        const updatedServers = [...state.servers];
        updatedServers[existingIndex] = server;
        return { servers: updatedServers };
      }
      return { servers: [server, ...state.servers] };
    }),

  updateServer: (serverId, updates) =>
    set((state) => ({
      servers: state.servers.map((server) =>
        server._id === serverId ? { ...server, ...updates } : server
      ),
    })),

  removeServer: (serverId) =>
    set((state) => ({
      servers: state.servers.filter((server) => server._id !== serverId),
    })),

  // Order actions
  setOngoingOrders: (ongoingOrders) => set({ ongoingOrders }),

  setCompletedOrders: (completedOrders) => set({ completedOrders }),

  updateOrderStatus: (orderId, status) =>
    set((state) => {
      if (status === 'completed') {
        const order = state.ongoingOrders.find((o) => o._id === orderId);
        if (order) {
          return {
            ongoingOrders: state.ongoingOrders.filter((o) => o._id !== orderId),
            completedOrders: [{ ...order, status }, ...state.completedOrders],
          };
        }
      }
      if (status === 'paid') {
        return {
          completedOrders: state.completedOrders.filter((o) => o._id !== orderId),
        };
      }
      return state;
    }),

  // Bill actions
  setBills: (bills) => set({ bills }),

  addBill: (bill) =>
    set((state) => ({
      bills: [bill, ...state.bills],
    })),

  // Loading
  setLoading: (isLoading) => set({ isLoading }),
}));
