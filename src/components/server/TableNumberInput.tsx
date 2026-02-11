'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { tablesApi } from '@/lib/api-client';

const MIN_TABLE = parseInt(process.env.NEXT_PUBLIC_MIN_TABLE_NUMBER || '1');
const MAX_TABLE = parseInt(process.env.NEXT_PUBLIC_MAX_TABLE_NUMBER || '20');

interface TableNumberInputProps {
  onNext: (tableNumber: number) => void;
  initialValue?: number | null;
}

export function TableNumberInput({ onNext, initialValue }: TableNumberInputProps) {
  const [tableNumber, setTableNumber] = useState<string>(
    initialValue?.toString() || ''
  );
  const [error, setError] = useState<string>('');
  const [configuredTables, setConfiguredTables] = useState<number[]>([]);
  const [minConfiguredTable, setMinConfiguredTable] = useState<number>(MIN_TABLE);
  const [maxConfiguredTable, setMaxConfiguredTable] = useState<number>(MAX_TABLE);
  const [isConfigLoading, setIsConfigLoading] = useState(true);

  useEffect(() => {
    const loadTables = async () => {
      try {
        setIsConfigLoading(true);
        const response = await tablesApi.getAll();
        const tableNumbers = response.data.tables
          .map((table) => table.tableNumber)
          .sort((a, b) => a - b);

        if (tableNumbers.length > 0) {
          setConfiguredTables(tableNumbers);
          setMinConfiguredTable(tableNumbers[0]);
          setMaxConfiguredTable(tableNumbers[tableNumbers.length - 1]);
        }
      } catch {
        // Fallback to env range when table config endpoint isn't available.
        setConfiguredTables([]);
        setMinConfiguredTable(MIN_TABLE);
        setMaxConfiguredTable(MAX_TABLE);
      } finally {
        setIsConfigLoading(false);
      }
    };

    loadTables();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers
    if (value === '' || /^\d+$/.test(value)) {
      setTableNumber(value);
      setError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const num = parseInt(tableNumber);
    
    if (!tableNumber) {
      setError('Table number is required');
      return;
    }

    if (isNaN(num)) {
      setError('Please enter a valid number');
      return;
    }

    if (configuredTables.length > 0) {
      if (!configuredTables.includes(num)) {
        setError(`Table ${num} is not configured`);
        return;
      }
    } else if (num < MIN_TABLE || num > MAX_TABLE) {
      setError(`Table number must be between ${MIN_TABLE} and ${MAX_TABLE}`);
      return;
    }

    onNext(num);
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-7rem)] p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-gray-800">Enter Table Number</CardTitle>
          <p className="text-gray-500 mt-2">
            Valid range: {minConfiguredTable} - {maxConfiguredTable}
          </p>
        </CardHeader>
        <CardContent>
          {isConfigLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="tableNumber" className="text-base">Table Number</Label>
              <Input
                id="tableNumber"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={`Enter table number (${minConfiguredTable}-${maxConfiguredTable})`}
                value={tableNumber}
                onChange={handleInputChange}
                className={`text-center text-2xl h-14 ${error ? 'border-red-500' : ''}`}
                autoFocus
              />
              {error && (
                <p className="text-red-500 text-sm text-center">{error}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-lg bg-orange-500 hover:bg-orange-600"
            >
              Next
            </Button>
          </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
