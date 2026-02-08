import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { Order } from '@/lib/models';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api-response';
import { emitSocketEvent, SOCKET_EVENTS } from '@/lib/socket-emit';

interface RouteParams {
  params: Promise<{ id: string }>;
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

    // Servers can only see their own orders
    if (user.role === 'server' && order.serverId.toString() !== user.userId) {
      return forbiddenResponse('You can only view your own orders');
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
    const { status, items, itemDeliveryUpdate, removeItem } = body;

    const order = await Order.findById(id);

    if (!order) {
      return notFoundResponse('Order not found');
    }

    const isOwnOrder = order.serverId.toString() === user.userId;
    const isAdminUser = user.role === 'admin';

    // For adding items to existing orders (old order workflow):
    // - Any server can add items to any ongoing order
    // For other operations (status change, delivery update):
    // - Servers can only update their own orders
    // - Admin can update any order
    if (!isAdminUser && !isOwnOrder) {
      // Allow only adding items for other servers' orders
      if (!items || status || itemDeliveryUpdate !== undefined) {
        return forbiddenResponse('You can only add items to other servers\' orders');
      }
    }

    // Handle removing an item (only undelivered items by the server who added them)
    if (removeItem !== undefined) {
      const { itemIndex } = removeItem;
      if (itemIndex >= 0 && itemIndex < order.items.length) {
        const item = order.items[itemIndex];
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
          emitSocketEvent(SOCKET_EVENTS.ORDER_DELETED, { _id: id });
          return successResponse(null, 'Order deleted (last item removed)');
        }
        // Remove the item
        order.items.splice(itemIndex, 1);
        // Recalculate total
        order.totalAmount = order.items.reduce((sum: number, i: { price: number; quantity: number }) => sum + i.price * i.quantity, 0);
      }
    }

    // Handle item delivery status update
    // Servers can only update delivery status for items THEY added
    if (itemDeliveryUpdate !== undefined) {
      const { itemIndex, isDelivered } = itemDeliveryUpdate;
      if (itemIndex >= 0 && itemIndex < order.items.length) {
        const item = order.items[itemIndex];
        // Check if this server owns this item (or is admin)
        if (!isAdminUser && item.addedByServerId?.toString() !== user.userId) {
          return forbiddenResponse('You can only update delivery status for items you added');
        }
        order.items[itemIndex].isDelivered = isDelivered;
      }
    }

    // Handle adding more items (for old order workflow)
    // Any server can add items - distributed system allows helping any customer
    // New items are assigned to the server who added them for delivery tracking
    if (items && Array.isArray(items) && items.length > 0) {
      console.log('Adding items to order, user:', user.userId, 'username:', user.username);
      
      // If order was completed, reset to ongoing since new items need delivery
      if (order.status === 'completed') {
        order.status = 'ongoing';
        console.log('Order reset to ongoing because new items were added');
      }
      
      for (const item of items) {
        // Check if item already exists AND was added by the same server AND is NOT yet delivered
        // If item is already delivered, treat new addition as separate entry
        const existingItemIndex = order.items.findIndex(
          (i) => i.menuItem.toString() === item.menuItemId && 
                 i.addedByServerId?.toString() === user.userId &&
                 !i.isDelivered  // Only merge with undelivered items
        );

        if (existingItemIndex >= 0) {
          // Update quantity for undelivered item added by same server
          order.items[existingItemIndex].quantity += item.quantity;
          console.log('Updated existing undelivered item quantity:', item.name);
        } else {
          // Add as new item assigned to current server
          // This includes: items from other servers, OR same server's delivered items
          const newItem = {
            menuItem: item.menuItemId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            isDelivered: false,
            addedByServerId: new mongoose.Types.ObjectId(user.userId),
            addedByServerName: user.username,
          };
          console.log('Adding new item:', newItem.name, 'addedByServerId:', newItem.addedByServerId.toString());
          order.items.push(newItem);
        }
      }
    }

    // Handle explicit status update (from admin)
    if (status) {
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
        if (user.role === 'server') {
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
    if (removeItem !== undefined) {
      emitSocketEvent(SOCKET_EVENTS.ORDER_UPDATED, order);
    }
    if (itemDeliveryUpdate !== undefined) {
      emitSocketEvent(SOCKET_EVENTS.ORDER_ITEM_DELIVERED, order);
    }
    if (items && Array.isArray(items)) {
      emitSocketEvent(SOCKET_EVENTS.ORDER_UPDATED, order);
    }
    if (status === 'completed') {
      emitSocketEvent(SOCKET_EVENTS.ORDER_COMPLETED, order);
    } else if (status === 'paid') {
      emitSocketEvent(SOCKET_EVENTS.ORDER_PAID, order);
    } else if (status === 'cancelled') {
      emitSocketEvent(SOCKET_EVENTS.ORDER_DELETED, order);
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
    emitSocketEvent(SOCKET_EVENTS.ORDER_DELETED, { _id: id });

    return successResponse(null, 'Order deleted successfully');
  } catch (error) {
    console.error('Delete order error:', error);
    return serverErrorResponse('Failed to delete order');
  }
}
