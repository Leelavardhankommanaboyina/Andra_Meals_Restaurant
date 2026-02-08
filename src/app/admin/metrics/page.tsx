'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Loader2,
  BarChart3,
  Calendar as CalendarIcon,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  UtensilsCrossed,
  Users,
  ShoppingBag,
  Receipt,
} from 'lucide-react';
import { metricsApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Metrics {
  date: string;
  revenue: {
    total: number;
    ordersCount: number;
  };
  itemsSold: {
    total: number;
    items: Array<{ name: string; quantity: number; revenue: number }>;
    mostPopular: { name: string; quantity: number; revenue: number } | null;
    leastPopular: { name: string; quantity: number; revenue: number } | null;
  };
  inventory: {
    totalMenuItems: number;
    activeMenuItems: number;
  };
  staff: {
    totalServers: number;
    activeServers: number;
  };
  orders: {
    ongoing: number;
    completed: number;
    paid: number;
  };
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const fetchMetrics = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await metricsApi.get(format(selectedDate, 'yyyy-MM-dd'));
      setMetrics(response.data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast.error('Failed to load metrics');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Failed to load metrics</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 lg:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Business Metrics</h1>
            <p className="text-gray-500">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, 'PP')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 bg-gray-50">
        <div className="p-4 lg:p-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Revenue
                </CardTitle>
                <IndianRupee className="w-4 h-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  ₹{metrics.revenue.total.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  from {metrics.revenue.ordersCount} paid orders
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Items Sold
                </CardTitle>
                <ShoppingBag className="w-4 h-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">
                  {metrics.itemsSold.total}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  across {metrics.itemsSold.items.length} unique items
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Active Orders
                </CardTitle>
                <Receipt className="w-4 h-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-600">
                  {metrics.orders.ongoing + metrics.orders.completed}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {metrics.orders.ongoing} ongoing, {metrics.orders.completed} ready
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Staff Status
                </CardTitle>
                <Users className="w-4 h-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-purple-600">
                  {metrics.staff.activeServers}/{metrics.staff.totalServers}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  active servers
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Popular Items */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Most Popular */}
            {metrics.itemsSold.mostPopular && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="w-5 h-5" />
                    Most Popular Item
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xl font-semibold text-gray-800">
                        {metrics.itemsSold.mostPopular.name}
                      </p>
                      <p className="text-gray-500">
                        {metrics.itemsSold.mostPopular.quantity} units sold
                      </p>
                    </div>
                    <Badge className="bg-green-100 text-green-700 text-lg">
                      ₹{metrics.itemsSold.mostPopular.revenue}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Least Popular */}
            {metrics.itemsSold.leastPopular && 
             metrics.itemsSold.items.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <TrendingDown className="w-5 h-5" />
                    Least Popular Item
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xl font-semibold text-gray-800">
                        {metrics.itemsSold.leastPopular.name}
                      </p>
                      <p className="text-gray-500">
                        {metrics.itemsSold.leastPopular.quantity} units sold
                      </p>
                    </div>
                    <Badge className="bg-red-100 text-red-700 text-lg">
                      ₹{metrics.itemsSold.leastPopular.revenue}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Items Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-orange-500" />
                Items Sold Today (Sorted by Quantity)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.itemsSold.items.length === 0 ? (
                <div className="text-center py-8">
                  <UtensilsCrossed className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No items sold on this date</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {metrics.itemsSold.items.map((item, index) => {
                    const maxQty = metrics.itemsSold.items[0]?.quantity || 1;
                    const widthPercent = (item.quantity / maxQty) * 100;

                    return (
                      <div key={item.name} className="relative">
                        <div className="flex items-center justify-between relative z-10 py-2">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-500 w-6">
                              #{index + 1}
                            </span>
                            <span className="font-medium text-gray-800">
                              {item.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-500">
                              {item.quantity} sold
                            </span>
                            <Badge variant="secondary">
                              ₹{item.revenue}
                            </Badge>
                          </div>
                        </div>
                        <div
                          className="absolute inset-0 bg-orange-100 rounded opacity-50"
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inventory Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-orange-500" />
                Menu Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold text-gray-800">
                    {metrics.inventory.totalMenuItems}
                  </p>
                  <p className="text-sm text-gray-500">Total Menu Items</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-3xl font-bold text-green-600">
                    {metrics.inventory.activeMenuItems}
                  </p>
                  <p className="text-sm text-gray-500">Active Items</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
