import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { MenuItem, Order, Table, User } from '@/lib/models';
import { getCurrentUser } from '@/lib/auth';
import { createOrderSchema, orderAssignmentSchema } from '@/lib/validations';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/api-response';
import { emitSocketEvent, ROOMS, SOCKET_EVENTS } from '@/lib/socket-emit';
import { ensureDefaultTablesConfigured } from '@/lib/tables';
import { resolveAssignee } from '@/lib/order-assignment';

type RequestedOrderItem = {
  menuItemId: string;
  quantity: number;
};

type MenuItemLookupResult =
  | { error: string }
  | { menuItemById: Map<string, { name: string; price: number }> };

async function resolveMenuItems(items: RequestedOrderItem[]): Promise<MenuItemLookupResult> {
  const uniqueMenuItemIds = Array.from(new Set(items.map((item) => item.menuItemId)));

  if (uniqueMenuItemIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    return { error: 'One or more menu item IDs are invalid' };
  }

  const menuItems = await MenuItem.find({
    _id: { $in: uniqueMenuItemIds },
    isActive: true,
  })
    .select('_id name price')
    .lean();

  if (menuItems.length !== uniqueMenuItemIds.length) {
    return { error: 'One or more menu items are unavailable' };
  }

  const menuItemById = new Map(
    menuItems.map((item) => [item._id.toString(), { name: item.name, price: item.price }])
  );

  return { menuItemById };
}

// GET /api/orders - Get orders based on role and filters
export async function GET(_request: NextRequest) {
  try {
    await dbConnect();

    const user = await getCurrentUser(_request);
    if (!user) {
      return unauthorizedResponse();
    }

    const searchParams = _request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const tableNumber = searchParams.get('tableNumber');
    const serverId = searchParams.get('serverId');
    const myOrders = searchParams.get('myOrders') === 'true';
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const includeTotal = searchParams.get('includeTotal') === 'true';
    const shouldPaginate = pageParam !== null || limitParam !== null;
    const parsedPage = parseInt(pageParam || '1');
    const parsedLimit = parseInt(limitParam || '20');
    const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit =
      Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 20;

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {};
    const userObjectId = new mongoose.Types.ObjectId(user.userId);
    const isServerLikeUser = user.role === 'server' || user.role === 'servent';
    const wantsMyOrders = myOrders && isServerLikeUser;

    if (status) {
      if (status === 'active') {
        query.status = { $in: ['ongoing', 'completed'] };
      } else if (status === 'history') {
        query.status = { $in: ['completed', 'paid'] };
      } else if (wantsMyOrders && status === 'ongoing') {
        query.status = { $in: ['ongoing', 'completed'] };
      } else {
        query.status = status;
      }
    } else if (wantsMyOrders) {
      query.status = { $in: ['ongoing', 'completed'] };
    }

    if (wantsMyOrders) {
      const wantsUndeliveredOnly =
        status !== 'history' && status !== 'completed' && status !== 'paid' && status !== 'cancelled';

      const assigneeFilters = [
        { deliveryAssigneeId: userObjectId },
        { deliveryAssigneeId: user.userId }, // Legacy string format
      ];

      const scopedAssigneeFilters = wantsUndeliveredOnly
        ? assigneeFilters.map((assigneeFilter) => ({
            ...assigneeFilter,
            items: { $elemMatch: { isDelivered: false } },
          }))
        : assigneeFilters;

      const roleBasedFilters: Array<Record<string, unknown>> = [...scopedAssigneeFilters];

      // Legacy fallback for historical server-owned orders that do not have assignee fields.
      if (user.role === 'server') {
        const legacyServerFilters = wantsUndeliveredOnly
          ? [
              { items: { $elemMatch: { addedByServerId: userObjectId, isDelivered: false } } },
              { items: { $elemMatch: { addedByServerId: user.userId, isDelivered: false } } }, // Legacy string format
            ]
          : [
              { 'items.addedByServerId': userObjectId },
              { 'items.addedByServerId': user.userId }, // Legacy string format
              { serverId: userObjectId },
              { serverId: user.userId }, // Legacy string format
            ];

        for (const legacyFilter of legacyServerFilters) {
          if (wantsUndeliveredOnly) {
            roleBasedFilters.push({
              $and: [
                { $or: [{ deliveryAssigneeId: { $exists: false } }, { deliveryAssigneeId: null }] },
                legacyFilter,
              ],
            });
          } else {
            roleBasedFilters.push(legacyFilter);
          }
        }
      }

      query.$or = roleBasedFilters;
    }

    // Admin can filter by serverId
    if (user.role === 'admin' && serverId) {
      query.serverId = serverId;
    }

    if (tableNumber) {
      query.tableNumber = parseInt(tableNumber);
    }

    const projection =
      '_id tableNumber customerName groupSize items status serverId serverName deliveryAssigneeId deliveryAssigneeName deliveryAssigneeRole assignedById assignedByName assignedAt totalAmount createdAt updatedAt paidAt';

    if (shouldPaginate) {
      const skip = (page - 1) * limit;
      if (includeTotal) {
        const [orders, total] = await Promise.all([
          Order.find(query).select(projection).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
          Order.countDocuments(query),
        ]);

        return successResponse({
          orders,
          total,
          pagination: {
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
            hasNext: skip + orders.length < total,
            hasPrev: page > 1,
          },
        });
      }

      // Fast path: avoid an extra countDocuments() round trip when the caller doesn't need totals.
      const ordersPlusOne = await Order.find(query)
        .select(projection)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit + 1)
        .lean();

      const hasNext = ordersPlusOne.length > limit;
      const orders = hasNext ? ordersPlusOne.slice(0, limit) : ordersPlusOne;

      return successResponse({
        orders,
        total: orders.length,
        pagination: {
          page,
          limit,
          totalPages: page + (hasNext ? 1 : 0),
          hasNext,
          hasPrev: page > 1,
        },
      });
    }

    const orders = await Order.find(query).select(projection).sort({ createdAt: -1 }).lean();
    return successResponse({
      orders,
      total: orders.length,
    });
  } catch {
    return serverErrorResponse('Failed to fetch orders');
  }
}

// POST /api/orders - Create new order
export async function POST(request: NextRequest) {
  let requestIdForRetry: string | undefined;

  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();

    // Validate input
    const validationResult = createOrderSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((e) => e.message);
      return errorResponse(errors.join(', '));
    }

    requestIdForRetry = validationResult.data.clientRequestId;
    const { tableNumber, customerName, groupSize, items, assignment, clientRequestId } = validationResult.data;

    // Idempotency: if the same client request is retried, return the already-created order.
    if (clientRequestId) {
      const existingByRequestId = await Order.findOne({ clientRequestId }).lean();
      if (existingByRequestId) {
        return successResponse(existingByRequestId, 'Order already created');
      }
    }

    await ensureDefaultTablesConfigured();
    const table = await Table.findOne({ tableNumber }).select('tableNumber').lean();
    if (!table) {
      return errorResponse(`Table ${tableNumber} is not configured`);
    }

    // Helper function to escape regex special characters
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Check for duplicate customer name on the same table (active orders only)
    const existingOrder = await Order.findOne({
      tableNumber,
      customerName: { $regex: new RegExp(`^${escapeRegex(customerName)}$`, 'i') },
      status: { $in: ['ongoing', 'completed'] },
    });

    if (existingOrder) {
      return errorResponse(
        `Customer "${customerName}" already has an active order at table ${tableNumber}. Please use a unique name.`
      );
    }

    // Get actor info
    const actorUser = await User.findById(user.userId).select('_id username role').lean();
    if (!actorUser) {
      return errorResponse('User not found');
    }

    if (actorUser.role === 'servent') {
      return forbiddenResponse('Servent cannot create orders');
    }

    const resolvedMenuItems = await resolveMenuItems(items);
    if ('error' in resolvedMenuItems) {
      return errorResponse(resolvedMenuItems.error);
    }

    let deliveryAssignee:
      | {
          _id: mongoose.Types.ObjectId;
          username: string;
          role: 'server' | 'servent';
        }
      | undefined;

    if (actorUser.role === 'admin') {
      if (!assignment) {
        return errorResponse('Assignment is required when admin creates an order');
      }

      const assignmentValidation = orderAssignmentSchema.safeParse(assignment);
      if (!assignmentValidation.success) {
        return errorResponse(
          assignmentValidation.error.issues.map((issue) => issue.message).join(', ')
        );
      }

      const assigneeResult = await resolveAssignee(assignmentValidation.data);
      if (!assigneeResult.assignee) {
        return errorResponse(assigneeResult.error || 'Unable to assign order');
      }
      deliveryAssignee = assigneeResult.assignee;
    } else {
      deliveryAssignee = {
        _id: actorUser._id as mongoose.Types.ObjectId,
        username: actorUser.username,
        role: 'server',
      };
    }

    // Create order with server-validated item names and prices
    const actorObjectId = new mongoose.Types.ObjectId(user.userId);
    const orderItems = items.map((item) => ({
      menuItem: item.menuItemId,
      name: resolvedMenuItems.menuItemById.get(item.menuItemId)!.name,
      price: resolvedMenuItems.menuItemById.get(item.menuItemId)!.price,
      quantity: item.quantity,
      isDelivered: false,
      addedByServerId: actorObjectId,
      addedByServerName: actorUser.username,
    }));

    const newOrder = await Order.create({
      tableNumber,
      customerName,
      clientRequestId,
      groupSize: groupSize ?? null,
      items: orderItems,
      serverId: actorObjectId,
      serverName: actorUser.username,
      deliveryAssigneeId: deliveryAssignee?._id,
      deliveryAssigneeName: deliveryAssignee?.username,
      deliveryAssigneeRole: deliveryAssignee?.role,
      assignedById: actorObjectId,
      assignedByName: actorUser.username,
      assignedAt: new Date(),
      status: 'ongoing',
    });

    // Emit real-time event
    emitSocketEvent(SOCKET_EVENTS.ORDER_CREATED, newOrder, [ROOMS.ADMIN, ROOMS.SERVERS]);
    if (newOrder.deliveryAssigneeId) {
      emitSocketEvent(SOCKET_EVENTS.ORDER_ASSIGNED, newOrder, [ROOMS.ADMIN, ROOMS.SERVERS]);
    }

    return successResponse(newOrder, 'Order created successfully', 201);
  } catch (error) {
    const mongoError = error as { code?: number; keyPattern?: Record<string, number> };
    if (mongoError.code === 11000 && mongoError.keyPattern?.clientRequestId) {
      if (requestIdForRetry) {
        const existingByRequestId = await Order.findOne({ clientRequestId: requestIdForRetry }).lean();
        if (existingByRequestId) {
          return successResponse(existingByRequestId, 'Order already created');
        }
      }
      return errorResponse('Duplicate submit detected. Please refresh orders.');
    }
    return serverErrorResponse('Failed to create order');
  }
}
