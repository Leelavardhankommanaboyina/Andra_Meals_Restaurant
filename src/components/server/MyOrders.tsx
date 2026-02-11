'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { ordersApi } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { useOrderStore, Order } from '@/store/order-store';
import { toast } from 'sonner';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { AddItemDialog } from './AddItemDialog';

export function MyOrders() {
  const { user } = useAuthStore();
  // Use store for real-time updates from socket-provider
  const { myOrders, setMyOrders, updateOrderInMyOrders, removeFromMyOrders } = useOrderStore();
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  // Track items that were already delivered when page loaded (to hide them)
  const [initialDeliveredItems, setInitialDeliveredItems] = useState<Set<string>>(new Set());
  // Track items delivered during this session (to show with strikethrough)
  const [sessionDeliveredItems, setSessionDeliveredItems] = useState<Set<string>>(new Set());

  // Fetch orders only on initial load
  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await ordersApi.getAll({ myOrders: true, status: 'ongoing', page: 1, limit: 100 });
      const orders = response.data.orders;
      setMyOrders(orders);

      // Track which items were already delivered when loaded
      // These will be hidden, not shown in the list
      const preDeliveredSet = new Set<string>();
      orders.forEach((order: Order) => {
        order.items.forEach((item, index) => {
          if (item.isDelivered && item.addedByServerId?.toString() === user?.userId?.toString()) {
            preDeliveredSet.add(`${order._id}-${index}`);
          }
        });
      });
      setInitialDeliveredItems(preDeliveredSet);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, [setMyOrders, user?.userId]);

  // Initial fetch only
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleDeliveryToggle = async (
    orderId: string,
    itemIndex: number,
    isDelivered: boolean,
    itemId?: string
  ) => {
    const key = itemId ? `${orderId}-${itemId}` : `${orderId}-${itemIndex}`;
    if (updatingItems.has(key)) return;

    // OPTIMISTIC UPDATE: Update store immediately
    const order = myOrders.find(o => o._id === orderId);
    if (!order) return;

    // Track session-delivered items (to show with strikethrough)
    if (isDelivered) {
      setSessionDeliveredItems(prev => new Set(prev).add(key));
    } else {
      setSessionDeliveredItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }

    const updatedItems = [...order.items];
    updatedItems[itemIndex] = { ...updatedItems[itemIndex], isDelivered };
    updateOrderInMyOrders(orderId, { items: updatedItems });

    setUpdatingItems((prev) => new Set(prev).add(key));

    // Fire and forget API call
    ordersApi.update(orderId, {
      itemDeliveryUpdate: { itemId, itemIndex, isDelivered },
    }).catch((error) => {
      console.error('Error updating delivery status:', error);
      toast.error('Failed to update item status');
      // Revert on error
      const revertedItems = [...order.items];
      updateOrderInMyOrders(orderId, { items: revertedItems });
      // Revert session tracking
      if (isDelivered) {
        setSessionDeliveredItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }
    }).finally(() => {
      setTimeout(() => {
        setUpdatingItems((prev) => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }, 100);
    });
  };

  // Handle removing an item from order (only undelivered items)
  const handleRemoveItem = async (orderId: string, itemIndex: number, itemId?: string) => {
    const key = itemId ? `${orderId}-${itemId}` : `${orderId}-${itemIndex}`;
    if (updatingItems.has(key)) return;

    const order = myOrders.find(o => o._id === orderId);
    if (!order) return;

    const item = order.items[itemIndex];
    if (item.isDelivered) {
      toast.error('Cannot remove delivered items');
      return;
    }

    // Check if this is the last item - if so, the order will be deleted
    const isLastItem = order.items.length === 1;

    // Optimistic update - update store directly
    if (isLastItem) {
      // Remove entire order from store
      removeFromMyOrders(orderId);
      if (currentIndex >= myOrders.length - 1 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
    } else {
      const updatedItems = order.items.filter((_, idx) => idx !== itemIndex);
      const newTotal = updatedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      updateOrderInMyOrders(orderId, { items: updatedItems, totalAmount: newTotal });
    }

    setUpdatingItems((prev) => new Set(prev).add(key));

    try {
      await ordersApi.update(orderId, {
        removeItem: { itemId, itemIndex },
      });
      toast.success(isLastItem ? 'Order deleted' : `${item.name} removed from order`);
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('Failed to remove item');
      // Revert on error - refetch orders since we may have removed from store
      fetchOrders();
    } finally {
      setUpdatingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  // When all MY items are delivered, remove this order from my list
  const handleMyItemsDelivered = (orderId: string) => {
    removeFromMyOrders(orderId);

    // Adjust current index if needed
    if (currentIndex >= myOrders.length - 1 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }

    toast.success('All your items delivered!');
  };

  const nextOrder = () => {
    if (currentIndex < myOrders.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevOrder = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Adjust currentIndex if it's out of bounds
  useEffect(() => {
    if (myOrders.length > 0 && currentIndex >= myOrders.length) {
      setCurrentIndex(myOrders.length - 1);
    }
  }, [myOrders.length, currentIndex]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-7rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (myOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-7rem)] p-4">
        <ClipboardCheck className="w-20 h-20 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">No Active Orders</h2>
        <p className="text-gray-500 text-center">
          All orders have been completed. Create a new order to get started.
        </p>
      </div>
    );
  }

  const currentOrder = myOrders[currentIndex];

  // Get items added by current server, EXCLUDING pre-delivered items
  // Pre-delivered = already delivered when page was loaded (not in this session)
  const myItems = currentOrder.items
    .map((item, index) => ({ ...item, originalIndex: index }))
    .filter(item => {
      const key = `${currentOrder._id}-${item.originalIndex}`;
      const isMyItem = item.addedByServerId?.toString() === user?.userId?.toString();
      const wasPreDelivered = initialDeliveredItems.has(key);
      const isSessionDelivered = sessionDeliveredItems.has(key);

      // Show if: my item AND (not pre-delivered OR delivered this session)
      // This means: show undelivered items + items I just delivered
      // Hide: items that were already delivered when I opened the page
      return isMyItem && (!wasPreDelivered || isSessionDelivered);
    });

  // Sort: undelivered first, then delivered (session-delivered at bottom)
  const sortedMyItems = [...myItems].sort((a, b) => {
    if (a.isDelivered === b.isDelivered) return 0;
    return a.isDelivered ? 1 : -1;
  });

  // For checking if all done
  const myUndeliveredItems = myItems.filter(item => !item.isDelivered);
  const myDeliveredItems = myItems.filter(item => item.isDelivered);
  const allMyItemsDelivered = myUndeliveredItems.length === 0 && myItems.length > 0;

  // Calculate total for my undelivered items only
  const myItemsTotal = myUndeliveredItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Handle swipe gesture for card navigation
  const handleCardSwipe = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeThreshold = 50;
    if (info.offset.x < -swipeThreshold && currentIndex < myOrders.length - 1) {
      nextOrder();
    } else if (info.offset.x > swipeThreshold && currentIndex > 0) {
      prevOrder();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] justify-center">
      {/* Order Card with Navigation */}
      <div className="flex-1 flex items-center justify-center p-4 bg-gray-50 overflow-hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={prevOrder}
          disabled={currentIndex === 0}
          className="shrink-0 hidden sm:flex"
        >
          <ChevronLeft className="w-8 h-8" />
        </Button>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentOrder._id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleCardSwipe}
            className="flex-1 max-w-md mx-2 sm:mx-4 touch-pan-y"
          >
            <Card className="shadow-lg">
              <CardHeader className="pb-3">
                {/* Table number in centered circle */}
                <div className="flex justify-center mb-3">
                  <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                    {currentOrder.tableNumber}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {currentOrder.customerName}
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                      {new Date(currentOrder.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 mb-1">
                      {currentIndex + 1} / {myOrders.length}
                    </p>
                    <p className="text-lg font-bold text-orange-600">
                      ₹{myItemsTotal}
                    </p>
                    <p className="text-xs text-gray-400">
                      {myUndeliveredItems.length} pending, {myDeliveredItems.length} delivered
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[280px] pr-4">
                  <div className="space-y-3">
                    {sortedMyItems.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                        <ClipboardCheck className="w-12 h-12 mb-2" />
                        <p className="text-sm">No items to deliver</p>
                      </div>
                    )}
                    {sortedMyItems.map((item) => {
                      const originalIndex = item.originalIndex;
                      const key = item._id ? `${currentOrder._id}-${item._id}` : `${currentOrder._id}-${originalIndex}`;
                      const isUpdating = updatingItems.has(key);

                      const handleClick = () => {
                        if (!isUpdating && !item.isDelivered) {
                          handleDeliveryToggle(currentOrder._id, originalIndex, true, item._id);
                        } else if (!isUpdating && item.isDelivered) {
                          // Allow unmarking delivered items
                          handleDeliveryToggle(currentOrder._id, originalIndex, false, item._id);
                        }
                      };

                      const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
                        // Only allow swipe removal for undelivered items
                        if (item.isDelivered) return;

                        const swipeThreshold = 100;
                        if (Math.abs(info.offset.x) > swipeThreshold) {
                          handleRemoveItem(currentOrder._id, originalIndex, item._id);
                        }
                      };

                      return (
                        <motion.div
                          key={item._id || `${item.menuItem}-${originalIndex}`}
                          layout
                          drag={!item.isDelivered ? "x" : false}
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={0.5}
                          onDragEnd={handleDragEnd}
                          onClick={handleClick}
                          whileDrag={{ scale: 1.02 }}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer relative ${item.isDelivered
                            ? 'bg-green-50 border-green-200'
                            : 'bg-white border-gray-200 hover:bg-green-50 hover:border-green-300 active:bg-green-100'
                            }`}
                        >
                          <Checkbox
                            id={key}
                            checked={item.isDelivered}
                            onCheckedChange={(checked) =>
                              handleDeliveryToggle(
                                currentOrder._id,
                                originalIndex,
                                checked as boolean,
                                item._id
                              )
                            }
                            disabled={isUpdating}
                            onClick={(e) => e.stopPropagation()}
                            className="data-[state=checked]:bg-green-500 pointer-events-none z-10"
                          />
                          <div className="flex-1 min-w-0 z-10">
                            <p className={`font-medium ${item.isDelivered ? 'text-green-700 line-through' : 'text-gray-800'}`}>
                              {item.name}
                            </p>
                            <p className={`text-sm ${item.isDelivered ? 'text-green-600' : 'text-gray-500'}`}>
                              ₹{item.price} × {item.quantity}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className={item.isDelivered ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}
                          >
                            ×{item.quantity}
                          </Badge>
                          {isUpdating && (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400 z-10" />
                          )}
                        </motion.div>
                      );
                    })}

                    {/* Divider when there are both delivered and undelivered items */}
                    {myDeliveredItems.length > 0 && myUndeliveredItems.length > 0 && (
                      <div className="flex items-center gap-2 py-2">
                        <div className="flex-1 h-px bg-green-200" />
                        <span className="text-xs text-green-600 font-medium">Delivered</span>
                        <div className="flex-1 h-px bg-green-200" />
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Completion Check */}
                {!allMyItemsDelivered && (
                  <div className="mt-4 p-3 bg-amber-50 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700">
                      Mark all your items as delivered to complete
                    </p>
                  </div>
                )}

                {allMyItemsDelivered && (
                  <div className="mt-4 p-3 bg-green-50 rounded-lg flex items-start gap-2">
                    <ClipboardCheck className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-green-700">
                      All your items delivered! Order will auto-complete when all servers finish.
                    </p>
                  </div>
                )}
                {/* Action buttons */}
                <div className="mt-4 flex gap-3">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-12 w-12 rounded-full border-orange-300 hover:bg-orange-50 shrink-0"
                    onClick={() => setAddItemDialogOpen(true)}
                  >
                    <Plus className="w-5 h-5 text-orange-600" />
                  </Button>
                  <Button
                    className="flex-1 h-12 bg-green-500 hover:bg-green-600"
                    onClick={() => handleMyItemsDelivered(currentOrder._id)}
                    disabled={!allMyItemsDelivered}
                  >
                    {allMyItemsDelivered ? (
                      'Done - Remove from My Orders'
                    ) : (
                      `${myUndeliveredItems.length} item(s) left to deliver`
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        <Button
          variant="ghost"
          size="icon"
          onClick={nextOrder}
          disabled={currentIndex === myOrders.length - 1}
          className="shrink-0 hidden sm:flex"
        >
          <ChevronRight className="w-8 h-8" />
        </Button>
      </div>

      {/* Add Item Dialog */}
      <AddItemDialog
        open={addItemDialogOpen}
        onOpenChange={setAddItemDialogOpen}
        orderId={currentOrder._id}
        tableNumber={currentOrder.tableNumber}
        customerName={currentOrder.customerName}
        onSuccess={fetchOrders}
      />
    </div>
  );
}
