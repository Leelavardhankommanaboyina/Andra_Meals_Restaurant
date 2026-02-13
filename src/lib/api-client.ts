const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || '';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

async function apiClient<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
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
        user: { id: string; username: string; role: 'admin' | 'server' | 'servent' };
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
      data: { user: { id: string; username: string; role: 'admin' | 'server' | 'servent' } };
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
          role: 'server' | 'servent';
          isActive: boolean;
          createdAt: string;
          updatedAt: string;
        }>;
        total: number;
      };
    }>('/api/servers'),

  create: (data: { username: string; password: string; role?: 'server' | 'servent' }) =>
    apiClient('/api/servers', { method: 'POST', body: data }),

  update: (
    id: string,
    data: Partial<{ username: string; password: string; isActive: boolean; role: 'server' | 'servent' }>
  ) =>
    apiClient(`/api/servers/${id}`, { method: 'PATCH', body: data }),

  delete: (id: string) => apiClient(`/api/servers/${id}`, { method: 'DELETE' }),
};

// Orders API
export const ordersApi = {
  getAll: (params?: {
    status?: string;
    tableNumber?: number;
    myOrders?: boolean;
    serverId?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.tableNumber) searchParams.set('tableNumber', String(params.tableNumber));
    if (params?.myOrders) searchParams.set('myOrders', 'true');
    if (params?.serverId) searchParams.set('serverId', params.serverId);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

    return apiClient<{
      success: boolean;
      data: {
        orders: Array<{
          _id: string;
          tableNumber: number;
          customerName: string;
          groupSize?: number | null;
          items: Array<{
            _id?: string;
            menuItem: string;
            name: string;
            price: number;
            quantity: number;
            isDelivered: boolean;
            addedByServerId?: string;
            addedByServerName?: string;
          }>;
          status: 'ongoing' | 'completed' | 'paid' | 'cancelled';
          serverId: string;
          serverName: string;
          deliveryAssigneeId?: string;
          deliveryAssigneeName?: string;
          deliveryAssigneeRole?: 'server' | 'servent';
          assignedById?: string;
          assignedByName?: string;
          assignedAt?: string;
          totalAmount: number;
          createdAt: string;
          updatedAt: string;
        }>;
        total: number;
        pagination?: {
          page: number;
          limit: number;
          totalPages: number;
          hasNext: boolean;
          hasPrev: boolean;
        };
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
        groupSize?: number | null;
        items: Array<{
          _id?: string;
          menuItem: string;
          name: string;
          price: number;
          quantity: number;
          isDelivered: boolean;
          addedByServerId?: string;
          addedByServerName?: string;
        }>;
        status: 'ongoing' | 'completed' | 'paid' | 'cancelled';
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
    groupSize?: number;
    items: Array<{ menuItemId: string; name: string; price: number; quantity: number }>;
    clientRequestId?: string;
    assignment?: {
      mode: 'manual' | 'auto';
      assigneeRole: 'server' | 'servent';
      assigneeId?: string;
    };
  }) => apiClient('/api/orders', { method: 'POST', body: data }),

  update: (
    id: string,
    data: {
      status?: 'ongoing' | 'completed' | 'paid' | 'cancelled';
      items?: Array<{ menuItemId: string; name: string; price: number; quantity: number }>;
      itemDeliveryUpdate?: { itemId?: string; itemIndex?: number; isDelivered: boolean };
      removeItem?: { itemId?: string; itemIndex?: number };
      assign?: {
        mode: 'manual' | 'auto';
        assigneeRole: 'server' | 'servent';
        assigneeId?: string;
      };
    }
  ) => apiClient(`/api/orders/${id}`, { method: 'PATCH', body: data }),

  assign: (
    id: string,
    data: {
      mode: 'manual' | 'auto';
      assigneeRole: 'server' | 'servent';
      assigneeId?: string;
    }
  ) => apiClient(`/api/orders/${id}`, { method: 'PATCH', body: { assign: data } }),

  delete: (id: string) => apiClient(`/api/orders/${id}`, { method: 'DELETE' }),
};

// Bills API
export const billsApi = {
  getAll: (params?: {
    startDate?: string;
    endDate?: string;
    tableNumber?: number;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    if (params?.tableNumber) searchParams.set('tableNumber', String(params.tableNumber));
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

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
        pagination?: {
          page: number;
          limit: number;
          totalPages: number;
          hasNext: boolean;
          hasPrev: boolean;
        };
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

// Tables API
export const tablesApi = {
  getAll: () =>
    apiClient<{
      success: boolean;
      data: {
        tables: Array<{
          _id: string;
          tableNumber: number;
          chairsTop: number;
          chairsBottom: number;
          totalSeats: number;
          occupiedSeats: number;
          availableSeats: number;
          overflowSeats: number;
        }>;
        summary: {
          totalTables: number;
          totalSeats: number;
          occupiedSeats: number;
          availableSeats: number;
        };
      };
    }>('/api/tables'),

  configure: (data: {
    totalTables: number;
    defaultChairsTop?: number;
    defaultChairsBottom?: number;
  }) => apiClient('/api/tables', { method: 'PUT', body: data }),

  updateTable: (tableNumber: number, data: { chairsTop: number; chairsBottom: number }) =>
    apiClient(`/api/tables/${tableNumber}`, { method: 'PATCH', body: data }),
};

// Seed API
export const seedApi = {
  seed: (seedKey: string) =>
    apiClient('/api/seed', {
      method: 'POST',
      headers: { 'x-seed-key': seedKey },
    }),
};

export default apiClient;
