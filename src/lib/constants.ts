// Order Status Constants
export const ORDER_STATUS = {
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  PAID: 'paid',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

// User Roles
export const USER_ROLES = {
  ADMIN: 'admin',
  SERVER: 'server',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// Table Configuration
export const TABLE_CONFIG = {
  MIN_TABLE_NUMBER: 1,
  MAX_TABLE_NUMBER: 20,
} as const;

// Pagination Defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// Rate Limiting
export const RATE_LIMITS = {
  LOGIN_ATTEMPTS: 5,
  LOGIN_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  API_REQUESTS_PER_MINUTE: 100,
} as const;

// Cookie Configuration
export const COOKIE_CONFIG = {
  AUTH_TOKEN_NAME: 'auth-token',
  MAX_AGE_DAYS: 7,
} as const;

// Socket Events
export const SOCKET_EVENTS = {
  // Order events
  ORDER_CREATED: 'order:created',
  ORDER_UPDATED: 'order:updated',
  ORDER_DELETED: 'order:deleted',
  ORDER_ITEM_DELIVERED: 'order:item-delivered',
  ORDER_COMPLETED: 'order:completed',
  ORDER_PAID: 'order:paid',
  ORDER_CANCELLED: 'order:cancelled',

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

// Socket Rooms
export const SOCKET_ROOMS = {
  ADMIN: 'admin',
  SERVERS: 'servers',
} as const;

// Menu Categories (default)
export const DEFAULT_CATEGORIES = [
  'Starters',
  'Main Course',
  'Biryani',
  'Curries',
  'Breads',
  'Rice',
  'Desserts',
  'Beverages',
] as const;

// Validation Messages
export const VALIDATION_MESSAGES = {
  REQUIRED_FIELD: 'This field is required',
  INVALID_CREDENTIALS: 'Invalid username or password',
  USER_INACTIVE: 'Your account has been deactivated',
  UNAUTHORIZED: 'Please login to continue',
  FORBIDDEN: 'You do not have permission to perform this action',
  NOT_FOUND: 'Resource not found',
  DUPLICATE_NAME: 'A record with this name already exists',
  TABLE_OUT_OF_RANGE: `Table number must be between ${TABLE_CONFIG.MIN_TABLE_NUMBER} and ${TABLE_CONFIG.MAX_TABLE_NUMBER}`,
  PASSWORD_MIN_LENGTH: 'Password must be at least 6 characters',
  CUSTOMER_EXISTS_ON_TABLE: 'Customer already has an active order at this table',
  ALL_ITEMS_MUST_BE_DELIVERED: 'All items must be delivered before completing the order',
  ORDER_MUST_BE_COMPLETED: 'Order must be completed before marking as paid',
} as const;

// API Response Messages
export const API_MESSAGES = {
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logged out successfully',
  ORDER_CREATED: 'Order created successfully',
  ORDER_UPDATED: 'Order updated successfully',
  ORDER_DELETED: 'Order deleted successfully',
  ORDER_CANCELLED: 'Order cancelled successfully',
  MENU_ITEM_ADDED: 'Menu item added successfully',
  MENU_ITEM_UPDATED: 'Menu item updated successfully',
  MENU_ITEM_DELETED: 'Menu item deleted successfully',
  SERVER_ADDED: 'Server added successfully',
  SERVER_UPDATED: 'Server updated successfully',
  SERVER_DELETED: 'Server deleted successfully',
  PAYMENT_COMPLETED: 'Payment marked as completed',
} as const;
