import { create } from 'zustand';

export interface OrderItem {
  menuItem?: string;  // From API response
  menuItemId?: string;  // For creating new orders
  name: string;
  price: number;
  quantity: number;
  isDelivered?: boolean;
  addedByServerId?: string;
  addedByServerName?: string;
}

export interface Order {
  _id: string;
  tableNumber: number;
  customerName: string;
  items: OrderItem[];
  status: 'ongoing' | 'completed' | 'paid';
  serverId?: string;
  serverName?: string;
  totalAmount: number;
  createdAt: string;
  updatedAt?: string;
}

interface NewOrderState {
  step: 'table' | 'customer' | 'items';
  tableNumber: number | null;
  customerName: string;
  items: OrderItem[];
  isOldOrder: boolean;
  selectedOrderId: string | null;
}

interface OrderState {
  // New order flow state
  newOrder: NewOrderState;

  // My orders (ongoing orders for current server)
  myOrders: Order[];

  // Order history (completed orders)
  orderHistory: Order[];

  // Actions for new order flow
  setTableNumber: (tableNumber: number) => void;
  setCustomerName: (name: string) => void;
  setStep: (step: 'table' | 'customer' | 'items') => void;
  addItem: (item: Omit<OrderItem, 'isDelivered'>) => void;
  removeItem: (menuItemId: string) => void;
  updateItemQuantity: (menuItemId: string, quantity: number) => void;
  resetNewOrder: () => void;

  // Old order mode
  setOldOrderMode: (isOldOrder: boolean) => void;
  setSelectedOrderId: (orderId: string | null) => void;

  // My orders actions
  setMyOrders: (orders: Order[]) => void;
  addToMyOrders: (order: Order) => void;
  updateOrderInMyOrders: (orderId: string, updates: Partial<Order>) => void;
  removeFromMyOrders: (orderId: string) => void;
  updateItemDeliveryStatus: (orderId: string, itemIndex: number, isDelivered: boolean) => void;

  // Order history actions
  setOrderHistory: (orders: Order[]) => void;
  addToOrderHistory: (order: Order) => void;
}

const initialNewOrderState: NewOrderState = {
  step: 'table',
  tableNumber: null,
  customerName: '',
  items: [],
  isOldOrder: false,
  selectedOrderId: null,
};

export const useOrderStore = create<OrderState>((set) => ({
  newOrder: { ...initialNewOrderState },
  myOrders: [],
  orderHistory: [],

  // New order flow actions
  setTableNumber: (tableNumber) =>
    set((state) => ({
      newOrder: { ...state.newOrder, tableNumber },
    })),

  setCustomerName: (customerName) =>
    set((state) => ({
      newOrder: { ...state.newOrder, customerName },
    })),

  setStep: (step) =>
    set((state) => ({
      newOrder: { ...state.newOrder, step },
    })),

  addItem: (item) =>
    set((state) => {
      const existingIndex = state.newOrder.items.findIndex(
        (i) => i.menuItemId === item.menuItemId
      );

      if (existingIndex >= 0) {
        const updatedItems = [...state.newOrder.items];
        updatedItems[existingIndex].quantity += item.quantity;
        return {
          newOrder: { ...state.newOrder, items: updatedItems },
        };
      }

      return {
        newOrder: {
          ...state.newOrder,
          items: [...state.newOrder.items, { ...item, isDelivered: false }],
        },
      };
    }),

  removeItem: (menuItemId) =>
    set((state) => ({
      newOrder: {
        ...state.newOrder,
        items: state.newOrder.items.filter((i) => i.menuItemId !== menuItemId),
      },
    })),

  updateItemQuantity: (menuItemId, quantity) =>
    set((state) => ({
      newOrder: {
        ...state.newOrder,
        items: state.newOrder.items.map((item) =>
          item.menuItemId === menuItemId ? { ...item, quantity } : item
        ),
      },
    })),

  resetNewOrder: () =>
    set({ newOrder: { ...initialNewOrderState } }),

  setOldOrderMode: (isOldOrder) =>
    set((state) => ({
      newOrder: { ...state.newOrder, isOldOrder },
    })),

  setSelectedOrderId: (selectedOrderId) =>
    set((state) => ({
      newOrder: { ...state.newOrder, selectedOrderId },
    })),

  // My orders actions
  setMyOrders: (orders) => set({ myOrders: orders }),

  addToMyOrders: (order) =>
    set((state) => ({
      myOrders: [order, ...state.myOrders],
    })),

  updateOrderInMyOrders: (orderId, updates) =>
    set((state) => ({
      myOrders: state.myOrders.map((order) =>
        order._id === orderId ? { ...order, ...updates } : order
      ),
    })),

  removeFromMyOrders: (orderId) =>
    set((state) => ({
      myOrders: state.myOrders.filter((order) => order._id !== orderId),
    })),

  updateItemDeliveryStatus: (orderId, itemIndex, isDelivered) =>
    set((state) => ({
      myOrders: state.myOrders.map((order) => {
        if (order._id !== orderId) return order;
        const updatedItems = [...order.items];
        if (updatedItems[itemIndex]) {
          updatedItems[itemIndex] = { ...updatedItems[itemIndex], isDelivered };
        }
        // Sort items: undelivered first
        updatedItems.sort((a, b) => {
          if (a.isDelivered === b.isDelivered) return 0;
          return a.isDelivered ? 1 : -1;
        });
        return { ...order, items: updatedItems };
      }),
    })),

  // Order history actions
  setOrderHistory: (orders) => set({ orderHistory: orders }),

  addToOrderHistory: (order) =>
    set((state) => ({
      orderHistory: [order, ...state.orderHistory],
    })),
}));
