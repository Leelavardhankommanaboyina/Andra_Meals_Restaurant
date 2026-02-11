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
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const shouldPaginate = pageParam !== null || limitParam !== null;
    const parsedPage = parseInt(pageParam || '1');
    const parsedLimit = parseInt(limitParam || '20');
    const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit =
      Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 20;
    const skip = (page - 1) * limit;

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

    const summaryPromise = Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          totalBills: { $sum: 1 },
        },
      },
    ]);

    const billsQuery = Order.find(query)
      .select('_id tableNumber customerName items.name items.price items.quantity totalAmount serverName paidAt')
      .sort({ paidAt: -1 });

    const billsPromise = shouldPaginate ? billsQuery.skip(skip).limit(limit).lean() : billsQuery.lean();

    const [summary, bills] = await Promise.all([summaryPromise, billsPromise]);
    const summaryRow = summary[0] || { totalAmount: 0, totalBills: 0 };

    const responseData = {
      bills,
      total: summaryRow.totalBills,
      totalAmount: summaryRow.totalAmount,
    } as {
      bills: typeof bills;
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

    if (shouldPaginate) {
      responseData.pagination = {
        page,
        limit,
        totalPages: Math.ceil(summaryRow.totalBills / limit) || 1,
        hasNext: skip + bills.length < summaryRow.totalBills,
        hasPrev: page > 1,
      };
    }

    return successResponse(responseData);
  } catch (error) {
    console.error('Get bills error:', error);
    return serverErrorResponse('Failed to fetch bills');
  }
}
