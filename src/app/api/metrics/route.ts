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

    // Get paid orders for the day
    const paidOrders = await Order.find({
      status: 'paid',
      paidAt: { $gte: startOfDay, $lte: endOfDay },
    }).lean();

    // Calculate total revenue
    const totalRevenue = paidOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Calculate items sold with quantities
    const itemsSold: Record<string, { name: string; quantity: number; revenue: number }> = {};

    for (const order of paidOrders) {
      for (const item of order.items) {
        if (itemsSold[item.name]) {
          itemsSold[item.name].quantity += item.quantity;
          itemsSold[item.name].revenue += item.price * item.quantity;
        } else {
          itemsSold[item.name] = {
            name: item.name,
            quantity: item.quantity,
            revenue: item.price * item.quantity,
          };
        }
      }
    }

    // Convert to array and sort by quantity (descending)
    const itemsSoldArray = Object.values(itemsSold).sort((a, b) => b.quantity - a.quantity);

    // Calculate total items sold
    const totalItemsSold = itemsSoldArray.reduce((sum, item) => sum + item.quantity, 0);

    // Get counts
    const totalMenuItems = await MenuItem.countDocuments();
    const activeMenuItems = await MenuItem.countDocuments({ isActive: true });
    const totalServers = await User.countDocuments({ role: 'server' });
    const activeServers = await User.countDocuments({ role: 'server', isActive: true });

    // Get ongoing and completed orders count
    const ongoingOrdersCount = await Order.countDocuments({ status: 'ongoing' });
    const completedOrdersCount = await Order.countDocuments({ status: 'completed' });

    return successResponse({
      date: startOfDay.toISOString().split('T')[0],
      revenue: {
        total: totalRevenue,
        ordersCount: paidOrders.length,
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
        paid: paidOrders.length,
      },
    });
  } catch (error) {
    console.error('Get metrics error:', error);
    return serverErrorResponse('Failed to fetch metrics');
  }
}
