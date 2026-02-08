import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import { Order } from '@/lib/models';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/api-response';

// GET /api/bills - Get all paid orders (bills) - Admin only
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (!isAdmin(user)) {
      return forbiddenResponse('Only admin can view bills');
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const tableNumber = searchParams.get('tableNumber');

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = { status: 'paid' };

    if (startDate || endDate) {
      query.paidAt = {};
      if (startDate) {
        query.paidAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.paidAt.$lte = new Date(endDate);
      }
    }

    if (tableNumber) {
      query.tableNumber = parseInt(tableNumber);
    }

    const bills = await Order.find(query)
      .sort({ paidAt: -1 })
      .lean();

    // Calculate totals
    const totalAmount = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);

    return successResponse({
      bills,
      total: bills.length,
      totalAmount,
    });
  } catch (error) {
    console.error('Get bills error:', error);
    return serverErrorResponse('Failed to fetch bills');
  }
}
