import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { MenuItem, Order } from '@/lib/models';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { addItemsToOrderSchema, orderAssignmentSchema } from '@/lib/validations';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api-response';
import { emitSocketEvent, ROOMS, SOCKET_EVENTS } from '@/lib/socket-emit';
import { resolveAssignee } from '@/lib/order-assignment';

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

function resolveOrderItemIndex(
  items: Array<{ _id?: unknown }>,
  reference: { itemId?: string; itemIndex?: number }
) {
  if (reference.itemId) {
    return items.findIndex((item) => item._id?.toString() === reference.itemId);
  }

  if (
    typeof reference.itemIndex === 'number' &&
    reference.itemIndex >= 0 &&
    reference.itemIndex < items.length
  ) {
    return reference.itemIndex;
  }

  return -1;
}

// GET /api/orders/[id] - Get single order
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const order = await Order.findById(id).lean();

    if (!order) {
      return notFoundResponse('Order not found');
    }

    if (user.role !== 'admin') {
      const isCreator = order.serverId.toString() === user.userId;
      const isAssignee = order.deliveryAssigneeId?.toString() === user.userId;
      const addedAnyItems = order.items.some((item) => item.addedByServerId?.toString() === user.userId);

      if (user.role === 'servent' && !isAssignee) {
        return forbiddenResponse('You can only view assigned orders');
      }

      if (user.role === 'server' && !isCreator && !isAssignee && !addedAnyItems) {
        return forbiddenResponse('You can only view orders related to you');
      }
    }

    return successResponse(order);
  } catch (error) {
    console.error('Get order error:', error);
    return serverErrorResponse('Failed to fetch order');
  }
}

// PATCH /api/orders/[id] - Update order
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const body = await request.json();
    const { status, items, itemDeliveryUpdate, removeItem, assign } = body;

    const order = await Order.findById(id);

    if (!order) {
      return notFoundResponse('Order not found');
    }

    const isAdminUser = user.role === 'admin';
    const isServerUser = user.role === 'server';
    const isServentUser = user.role === 'servent';
    const isOrderCreator = order.serverId.toString() === user.userId;
    const isAssignedToUser = order.deliveryAssigneeId?.toString() === user.userId;

    if (isServentUser) {
      if (!isAssignedToUser) {
        return forbiddenResponse('You can only update assigned orders');
      }

      const onlyDeliveryUpdateAction =
        itemDeliveryUpdate !== undefined &&
        !items &&
        !status &&
        removeItem === undefined &&
        assign === undefined;

      if (!onlyDeliveryUpdateAction) {
        return forbiddenResponse('Servent can only mark delivery status on assigned orders');
      }
    }

    if (assign !== undefined) {
      if (!isAdminUser && !isServerUser) {
        return forbiddenResponse('Only admin or server can assign orders');
      }

      if (!isAdminUser && !isOrderCreator && !isAssignedToUser) {
        return forbiddenResponse('You can only assign orders related to you');
      }

      if (order.status === 'paid' || order.status === 'cancelled') {
        return errorResponse('Cannot assign paid or cancelled orders');
      }

      const assignValidation = orderAssignmentSchema.safeParse(assign);
      if (!assignValidation.success) {
        const errors = assignValidation.error.issues.map((issue) => issue.message);
        return errorResponse(errors.join(', '));
      }

      const assigneeResult = await resolveAssignee(assignValidation.data);
      if (!assigneeResult.assignee) {
        return errorResponse(assigneeResult.error || 'Unable to assign order');
      }

      order.deliveryAssigneeId = assigneeResult.assignee._id;
      order.deliveryAssigneeName = assigneeResult.assignee.username;
      order.deliveryAssigneeRole = assigneeResult.assignee.role;
      order.assignedById = new mongoose.Types.ObjectId(user.userId);
      order.assignedByName = user.username;
      order.assignedAt = new Date();
    }

    // Handle removing an item (only undelivered items by the server who added them)
    if (removeItem !== undefined) {
      if (isServentUser) {
        return forbiddenResponse('Servent cannot remove items');
      }

      const { itemId, itemIndex } = removeItem as { itemId?: string; itemIndex?: number };
      const resolvedItemIndex = resolveOrderItemIndex(order.items, { itemId, itemIndex });

      if (resolvedItemIndex < 0) {
        return errorResponse('Order item not found');
      }

      const item = order.items[resolvedItemIndex];
      // Check if item is delivered - cannot remove delivered items
      if (item.isDelivered) {
        return errorResponse('Cannot remove delivered items');
      }
      // Check if this server owns this item (or is admin)
      if (!isAdminUser && item.addedByServerId?.toString() !== user.userId) {
        return forbiddenResponse('You can only remove items you added');
      }
      // Check if this is the last item - if so, delete the entire order
      if (order.items.length === 1) {
        await Order.findByIdAndDelete(id);
        emitSocketEvent(SOCKET_EVENTS.ORDER_DELETED, { _id: id }, [ROOMS.ADMIN, ROOMS.SERVERS]);
        return successResponse(null, 'Order deleted (last item removed)');
      }
      // Remove the item
      order.items.splice(resolvedItemIndex, 1);
      // Recalculate total
      order.totalAmount = order.items.reduce((sum: number, i: { price: number; quantity: number }) => sum + i.price * i.quantity, 0);
    }

    // Handle item delivery status update
    if (itemDeliveryUpdate !== undefined) {
      const { itemId, itemIndex, isDelivered } = itemDeliveryUpdate as {
        itemId?: string;
        itemIndex?: number;
        isDelivered: boolean;
      };
      const resolvedItemIndex = resolveOrderItemIndex(order.items, { itemId, itemIndex });
      if (resolvedItemIndex < 0) {
        return errorResponse('Order item not found');
      }

      const item = order.items[resolvedItemIndex];
      const canUpdateDelivery =
        isAdminUser || isAssignedToUser || item.addedByServerId?.toString() === user.userId;
      if (!canUpdateDelivery) {
        return forbiddenResponse('You can only update delivery status for assigned items/orders');
      }
      order.items[resolvedItemIndex].isDelivered = isDelivered;
    }

    // Handle adding more items (for old order workflow)
    if (items && Array.isArray(items) && items.length > 0) {
      if (isServentUser) {
        return forbiddenResponse('Servent cannot add items');
      }

      if (order.status === 'paid' || order.status === 'cancelled') {
        return errorResponse('Cannot add items to paid or cancelled orders');
      }

      const addItemsValidation = addItemsToOrderSchema.safeParse({ items });
      if (!addItemsValidation.success) {
        const errors = addItemsValidation.error.issues.map((e) => e.message);
        return errorResponse(errors.join(', '));
      }

      const resolvedMenuItems = await resolveMenuItems(addItemsValidation.data.items);
      if ('error' in resolvedMenuItems) {
        return errorResponse(resolvedMenuItems.error);
      }

      // If order was completed, reset to ongoing since new items need delivery
      if (order.status === 'completed') {
        order.status = 'ongoing';
      }

      for (const item of addItemsValidation.data.items) {
        // Check if item already exists AND was added by the same server AND is NOT yet delivered
        // If item is already delivered, treat new addition as separate entry
        const existingItemIndex = order.items.findIndex(
          (i) =>
            i.menuItem.toString() === item.menuItemId &&
            i.addedByServerId?.toString() === user.userId &&
            !i.isDelivered // Only merge with undelivered items
        );

        if (existingItemIndex >= 0) {
          // Update quantity for undelivered item added by same server
          order.items[existingItemIndex].quantity += item.quantity;
        } else {
          // Add as new item assigned to current server
          // This includes: items from other servers, OR same server's delivered items
          const newItem = {
            menuItem: new mongoose.Types.ObjectId(item.menuItemId),
            name: resolvedMenuItems.menuItemById.get(item.menuItemId)!.name,
            price: resolvedMenuItems.menuItemById.get(item.menuItemId)!.price,
            quantity: item.quantity,
            isDelivered: false,
            addedByServerId: new mongoose.Types.ObjectId(user.userId),
            addedByServerName: user.username,
          };
          order.items.push(newItem);
        }
      }

      // Backfill missing assignee for legacy unassigned orders.
      if (!order.deliveryAssigneeId && user.role !== 'admin') {
        order.deliveryAssigneeId = new mongoose.Types.ObjectId(user.userId);
        order.deliveryAssigneeName = user.username;
        order.deliveryAssigneeRole = 'server';
        order.assignedById = new mongoose.Types.ObjectId(user.userId);
        order.assignedByName = user.username;
        order.assignedAt = new Date();
      }
    }

    // Handle explicit status update (from admin)
    if (status) {
      if (!isAdminUser && !isOrderCreator) {
        return forbiddenResponse('Only admin or order creator can update order status');
      }

      // Only allow specific status transitions
      if (status === 'completed') {
        // Check if all items are delivered
        const allDelivered = order.items.every((item) => item.isDelivered);
        if (!allDelivered) {
          return errorResponse('All items must be delivered before completing the order');
        }
        order.status = 'completed';
      } else if (status === 'paid') {
        // Only admin can mark as paid
        if (!isAdmin(user)) {
          return forbiddenResponse('Only admin can mark orders as paid');
        }
        if (order.status !== 'completed') {
          return errorResponse('Order must be completed before marking as paid');
        }
        order.status = 'paid';
        order.paidAt = new Date();
      } else if (status === 'cancelled') {
        // Servers can cancel their own orders if no items are delivered
        // Admin can cancel any order
        if (isServerUser) {
          const anyDelivered = order.items.some((item) => item.isDelivered);
          if (anyDelivered) {
            return errorResponse('Cannot cancel order with delivered items. Contact admin.');
          }
        }
        order.status = 'cancelled';
        order.cancelledAt = new Date();
        // @ts-expect-error - Mongoose will convert string to ObjectId
        order.cancelledBy = user.userId;
      }
    }

    // Auto-complete order when ALL items from ALL servers are delivered
    if (order.status === 'ongoing') {
      const allItemsDelivered = order.items.every((item) => item.isDelivered);
      if (allItemsDelivered && order.items.length > 0) {
        order.status = 'completed';
      }
    }

    await order.save();

    // Emit real-time events
    if (assign !== undefined) {
      emitSocketEvent(SOCKET_EVENTS.ORDER_ASSIGNED, order, [ROOMS.ADMIN, ROOMS.SERVERS]);
      emitSocketEvent(SOCKET_EVENTS.ORDER_UPDATED, order, [ROOMS.ADMIN, ROOMS.SERVERS]);
    }
    if (removeItem !== undefined) {
      emitSocketEvent(SOCKET_EVENTS.ORDER_UPDATED, order, [ROOMS.ADMIN, ROOMS.SERVERS]);
    }
    if (itemDeliveryUpdate !== undefined) {
      emitSocketEvent(SOCKET_EVENTS.ORDER_ITEM_DELIVERED, order, [ROOMS.ADMIN, ROOMS.SERVERS]);
    }
    if (items && Array.isArray(items)) {
      emitSocketEvent(SOCKET_EVENTS.ORDER_UPDATED, order, [ROOMS.ADMIN, ROOMS.SERVERS]);
    }
    if (status === 'completed') {
      emitSocketEvent(SOCKET_EVENTS.ORDER_COMPLETED, order, [ROOMS.ADMIN, ROOMS.SERVERS]);
    } else if (status === 'paid') {
      emitSocketEvent(SOCKET_EVENTS.ORDER_PAID, order, [ROOMS.ADMIN, ROOMS.SERVERS]);
    } else if (status === 'cancelled') {
      emitSocketEvent(SOCKET_EVENTS.ORDER_DELETED, order, [ROOMS.ADMIN, ROOMS.SERVERS]);
    }

    return successResponse(order, 'Order updated successfully');
  } catch (error) {
    console.error('Update order error:', error);
    return serverErrorResponse('Failed to update order');
  }
}

// DELETE /api/orders/[id] - Delete order (Admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (!isAdmin(user)) {
      return forbiddenResponse('Only admin can delete orders');
    }

    const { id } = await params;
    const deletedOrder = await Order.findByIdAndDelete(id).lean();

    if (!deletedOrder) {
      return notFoundResponse('Order not found');
    }

    // Emit real-time event
    emitSocketEvent(SOCKET_EVENTS.ORDER_DELETED, { _id: id }, [ROOMS.ADMIN, ROOMS.SERVERS]);

    return successResponse(null, 'Order deleted successfully');
  } catch (error) {
    console.error('Delete order error:', error);
    return serverErrorResponse('Failed to delete order');
  }
}
