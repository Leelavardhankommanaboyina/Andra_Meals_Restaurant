'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Loader2, Users, Search, X } from 'lucide-react';
import { ordersApi } from '@/lib/api-client';
import { toast } from 'sonner';

interface Customer {
  _id: string;
  customerName: string;
  status: string;
  itemCount: number;
  serverName: string;
  createdAt: string;
}

interface CustomerListProps {
  tableNumber: number;
  onSelect: (customerId: string, customerName: string) => void;
  onBack: () => void;
}

export function CustomerList({ tableNumber, onSelect, onBack }: CustomerListProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setIsLoading(true);
        const response = await ordersApi.getTableCustomers(tableNumber);
        setCustomers(response.data.customers);
      } catch (error) {
        console.error('Error fetching customers:', error);
        toast.error('Failed to load customers');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, [tableNumber]);

  const handleSelect = (customer: Customer) => {
    setSelectedId(customer._id);
  };

  const handleNext = () => {
    if (!selectedId) {
      toast.error('Please select a customer');
      return;
    }
    const customer = customers.find((c) => c._id === selectedId);
    if (customer) {
      onSelect(customer._id, customer.customerName);
    }
  };

  // Filter customers by search query
  const filteredCustomers = customers.filter(customer =>
    customer.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              No Customers at Table {tableNumber}
            </h2>
            <p className="text-gray-500 mb-4">
              There are no active orders at this table
            </p>
            <Button variant="outline" onClick={onBack}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="font-semibold text-gray-800">Select Customer</h1>
            <p className="text-sm text-orange-500">Table {tableNumber}</p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by customer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 h-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => setSearchQuery('')}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Customer List */}
      <ScrollArea className="flex-1 bg-gray-50">
        <div className="p-4 space-y-3">
          {filteredCustomers.length === 0 && searchQuery && (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No customers found matching &quot;{searchQuery}&quot;</p>
            </div>
          )}
          {filteredCustomers.map((customer) => (
            <Card
              key={customer._id}
              className={`cursor-pointer transition-all ${selectedId === customer._id
                  ? 'ring-2 ring-orange-500 bg-orange-50'
                  : 'hover:bg-gray-50'
                }`}
              onClick={() => handleSelect(customer)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800 text-lg">
                      {customer.customerName}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge
                        variant={customer.status === 'ongoing' ? 'default' : 'secondary'}
                        className={`text-xs ${customer.status === 'ongoing'
                            ? 'bg-green-500'
                            : 'bg-blue-500 text-white'
                          }`}
                      >
                        {customer.status === 'ongoing' ? '● Active' : '✓ Completed'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {customer.itemCount} items
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Served by <span className="font-medium">{customer.serverName}</span> • {new Date(customer.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedId === customer._id
                        ? 'border-orange-500 bg-orange-500'
                        : 'border-gray-300'
                      }`}
                  >
                    {selectedId === customer._id && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="bg-white border-t p-4">
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-12" onClick={onBack}>
            Back
          </Button>
          <Button
            className="flex-1 h-12 bg-orange-500 hover:bg-orange-600"
            onClick={handleNext}
            disabled={!selectedId}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
