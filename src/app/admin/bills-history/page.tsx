'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Loader2,
  Receipt,
  Calendar as CalendarIcon,
  IndianRupee,
} from 'lucide-react';
import { billsApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Bill {
  _id: string;
  tableNumber: number;
  customerName: string;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  totalAmount: number;
  serverName: string;
  paidAt: string;
}

export default function BillsHistoryPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);

  const fetchBills = useCallback(async () => {
    try {
      setIsLoading(true);

      const params: { startDate?: string; endDate?: string } = {};
      if (startDate || endDate) {
        const buildDateTime = (date: Date, time: string, isEndBoundary: boolean) => {
          const next = new Date(date);
          if (time) {
            const [hours, minutes] = time.split(':').map((value) => parseInt(value, 10));
            next.setHours(hours || 0, minutes || 0, isEndBoundary ? 59 : 0, isEndBoundary ? 999 : 0);
          } else if (isEndBoundary) {
            next.setHours(23, 59, 59, 999);
          } else {
            next.setHours(0, 0, 0, 0);
          }
          return next;
        };

        const startBoundary = startDate ? buildDateTime(startDate, startTime, false) : undefined;
        const endBoundary = endDate ? buildDateTime(endDate, endTime, true) : undefined;

        if (startBoundary && endBoundary && startBoundary.getTime() > endBoundary.getTime()) {
          toast.error('From date/time cannot be after To date/time');
          return;
        }

        if (startBoundary) {
          params.startDate = startBoundary.toISOString();
        }
        if (endBoundary) {
          params.endDate = endBoundary.toISOString();
        }
      }

      const response = await billsApi.getAll({ ...params, page: 1, limit: 200 });
      setBills(response.data.bills);
      setTotalAmount(response.data.totalAmount);
    } catch (error) {
      console.error('Error fetching bills:', error);
      toast.error('Failed to load bills');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, startTime, endTime]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setStartTime('');
    setEndTime('');
  };

  // Group bills by date
  const groupedBills = bills.reduce((acc, bill) => {
    const date = format(new Date(bill.paidAt), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(bill);
    return acc;
  }, {} as Record<string, Bill[]>);

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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Bills History</h1>
              <p className="text-gray-500">
                Total Bills: {bills.length} | Revenue: ₹{totalAmount.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Date Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[180px] justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'PP') : 'From Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={!startDate}
              className="w-[150px]"
              placeholder="From Time"
            />

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[180px] justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'PP') : 'To Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={!endDate}
              className="w-[150px]"
              placeholder="To Time"
            />

            {(startDate || endDate || startTime || endTime) && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 bg-gray-50">
        <div className="p-4 lg:p-6">
          {bills.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-800 mb-2">No Bills Found</h2>
              <p className="text-gray-500">
                {startDate || endDate || startTime || endTime
                  ? 'No bills found for the selected date/time range'
                  : 'Bills will appear here after payments are completed'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedBills)
                .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                .map(([date, dateBills]) => {
                  const dayTotal = dateBills.reduce((sum, b) => sum + b.totalAmount, 0);
                  return (
                    <div key={date}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-800">
                          {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                        </h3>
                        <Badge variant="secondary" className="text-base">
                          <IndianRupee className="w-4 h-4 mr-1" />
                          {dayTotal.toLocaleString()}
                        </Badge>
                      </div>
                      <div className="grid gap-3">
                        {dateBills.map((bill) => (
                          <Card key={bill._id}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge className="bg-orange-100 text-orange-700">
                                      Table {bill.tableNumber}
                                    </Badge>
                                    <span className="text-sm text-gray-500">
                                      {format(new Date(bill.paidAt), 'h:mm a')}
                                    </span>
                                  </div>
                                  <p className="font-semibold text-gray-800">
                                    {bill.customerName}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    Served by {bill.serverName}
                                  </p>
                                  <div className="mt-2 text-sm text-gray-600">
                                    {bill.items.map((item, idx) => (
                                      <span key={idx}>
                                        {item.name} ×{item.quantity}
                                        {idx < bill.items.length - 1 ? ', ' : ''}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xl font-bold text-green-600">
                                    ₹{bill.totalAmount}
                                  </p>
                                  <Badge className="bg-green-100 text-green-700 mt-1">
                                    Paid
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Summary Footer */}
      {bills.length > 0 && (
        <div className="bg-white border-t px-4 py-4 lg:px-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600">
                ₹{totalAmount.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total Bills</p>
              <p className="text-2xl font-bold text-gray-800">{bills.length}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
