import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import { MenuItem } from '@/lib/models';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { menuItemSchema } from '@/lib/validations';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/api-response';
import { emitSocketEvent, SOCKET_EVENTS } from '@/lib/socket-emit';

// GET /api/menu - Get all menu items
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const activeOnly = searchParams.get('activeOnly') !== 'false';
    const search = searchParams.get('search');

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {};
    
    // Servers can only see active items
    if (user.role === 'server' || activeOnly) {
      query.isActive = true;
    }

    if (category) {
      query.category = category;
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const items = await MenuItem.find(query)
      .sort({ category: 1, name: 1 })
      .lean();

    // Get unique categories
    const categories = await MenuItem.distinct('category');

    return successResponse({
      items,
      categories,
      total: items.length,
    });
  } catch (error) {
    console.error('Get menu items error:', error);
    return serverErrorResponse('Failed to fetch menu items');
  }
}

// POST /api/menu - Add new menu item (Admin only)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (!isAdmin(user)) {
      return forbiddenResponse('Only admin can add menu items');
    }

    const body = await request.json();

    // Validate input
    const validationResult = menuItemSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((e) => e.message);
      return errorResponse(errors.join(', '));
    }

    // Check if item already exists
    const existingItem = await MenuItem.findOne({
      name: { $regex: new RegExp(`^${validationResult.data.name}$`, 'i') },
    });

    if (existingItem) {
      return errorResponse('An item with this name already exists');
    }

    const newItem = await MenuItem.create(validationResult.data);

    // Emit real-time event
    emitSocketEvent(SOCKET_EVENTS.MENU_ITEM_CREATED, newItem);

    return successResponse(newItem, 'Menu item added successfully', 201);
  } catch (error) {
    console.error('Add menu item error:', error);
    return serverErrorResponse('Failed to add menu item');
  }
}
