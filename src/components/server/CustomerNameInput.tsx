'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ChevronLeft } from 'lucide-react';
import { ordersApi } from '@/lib/api-client';
import { toast } from 'sonner';

interface CustomerNameInputProps {
  tableNumber: number;
  onNext: (customerName: string, groupSize?: number) => void;
  onBack: () => void;
  initialValue?: string;
  initialGroupSize?: number | null;
}

export function CustomerNameInput({
  tableNumber,
  onNext,
  onBack,
  initialValue = '',
  initialGroupSize = null,
}: CustomerNameInputProps) {
  const [customerName, setCustomerName] = useState<string>(initialValue);
  const [groupSize, setGroupSize] = useState<string>(
    initialGroupSize ? String(initialGroupSize) : ''
  );
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  const [groupSizeError, setGroupSizeError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch existing customer names for this table
  useEffect(() => {
    const fetchExistingCustomers = async () => {
      try {
        setIsLoading(true);
        const response = await ordersApi.getTableCustomers(tableNumber);
        const names = response.data.customers.map((c) =>
          c.customerName.toLowerCase()
        );
        setExistingNames(names);
      } catch (error) {
        console.error('Error fetching customers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExistingCustomers();
  }, [tableNumber]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomerName(value);
    setError('');
  };

  const handleGroupSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d+$/.test(value)) {
      setGroupSize(value);
      setGroupSizeError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = customerName.trim();

    if (!trimmedName) {
      setError('Customer name is required');
      return;
    }

    if (trimmedName.length > 50) {
      setError('Customer name cannot exceed 50 characters');
      return;
    }

    // Check for duplicate name (case-insensitive)
    if (existingNames.includes(trimmedName.toLowerCase())) {
      setError(
        `"${trimmedName}" already has an order at this table. Please use a unique name (e.g., add initial or second name).`
      );
      toast.error('Duplicate customer name detected!');
      return;
    }

    let parsedGroupSize: number | undefined;
    if (groupSize.trim() !== '') {
      const parsed = Number(groupSize);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 30) {
        setGroupSizeError('Group size must be between 1 and 30');
        return;
      }
      parsedGroupSize = parsed;
    }

    onNext(trimmedName, parsedGroupSize);
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-7rem)] p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="text-gray-600"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <div className="flex-1 text-center">
              <CardTitle className="text-2xl text-gray-800">
                Customer Name
              </CardTitle>
              <p className="text-orange-500 font-medium mt-1">
                Table {tableNumber}
              </p>
            </div>
            <div className="w-10" /> {/* Spacer for alignment */}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="customerName" className="text-base">
                  Enter Customer Name
                </Label>
                <Input
                  id="customerName"
                  type="text"
                  placeholder="e.g., Raju, Raju K, Raju Kumar"
                  value={customerName}
                  onChange={handleInputChange}
                  className={`text-lg h-12 ${error ? 'border-red-500' : ''}`}
                  autoFocus
                  maxLength={50}
                />
                {error && (
                  <p className="text-red-500 text-sm">{error}</p>
                )}
                {existingNames.length > 0 && (
                  <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-sm text-amber-800 font-medium mb-2">
                      Existing customers at this table:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {existingNames.map((name, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-sm capitalize"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="groupSize" className="text-base">
                  Group Size (Optional)
                </Label>
                <Input
                  id="groupSize"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="e.g., 4"
                  value={groupSize}
                  onChange={handleGroupSizeChange}
                  className={`h-11 w-28 ${groupSizeError ? 'border-red-500' : ''}`}
                />
                {groupSizeError && (
                  <p className="text-red-500 text-sm">{groupSizeError}</p>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={onBack}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-12 bg-orange-500 hover:bg-orange-600"
                >
                  Next
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
