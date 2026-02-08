import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { Order, User } from '@/lib/models';
import { getCurrentUser } from '@/lib/auth';
import { createOrderSchema } from '@/lib/validations';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/api-response';
import { emitSocketEvent, SOCKET_EVENTS } from '@/lib/socket-emit';

// GET /api/orders - Get orders based on role and filters
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const tableNumber = searchParams.get('tableNumber');
    const serverId = searchParams.get('serverId');
    const myOrders = searchParams.get('myOrders') === 'true';

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {};

    // For "My Orders" - find orders where I have items to deliver
    // This supports the distributed system where any server can add items
    if (user.role === 'server' && myOrders) {
      // Convert user.userId to ObjectId for proper MongoDB matching
      // Also query for string version to handle legacy data
      const userObjectId = new mongoose.Types.ObjectId(user.userId);
      // Find orders where this server has items OR is the original server
      // Check both ObjectId and string formats for backward compatibility
      query.$or = [
        { 'items.addedByServerId': userObjectId },
        { 'items.addedByServerId': user.userId },  // Legacy string format
        { serverId: userObjectId },
        { serverId: user.userId }  // Legacy string format
      ];
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
    }

    if (tableNumber) {
      query.tableNumber = parseInt(tableNumber);
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // For server's "My Orders", filter to only show orders where they have undelivered items
    let filteredOrders = orders;
    if (user.role === 'server' && myOrders && status === 'ongoing') {
      filteredOrders = orders.filter(order =>
        order.items.some(item =>
          item.addedByServerId?.toString() === user.userId && !item.isDelivered
        )
      );
    }

    return successResponse({
      orders: filteredOrders,
      total: filteredOrders.length,
    });
  } catch (error) {
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

    const { tableNumber, customerName, items } = validationResult.data;

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

    // Create order with items - track which server added each item
    const serverObjectId = new mongoose.Types.ObjectId(user.userId);
    const orderItems = items.map((item) => ({
      menuItem: item.menuItemId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      isDelivered: false,
      addedByServerId: serverObjectId,
      addedByServerName: serverUser.username,
    }));

    const newOrder = await Order.create({
      tableNumber,
      customerName,
      items: orderItems,
      serverId: serverObjectId,
      serverName: serverUser.username,
      status: 'ongoing',
    });

    // Emit real-time event
    emitSocketEvent(SOCKET_EVENTS.ORDER_CREATED, newOrder);

    return successResponse(newOrder, 'Order created successfully', 201);
  } catch (error) {
    return serverErrorResponse('Failed to create order');
  }
}
