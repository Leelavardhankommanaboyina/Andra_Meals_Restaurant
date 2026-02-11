import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import { MenuItem } from '@/lib/models';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { updateMenuItemSchema } from '@/lib/validations';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api-response';
import { emitSocketEvent, SOCKET_EVENTS, ROOMS } from '@/lib/socket-emit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/menu/[id] - Get single menu item
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const item = await MenuItem.findById(id).lean();

    if (!item) {
      return notFoundResponse('Menu item not found');
    }

    return successResponse(item);
  } catch (error) {
    console.error('Get menu item error:', error);
    return serverErrorResponse('Failed to fetch menu item');
  }
}

// PATCH /api/menu/[id] - Update menu item (Admin only)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (!isAdmin(user)) {
      return forbiddenResponse('Only admin can update menu items');
    }

    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = updateMenuItemSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((e) => e.message);
      return errorResponse(errors.join(', '));
    }

    // Check if name already exists (if updating name)
    if (validationResult.data.name) {
      const existingItem = await MenuItem.findOne({
        name: { $regex: new RegExp(`^${validationResult.data.name}$`, 'i') },
        _id: { $ne: id },
      });

      if (existingItem) {
        return errorResponse('An item with this name already exists');
      }
    }

    const updatedItem = await MenuItem.findByIdAndUpdate(
      id,
      { $set: validationResult.data },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedItem) {
      return notFoundResponse('Menu item not found');
    }

    // Emit real-time event
    if (validationResult.data.isActive !== undefined) {
      emitSocketEvent(SOCKET_EVENTS.MENU_ITEM_TOGGLED, updatedItem, [ROOMS.ADMIN, ROOMS.SERVERS]);
    } else {
      emitSocketEvent(SOCKET_EVENTS.MENU_ITEM_UPDATED, updatedItem, [ROOMS.ADMIN, ROOMS.SERVERS]);
    }

    return successResponse(updatedItem, 'Menu item updated successfully');
  } catch (error) {
    console.error('Update menu item error:', error);
    return serverErrorResponse('Failed to update menu item');
  }
}

// DELETE /api/menu/[id] - Delete menu item (Admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (!isAdmin(user)) {
      return forbiddenResponse('Only admin can delete menu items');
    }

    const { id } = await params;
    const deletedItem = await MenuItem.findByIdAndDelete(id).lean();

    if (!deletedItem) {
      return notFoundResponse('Menu item not found');
    }

    // Emit real-time event
    emitSocketEvent(SOCKET_EVENTS.MENU_ITEM_DELETED, { _id: id }, [ROOMS.ADMIN, ROOMS.SERVERS]);

    return successResponse(null, 'Menu item deleted successfully');
  } catch (error) {
    console.error('Delete menu item error:', error);
    return serverErrorResponse('Failed to delete menu item');
  }
}
