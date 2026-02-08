'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TableNumberInput, CustomerNameInput, OrderItemsInput } from '@/components/server';
import { ordersApi } from '@/lib/api-client';

interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

type Step = 'table' | 'customer' | 'items';

export default function NewOrderPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('table');
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTableNext = (table: number) => {
    setTableNumber(table);
    setStep('customer');
  };

  const handleCustomerNext = (name: string) => {
    setCustomerName(name);
    setStep('items');
  };

  const handleBack = () => {
    if (step === 'customer') {
      setStep('table');
    } else if (step === 'items') {
      setStep('customer');
    }
  };

  const handleDone = async (items: OrderItem[]) => {
    if (!tableNumber || !customerName) return;

    setIsSubmitting(true);
    try {
      await ordersApi.create({
        tableNumber,
        customerName,
        items,
      });

      toast.success('Order created successfully!');
      router.push('/server/my-orders');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create order');
      setIsSubmitting(false);
    }
  };

  if (step === 'table') {
    return <TableNumberInput onNext={handleTableNext} initialValue={tableNumber} />;
  }

  if (step === 'customer' && tableNumber) {
    return (
      <CustomerNameInput
        tableNumber={tableNumber}
        onNext={handleCustomerNext}
        onBack={handleBack}
        initialValue={customerName}
      />
    );
  }

  if (step === 'items' && tableNumber) {
    return (
      <OrderItemsInput
        tableNumber={tableNumber}
        customerName={customerName}
        onDone={handleDone}
        onBack={handleBack}
      />
    );
  }

  return null;
}
