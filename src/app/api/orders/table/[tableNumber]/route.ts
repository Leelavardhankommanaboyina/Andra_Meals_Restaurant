import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import { Order } from '@/lib/models';
import { getCurrentUser } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/api-response';

interface RouteParams {
  params: Promise<{ tableNumber: string }>;
}

// GET /api/orders/table/[tableNumber] - Get active customers at a table
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { tableNumber } = await params;
    const tableNum = parseInt(tableNumber);

    if (isNaN(tableNum)) {
      return errorResponse('Invalid table number');
    }

    // Get all active orders at this table
    const orders = await Order.find({
      tableNumber: tableNum,
      status: { $in: ['ongoing', 'completed'] },
    })
      .sort({ createdAt: -1 })
      .lean();

    const customers = orders.map((order) => ({
      _id: order._id,
      customerName: order.customerName,
      status: order.status,
      itemCount: order.items.length,
      serverName: order.serverName,
      createdAt: order.createdAt,
    }));

    return successResponse({
      tableNumber: tableNum,
      customers,
      total: customers.length,
    });
  } catch (error) {
    console.error('Get table customers error:', error);
    return serverErrorResponse('Failed to fetch table customers');
  }
}
