import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { MenuItem, Order, Table, User } from '@/lib/models';
import { getCurrentUser } from '@/lib/auth';
import { createOrderSchema } from '@/lib/validations';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/api-response';
import { emitSocketEvent, ROOMS, SOCKET_EVENTS } from '@/lib/socket-emit';
import { ensureDefaultTablesConfigured } from '@/lib/tables';

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

    // For "My Orders" - find orders where I have items to deliver
    // This supports the distributed system where any server can add items
    if (user.role === 'server' && myOrders) {
      if (status === 'ongoing') {
        // "My Orders" should only include orders where this server still has undelivered items.
        query.$or = [
          { items: { $elemMatch: { addedByServerId: userObjectId, isDelivered: false } } },
          { items: { $elemMatch: { addedByServerId: user.userId, isDelivered: false } } }, // Legacy string format
        ];
      } else {
        // For history-like views, include orders this server participated in.
        query.$or = [
          { 'items.addedByServerId': userObjectId },
          { 'items.addedByServerId': user.userId }, // Legacy string format
          { serverId: userObjectId },
          { serverId: user.userId }, // Legacy string format
        ];
      }
    }

    // Admin can filter by serverId
    if (user.role === 'admin' && serverId) {
      query.serverId = serverId;
    }

    // For My Orders, we need to find orders with undelivered items regardless of status
    // (because items may be added to completed orders)
    if (status) {
      if (status === 'active') {
        query.status = { $in: ['ongoing', 'completed'] };
      } else if (user.role === 'server' && myOrders && status === 'ongoing') {
        // For server's My Orders, include both ongoing AND completed orders
        // (completed orders may have new undelivered items added via Old Order)
        query.status = { $in: ['ongoing', 'completed'] };
      } else {
        query.status = status;
      }
    } else if (user.role === 'server' && myOrders) {
      // Default to active states for server my-orders queries.
      query.status = { $in: ['ongoing', 'completed'] };
    }

    if (tableNumber) {
      query.tableNumber = parseInt(tableNumber);
    }

    const projection =
      '_id tableNumber customerName groupSize items status serverId serverName totalAmount createdAt updatedAt paidAt';

    if (shouldPaginate) {
      const skip = (page - 1) * limit;
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

    const { tableNumber, customerName, groupSize, items } = validationResult.data;

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

    // Get server info
    const serverUser = await User.findById(user.userId).lean();
    if (!serverUser) {
      return errorResponse('Server not found');
    }

    const resolvedMenuItems = await resolveMenuItems(items);
    if ('error' in resolvedMenuItems) {
      return errorResponse(resolvedMenuItems.error);
    }

    // Create order with server-validated item names and prices
    const serverObjectId = new mongoose.Types.ObjectId(user.userId);
    const orderItems = items.map((item) => ({
      menuItem: item.menuItemId,
      name: resolvedMenuItems.menuItemById.get(item.menuItemId)!.name,
      price: resolvedMenuItems.menuItemById.get(item.menuItemId)!.price,
      quantity: item.quantity,
      isDelivered: false,
      addedByServerId: serverObjectId,
      addedByServerName: serverUser.username,
    }));

    const newOrder = await Order.create({
      tableNumber,
      customerName,
      groupSize: groupSize ?? null,
      items: orderItems,
      serverId: serverObjectId,
      serverName: serverUser.username,
      status: 'ongoing',
    });

    // Emit real-time event
    emitSocketEvent(SOCKET_EVENTS.ORDER_CREATED, newOrder, [ROOMS.ADMIN, ROOMS.SERVERS]);

    return successResponse(newOrder, 'Order created successfully', 201);
  } catch {
    return serverErrorResponse('Failed to create order');
  }
}
