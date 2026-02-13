import { z } from 'zod';

// Auth validation schemas
export const loginSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .trim(),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),
});

export const registerServerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .trim()
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(50, 'Password cannot exceed 50 characters'),
  role: z.enum(['server', 'servent']).optional().default('server'),
});

export const staffRoleSchema = z.enum(['server', 'servent']);

export const orderAssignmentSchema = z
  .object({
    mode: z.enum(['manual', 'auto']).default('auto'),
    assigneeRole: staffRoleSchema,
    assigneeId: z.string().min(1, 'Assignee is required').optional(),
  })
  .refine((value) => value.mode === 'auto' || Boolean(value.assigneeId), {
    message: 'Assignee is required for manual assignment',
    path: ['assigneeId'],
  });

// Menu item validation schemas
export const menuItemSchema = z.object({
  name: z
    .string()
    .min(1, 'Item name is required')
    .max(100, 'Item name cannot exceed 100 characters')
    .trim(),
  price: z
    .number()
    .min(0, 'Price cannot be negative')
    .max(10000, 'Price seems too high'),
  category: z
    .string()
    .min(1, 'Category is required')
    .max(50, 'Category cannot exceed 50 characters')
    .trim(),
});

export const updateMenuItemSchema = menuItemSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Order validation schemas
const MIN_TABLE = parseInt(process.env.NEXT_PUBLIC_MIN_TABLE_NUMBER || '1');
const MAX_TABLE = parseInt(process.env.NEXT_PUBLIC_MAX_TABLE_NUMBER || '20');

export const tableNumberSchema = z.object({
  tableNumber: z
    .number()
    .int('Table number must be a whole number')
    .min(MIN_TABLE, `Table number must be at least ${MIN_TABLE}`)
    .max(MAX_TABLE, `Table number cannot exceed ${MAX_TABLE}`),
});

export const customerNameSchema = z.object({
  customerName: z
    .string()
    .min(1, 'Customer name is required')
    .max(50, 'Customer name cannot exceed 50 characters')
    .trim(),
});

export const orderItemSchema = z.object({
  menuItemId: z.string().min(1, 'Menu item ID is required'),
  name: z.string().min(1, 'Item name is required'),
  price: z.number().min(0, 'Price cannot be negative'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(99, 'Quantity cannot exceed 99'),
});

export const createOrderSchema = z.object({
  tableNumber: z
    .number()
    .int('Table number must be a whole number')
    .min(MIN_TABLE, `Table number must be at least ${MIN_TABLE}`)
    .max(999, 'Table number seems invalid'),
  customerName: z
    .string()
    .min(1, 'Customer name is required')
    .max(50, 'Customer name cannot exceed 50 characters')
    .trim(),
  groupSize: z
    .number()
    .int('Group size must be a whole number')
    .min(1, 'Group size must be at least 1')
    .max(30, 'Group size cannot exceed 30')
    .optional(),
  items: z
    .array(orderItemSchema)
    .min(1, 'Order must have at least one item'),
  clientRequestId: z
    .string()
    .min(8, 'Client request ID is invalid')
    .max(120, 'Client request ID is too long')
    .optional(),
  assignment: orderAssignmentSchema.optional(),
});

export const addItemsToOrderSchema = z.object({
  items: z
    .array(orderItemSchema)
    .min(1, 'Must add at least one item'),
});

const orderItemReferenceSchema = z
  .object({
    itemId: z.string().min(1, 'Item ID is required').optional(),
    itemIndex: z.number().int().min(0).optional(),
  })
  .refine((value) => value.itemId !== undefined || value.itemIndex !== undefined, {
    message: 'Provide itemId or itemIndex',
  });

export const updateItemDeliverySchema = orderItemReferenceSchema.extend({
  isDelivered: z.boolean(),
});

export const removeOrderItemSchema = orderItemReferenceSchema;

// Search validation
export const searchSchema = z.object({
  query: z.string().max(100, 'Search query too long').optional(),
  category: z.string().max(50).optional(),
  activeOnly: z.boolean().optional().default(true),
});

// Pagination validation
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// Date range validation for reports
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterServerInput = z.infer<typeof registerServerSchema>;
export type StaffRoleInput = z.infer<typeof staffRoleSchema>;
export type MenuItemInput = z.infer<typeof menuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderAssignmentInput = z.infer<typeof orderAssignmentSchema>;
export type AddItemsToOrderInput = z.infer<typeof addItemsToOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
