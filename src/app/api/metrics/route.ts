import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import { Order, MenuItem, User } from '@/lib/models';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/api-response';

// GET /api/metrics - Get business metrics (Admin only)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (!isAdmin(user)) {
      return forbiddenResponse('Only admin can view metrics');
    }

    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get('date');

    // Default to today
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const [
      paidSummary,
      totalMenuItems,
      activeMenuItems,
      totalServers,
      activeServers,
      ongoingOrdersCount,
      completedOrdersCount,
    ] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            status: 'paid',
            paidAt: { $gte: startOfDay, $lte: endOfDay },
          },
        },
        {
          $facet: {
            revenue: [
              {
                $group: {
                  _id: null,
                  totalRevenue: { $sum: '$totalAmount' },
                  ordersCount: { $sum: 1 },
                },
              },
              {
                $project: {
                  _id: 0,
                  totalRevenue: 1,
                  ordersCount: 1,
                },
              },
            ],
            items: [
              { $unwind: '$items' },
              {
                $group: {
                  _id: '$items.name',
                  quantity: { $sum: '$items.quantity' },
                  revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                },
              },
              {
                $project: {
                  _id: 0,
                  name: '$_id',
                  quantity: 1,
                  revenue: 1,
                },
              },
              { $sort: { quantity: -1 } },
            ],
          },
        },
      ]),
      MenuItem.countDocuments(),
      MenuItem.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'server' }),
      User.countDocuments({ role: 'server', isActive: true }),
      Order.countDocuments({ status: 'ongoing' }),
      Order.countDocuments({ status: 'completed' }),
    ]);

    const summaryDoc = paidSummary[0] || { revenue: [], items: [] };
    const revenueSummary = summaryDoc.revenue?.[0] || { totalRevenue: 0, ordersCount: 0 };
    const itemsSoldArray = summaryDoc.items || [];
    const totalItemsSold = itemsSoldArray.reduce(
      (sum: number, item: { quantity: number }) => sum + item.quantity,
      0
    );

    return successResponse({
      date: startOfDay.toISOString().split('T')[0],
      revenue: {
        total: revenueSummary.totalRevenue,
        ordersCount: revenueSummary.ordersCount,
      },
      itemsSold: {
        total: totalItemsSold,
        items: itemsSoldArray,
        mostPopular: itemsSoldArray[0] || null,
        leastPopular: itemsSoldArray[itemsSoldArray.length - 1] || null,
      },
      inventory: {
        totalMenuItems,
        activeMenuItems,
      },
      staff: {
        totalServers,
        activeServers,
      },
      orders: {
        ongoing: ongoingOrdersCount,
        completed: completedOrdersCount,
        paid: revenueSummary.ordersCount,
      },
    });
  } catch (error) {
    console.error('Get metrics error:', error);
    return serverErrorResponse('Failed to fetch metrics');
  }
}
