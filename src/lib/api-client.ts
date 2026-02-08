import Cookies from 'js-cookie';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || '';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

async function apiClient<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const token = Cookies.get('auth-token');

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    credentials: 'include',
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'An error occurred');
  }

  return data;
}

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    apiClient<{
      success: boolean;
      data: {
        user: { id: string; username: string; role: 'admin' | 'server' };
        token: string;
      };
    }>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    }),

  logout: () =>
    apiClient<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  me: () =>
    apiClient<{
      success: boolean;
      data: { user: { id: string; username: string; role: 'admin' | 'server' } };
    }>('/api/auth/me'),
};

// Menu API
export const menuApi = {
  getAll: (params?: { category?: string; search?: string; activeOnly?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.activeOnly !== undefined) searchParams.set('activeOnly', String(params.activeOnly));

    return apiClient<{
      success: boolean;
      data: {
        items: Array<{
          _id: string;
          name: string;
          price: number;
          category: string;
          isActive: boolean;
          createdAt: string;
          updatedAt: string;
        }>;
        categories: string[];
        total: number;
      };
    }>(`/api/menu?${searchParams.toString()}`);
  },

  create: (data: { name: string; price: number; category: string }) =>
    apiClient('/api/menu', { method: 'POST', body: data }),

  update: (id: string, data: Partial<{ name: string; price: number; category: string; isActive: boolean }>) =>
    apiClient(`/api/menu/${id}`, { method: 'PATCH', body: data }),

  delete: (id: string) => apiClient(`/api/menu/${id}`, { method: 'DELETE' }),
};

// Servers API
export const serversApi = {
  getAll: () =>
    apiClient<{
      success: boolean;
      data: {
        servers: Array<{
          _id: string;
          username: string;
          isActive: boolean;
          createdAt: string;
          updatedAt: string;
        }>;
        total: number;
      };
    }>('/api/servers'),

  create: (data: { username: string; password: string }) =>
    apiClient('/api/servers', { method: 'POST', body: data }),

  update: (id: string, data: Partial<{ username: string; password: string; isActive: boolean }>) =>
    apiClient(`/api/servers/${id}`, { method: 'PATCH', body: data }),

  delete: (id: string) => apiClient(`/api/servers/${id}`, { method: 'DELETE' }),
};

// Orders API
export const ordersApi = {
  getAll: (params?: { status?: string; tableNumber?: number; myOrders?: boolean; serverId?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.tableNumber) searchParams.set('tableNumber', String(params.tableNumber));
    if (params?.myOrders) searchParams.set('myOrders', 'true');
    if (params?.serverId) searchParams.set('serverId', params.serverId);

    return apiClient<{
      success: boolean;
      data: {
        orders: Array<{
          _id: string;
          tableNumber: number;
          customerName: string;
          items: Array<{
            menuItem: string;
            name: string;
            price: number;
            quantity: number;
            isDelivered: boolean;
            addedByServerId?: string;
            addedByServerName?: string;
          }>;
          status: 'ongoing' | 'completed' | 'paid';
          serverId: string;
          serverName: string;
          totalAmount: number;
          createdAt: string;
          updatedAt: string;
        }>;
        total: number;
      };
    }>(`/api/orders?${searchParams.toString()}`);
  },

  getById: (id: string) =>
    apiClient<{
      success: boolean;
      data: {
        _id: string;
        tableNumber: number;
        customerName: string;
        items: Array<{
          menuItem: string;
          name: string;
          price: number;
          quantity: number;
          isDelivered: boolean;
          addedByServerId?: string;
          addedByServerName?: string;
        }>;
        status: 'ongoing' | 'completed' | 'paid';
        totalAmount: number;
        createdAt: string;
      };
    }>(`/api/orders/${id}`),

  getTableCustomers: (tableNumber: number) =>
    apiClient<{
      success: boolean;
      data: {
        tableNumber: number;
        customers: Array<{
          _id: string;
          customerName: string;
          status: string;
          itemCount: number;
          serverName: string;
          createdAt: string;
        }>;
        total: number;
      };
    }>(`/api/orders/table/${tableNumber}`),

  create: (data: {
    tableNumber: number;
    customerName: string;
    items: Array<{ menuItemId: string; name: string; price: number; quantity: number }>;
  }) => apiClient('/api/orders', { method: 'POST', body: data }),

  update: (
    id: string,
    data: {
      status?: 'ongoing' | 'completed' | 'paid';
      items?: Array<{ menuItemId: string; name: string; price: number; quantity: number }>;
      itemDeliveryUpdate?: { itemIndex: number; isDelivered: boolean };
      removeItem?: { itemIndex: number };
    }
  ) => apiClient(`/api/orders/${id}`, { method: 'PATCH', body: data }),

  delete: (id: string) => apiClient(`/api/orders/${id}`, { method: 'DELETE' }),
};

// Bills API
export const billsApi = {
  getAll: (params?: { startDate?: string; endDate?: string; tableNumber?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    if (params?.tableNumber) searchParams.set('tableNumber', String(params.tableNumber));

    return apiClient<{
      success: boolean;
      data: {
        bills: Array<{
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
        }>;
        total: number;
        totalAmount: number;
      };
    }>(`/api/bills?${searchParams.toString()}`);
  },
};

// Metrics API
export const metricsApi = {
  get: (date?: string) => {
    const searchParams = new URLSearchParams();
    if (date) searchParams.set('date', date);

    return apiClient<{
      success: boolean;
      data: {
        date: string;
        revenue: { total: number; ordersCount: number };
        itemsSold: {
          total: number;
          items: Array<{ name: string; quantity: number; revenue: number }>;
          mostPopular: { name: string; quantity: number; revenue: number } | null;
          leastPopular: { name: string; quantity: number; revenue: number } | null;
        };
        inventory: { totalMenuItems: number; activeMenuItems: number };
        staff: { totalServers: number; activeServers: number };
        orders: { ongoing: number; completed: number; paid: number };
      };
    }>(`/api/metrics?${searchParams.toString()}`);
  },
};

// Seed API
export const seedApi = {
  seed: () => apiClient('/api/seed', { method: 'POST' }),
};

export default apiClient;
