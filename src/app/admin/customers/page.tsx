'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Loader2,
  Search,
  UserCircle,
  Clock,
  CheckCircle2,
  IndianRupee,
} from 'lucide-react';
import { ordersApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAdminStore } from '@/store';

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  isDelivered: boolean;
  addedByServerId?: string;
  addedByServerName?: string;
}

interface Order {
  _id: string;
  tableNumber: number;
  customerName: string;
  items: OrderItem[];
  status: 'ongoing' | 'completed' | 'paid';
  totalAmount: number;
  serverName: string;
  createdAt: string;
}

// Memoized OrderCard component to prevent unnecessary re-renders
const OrderCard = memo(function OrderCard({ order, onView }: { order: Order; onView: (order: Order) => void }) {
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onView(order)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Badge
            variant="secondary"
            className="bg-orange-100 text-orange-700"
          >
            Table {order.tableNumber}
          </Badge>
          <Badge
            className={
              order.status === 'ongoing'
                ? 'bg-blue-500'
                : order.status === 'completed'
                  ? 'bg-green-500'
                  : 'bg-gray-500'
            }
          >
            {order.status === 'ongoing' ? (
              <><Clock className="w-3 h-3 mr-1" />Ongoing</>
            ) : (
              <><CheckCircle2 className="w-3 h-3 mr-1" />Completed</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-2">
          <UserCircle className="w-5 h-5 text-gray-400" />
          <p className="font-semibold text-gray-800">{order.customerName}</p>
        </div>
        <p className="text-sm text-gray-500 mb-2">
          {order.items.length} items • Served by {order.serverName}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {new Date(order.createdAt).toLocaleTimeString()}
          </p>
          <p className="font-bold text-orange-600">₹{order.totalAmount}</p>
        </div>
      </CardContent>
    </Card>
  );
});

export default function CustomersPage() {
  // Use Zustand store for orders - socket-provider handles real-time updates
  const { ongoingOrders, completedOrders, setOngoingOrders, setCompletedOrders, isLoading: storeLoading } = useAdminStore();
  const [isLoading, setIsLoading] = useState(storeLoading || ongoingOrders.length === 0);
  const [tableSearch, setTableSearch] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [updatingItems, setUpdatingItems] = useState<Set<number>>(new Set());
  const [changingStatus, setChangingStatus] = useState(false);

  const fetchOrders = useCallback(async () => {
    // Only fetch if store is empty (first load)
    if (ongoingOrders.length > 0 || completedOrders.length > 0) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const [ongoingRes, completedRes] = await Promise.all([
        ordersApi.getAll({ status: 'ongoing' }),
        ordersApi.getAll({ status: 'completed' }),
      ]);
      setOngoingOrders(ongoingRes.data.orders as Order[]);
      setCompletedOrders(completedRes.data.orders as Order[]);
    } catch {
      toast.error('Failed to load orders');;
    } finally {
      setIsLoading(false);
    }
  }, [ongoingOrders.length, completedOrders.length, setOngoingOrders, setCompletedOrders]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Sync selectedOrder with store updates (from socket events)
  useEffect(() => {
    if (selectedOrder) {
      // Find updated order in either list
      const updated = ongoingOrders.find(o => o._id === selectedOrder._id)
        || completedOrders.find(o => o._id === selectedOrder._id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedOrder)) {
        setSelectedOrder(updated);
      }
    }
  }, [ongoingOrders, completedOrders, selectedOrder]);

  // Socket events are handled globally by socket-provider, which updates the Zustand store
  // No need for duplicate listeners here - the store subscription above handles UI updates

  // Memoized filtered lists - filter by both table number and customer name
  const filteredOngoing = useMemo(() => {
    let filtered = ongoingOrders;

    // Filter by table number
    if (tableSearch) {
      const tableNum = parseInt(tableSearch);
      if (!isNaN(tableNum)) {
        filtered = filtered.filter(o => o.tableNumber === tableNum);
      }
    }

    // Filter by customer name
    if (nameSearch) {
      filtered = filtered.filter(o =>
        o.customerName.toLowerCase().includes(nameSearch.toLowerCase())
      );
    }

    return filtered;
  }, [tableSearch, nameSearch, ongoingOrders]);

  const filteredCompleted = useMemo(() => {
    let filtered = completedOrders;

    // Filter by table number
    if (tableSearch) {
      const tableNum = parseInt(tableSearch);
      if (!isNaN(tableNum)) {
        filtered = filtered.filter(o => o.tableNumber === tableNum);
      }
    }

    // Filter by customer name
    if (nameSearch) {
      filtered = filtered.filter(o =>
        o.customerName.toLowerCase().includes(nameSearch.toLowerCase())
      );
    }

    return filtered;
  }, [tableSearch, nameSearch, completedOrders]);

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailDialog(true);
  };

  const handleMarkAsPaid = async () => {
    if (!selectedOrder) return;

    setIsProcessingPayment(true);
    try {
      await ordersApi.update(selectedOrder._id, { status: 'paid' });

      // Remove from completed orders - Zustand setter expects direct array, not callback
      setCompletedOrders(completedOrders.filter((o) => o._id !== selectedOrder._id));

      toast.success('Payment recorded successfully!');
      setShowDetailDialog(false);
      setSelectedOrder(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process payment');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleItemDeliveryToggle = async (itemIndex: number, isDelivered: boolean) => {
    if (!selectedOrder || updatingItems.has(itemIndex)) return;

    // OPTIMISTIC UPDATE: Update UI immediately
    const updatedItems = [...selectedOrder.items];
    updatedItems[itemIndex] = { ...updatedItems[itemIndex], isDelivered };
    const updatedOrder = { ...selectedOrder, items: updatedItems };
    setSelectedOrder(updatedOrder);

    // Check if all items are delivered
    const allDelivered = updatedItems.every(item => item.isDelivered);
    if (allDelivered && selectedOrder.status === 'ongoing') {
      updatedOrder.status = 'completed';
      setSelectedOrder(updatedOrder);
      setOngoingOrders(ongoingOrders.filter(o => o._id !== selectedOrder._id));
      setCompletedOrders([updatedOrder, ...completedOrders]);
    } else {
      if (selectedOrder.status === 'ongoing') {
        setOngoingOrders(ongoingOrders.map(o => o._id === selectedOrder._id ? updatedOrder : o));
      } else {
        setCompletedOrders(completedOrders.map(o => o._id === selectedOrder._id ? updatedOrder : o));
      }
    }

    setUpdatingItems(prev => new Set(prev).add(itemIndex));

    // Fire API call in background
    ordersApi.update(selectedOrder._id, {
      itemDeliveryUpdate: { itemIndex, isDelivered },
    }).catch(() => {
      toast.error('Failed to update item status');
      // Revert on error
      const revertedItems = [...selectedOrder.items];
      setSelectedOrder({ ...selectedOrder, items: revertedItems });
    }).finally(() => {
      setTimeout(() => {
        setUpdatingItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemIndex);
          return newSet;
        });
      }, 100);
    });
  };

  const handleStatusChange = async (newStatus: 'ongoing' | 'completed') => {
    if (!selectedOrder || changingStatus) return;

    if (newStatus === 'completed') {
      const allDelivered = selectedOrder.items.every(item => item.isDelivered);
      if (!allDelivered) {
        toast.error('All items must be delivered before completing the order');
        return;
      }
    }

    setChangingStatus(true);
    try {
      await ordersApi.update(selectedOrder._id, { status: newStatus });

      const updatedOrder = { ...selectedOrder, status: newStatus };
      setSelectedOrder(updatedOrder);

      if (newStatus === 'ongoing') {
        setCompletedOrders(completedOrders.filter(o => o._id !== selectedOrder._id));
        setOngoingOrders([updatedOrder, ...ongoingOrders]);
      } else {
        setOngoingOrders(ongoingOrders.filter(o => o._id !== selectedOrder._id));
        setCompletedOrders([updatedOrder, ...completedOrders]);
      }

      toast.success(`Order moved to ${newStatus}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update order status');
    } finally {
      setChangingStatus(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 lg:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Customers</h1>
            <p className="text-gray-500">
              Ongoing: {ongoingOrders.length} | Completed: {completedOrders.length}
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-40">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Table #"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value.replace(/\D/g, ''))}
                className="pl-10"
              />
            </div>
            <div className="relative flex-1 sm:w-48">
              <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Customer name..."
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ongoing" className="flex-1 flex flex-col">
        <div className="bg-white border-b px-4 lg:px-6">
          <TabsList>
            <TabsTrigger value="ongoing" className="gap-2">
              <Clock className="w-4 h-4" />
              Ongoing ({filteredOngoing.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Completed ({filteredCompleted.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1 bg-gray-50">
          <TabsContent value="ongoing" className="m-0 p-4 lg:p-6">
            {filteredOngoing.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-800 mb-2">No Ongoing Orders</h2>
                <p className="text-gray-500">
                  {tableSearch
                    ? `No ongoing orders for table ${tableSearch}`
                    : 'All orders have been completed'}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredOngoing.map((order) => (
                  <OrderCard key={order._id} order={order} onView={handleViewOrder} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="m-0 p-4 lg:p-6">
            {filteredCompleted.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-800 mb-2">No Completed Orders</h2>
                <p className="text-gray-500">
                  {tableSearch
                    ? `No completed orders for table ${tableSearch}`
                    : 'No orders pending payment'}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredCompleted.map((order) => (
                  <OrderCard key={order._id} order={order} onView={handleViewOrder} />
                ))}
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs >

      {/* Order Detail Dialog */}
      < Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog} >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="py-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Badge className="bg-orange-100 text-orange-700 mb-1">
                    Table {selectedOrder.tableNumber}
                  </Badge>
                  <h3 className="text-lg font-semibold">{selectedOrder.customerName}</h3>
                  <p className="text-sm text-gray-500">
                    Served by {selectedOrder.serverName}
                  </p>
                </div>
                <Badge
                  className={
                    selectedOrder.status === 'ongoing'
                      ? 'bg-blue-500'
                      : 'bg-green-500'
                  }
                >
                  {selectedOrder.status}
                </Badge>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-gray-600 w-8"></th>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Item</th>
                      <th className="text-center p-3 text-sm font-medium text-gray-600">Qty</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item, index) => (
                      <tr
                        key={index}
                        className={`border-t cursor-pointer transition-colors ${item.isDelivered ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-green-50'}`}
                        onClick={() => !updatingItems.has(index) && handleItemDeliveryToggle(index, !item.isDelivered)}
                      >
                        <td className="p-3">
                          <Checkbox
                            checked={item.isDelivered}
                            onCheckedChange={(checked) => handleItemDeliveryToggle(index, checked as boolean)}
                            disabled={updatingItems.has(index)}
                            className="data-[state=checked]:bg-green-500 pointer-events-none"
                          />
                        </td>
                        <td className="p-3">
                          <p className={`text-sm font-medium ${item.isDelivered ? 'text-green-700 line-through' : 'text-gray-800'}`}>
                            {item.name}
                          </p>
                          {item.addedByServerName && (
                            <p className="text-xs text-gray-400">by {item.addedByServerName}</p>
                          )}
                        </td>
                        <td className="p-3 text-sm text-center">{item.quantity}</td>
                        <td className="p-3 text-sm text-right font-medium">
                          ₹{item.price * item.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-orange-50">
                    <tr className="border-t">
                      <td colSpan={3} className="p-3 font-semibold text-gray-800">
                        Total Amount
                      </td>
                      <td className="p-3 font-bold text-orange-600 text-right text-lg">
                        ₹{selectedOrder.totalAmount}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className="text-sm text-gray-500 mt-4 text-center">
                Order placed at {new Date(selectedOrder.createdAt).toLocaleString()}
              </p>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2 flex-1">
              {selectedOrder?.status === 'completed' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange('ongoing')}
                  disabled={changingStatus}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  Move to Ongoing
                </Button>
              )}
              {selectedOrder?.status === 'ongoing' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange('completed')}
                  disabled={changingStatus || !selectedOrder.items.every(i => i.isDelivered)}
                  className="text-green-600 border-green-300 hover:bg-green-50"
                >
                  Mark Complete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                Close
              </Button>
              {selectedOrder?.status === 'completed' && (
                <Button
                  onClick={handleMarkAsPaid}
                  disabled={isProcessingPayment}
                  className="bg-green-500 hover:bg-green-600"
                >
                  {isProcessingPayment ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <IndianRupee className="w-4 h-4 mr-1" />
                      Mark as Paid
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog >
    </div >
  );
}
