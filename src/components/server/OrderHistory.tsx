'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, Check } from 'lucide-react';
import { ordersApi } from '@/lib/api-client';
import { toast } from 'sonner';

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  isDelivered: boolean;
}

interface Order {
  _id: string;
  tableNumber: number;
  customerName: string;
  items: OrderItem[];
  status: 'ongoing' | 'completed' | 'paid';
  totalAmount: number;
  createdAt: string;
}

export function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await ordersApi.getAll({ myOrders: true, status: 'completed' });
      setOrders(response.data.orders);
    } catch (error) {
      console.error('Error fetching order history:', error);
      toast.error('Failed to load order history');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-7rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-7rem)] p-4">
        <History className="w-20 h-20 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">No Order History</h2>
        <p className="text-gray-500 text-center">
          Completed orders will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <h1 className="text-xl font-semibold text-gray-800">Order History</h1>
        <p className="text-sm text-gray-500">
          {orders.length} completed order(s)
        </p>
      </div>

      {/* Orders List */}
      <ScrollArea className="flex-1 bg-gray-50">
        <div className="p-4 space-y-4">
          {orders.map((order) => (
            <Card key={order._id} className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500">
                      <Check className="w-3 h-3 mr-1" />
                      Completed
                    </Badge>
                    <Badge variant="outline">Table {order.tableNumber}</Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <CardTitle className="text-lg mt-2">{order.customerName}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {order.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 border-b last:border-b-0"
                    >
                      <div>
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <p className="text-sm text-gray-500">
                          ₹{item.price} × {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold text-gray-700">
                        ₹{item.price * item.quantity}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t flex items-center justify-between">
                  <p className="text-gray-600">Total Amount</p>
                  <p className="text-xl font-bold text-orange-600">
                    ₹{order.totalAmount}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
