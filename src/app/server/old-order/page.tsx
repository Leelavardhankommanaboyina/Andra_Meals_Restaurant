'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  TableNumberInput,
  CustomerList,
  OrderItemsInput
} from '@/components/server';
import { ordersApi } from '@/lib/api-client';
import { SERVER_QUICK_CATEGORIES } from '@/lib/constants';

interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

type Step = 'table' | 'customers' | 'items';

export default function OldOrderPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('table');
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const handleTableNext = (table: number) => {
    setTableNumber(table);
    setStep('customers');
  };

  const handleCustomerSelect = (orderId: string, name: string) => {
    setSelectedOrderId(orderId);
    setCustomerName(name);
    setStep('items');
  };

  const handleBack = () => {
    if (step === 'customers') {
      setStep('table');
    } else if (step === 'items') {
      setStep('customers');
    }
  };

  const handleDone = async (items: OrderItem[]) => {
    if (!selectedOrderId) return;
    if (submitLockRef.current) return;

    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      await ordersApi.update(selectedOrderId, { items });

      toast.success(`Items added to ${customerName}'s order!`);
      // Redirect to My Orders so server can see/deliver the items they just added
      router.push('/server/my-orders');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add items');
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (step === 'table') {
    return <TableNumberInput onNext={handleTableNext} initialValue={tableNumber} />;
  }

  if (step === 'customers' && tableNumber) {
    return (
      <CustomerList
        tableNumber={tableNumber}
        onSelect={handleCustomerSelect}
        onBack={handleBack}
      />
    );
  }

  if (step === 'items' && tableNumber && selectedOrderId) {
    return (
      <OrderItemsInput
        tableNumber={tableNumber}
        customerName={customerName}
        onDone={handleDone}
        onBack={handleBack}
        isSubmitting={isSubmitting}
        categoryButtons={SERVER_QUICK_CATEGORIES}
      />
    );
  }

  return null;
}
