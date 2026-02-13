'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TableNumberInput, CustomerNameInput, OrderItemsInput } from '@/components/server';
import { ordersApi } from '@/lib/api-client';
import { SERVER_QUICK_CATEGORIES } from '@/lib/constants';

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
  const [groupSize, setGroupSize] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const pendingRequestRef = useRef<{ requestId: string; signature: string } | null>(null);

  const generateRequestId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `order-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const buildPayloadSignature = (items: OrderItem[]) =>
    JSON.stringify({
      tableNumber,
      customerName: customerName.trim().toLowerCase(),
      groupSize: groupSize ?? null,
      items: items
        .map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity }))
        .sort((a, b) => a.menuItemId.localeCompare(b.menuItemId)),
    });

  const handleTableNext = (table: number) => {
    setTableNumber(table);
    setStep('customer');
  };

  const handleCustomerNext = (name: string, peopleInGroup?: number) => {
    setCustomerName(name);
    setGroupSize(peopleInGroup ?? null);
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
    if (submitLockRef.current) return;

    submitLockRef.current = true;
    const signature = buildPayloadSignature(items);
    if (!pendingRequestRef.current || pendingRequestRef.current.signature !== signature) {
      pendingRequestRef.current = {
        requestId: generateRequestId(),
        signature,
      };
    }
    const clientRequestId = pendingRequestRef.current.requestId;

    setIsSubmitting(true);
    try {
      await ordersApi.create({
        tableNumber,
        customerName,
        ...(groupSize ? { groupSize } : {}),
        items,
        clientRequestId,
      });

      pendingRequestRef.current = null;
      toast.success('Order created successfully!');
      router.push('/server/my-orders');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create order');
    } finally {
      submitLockRef.current = false;
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
        initialGroupSize={groupSize}
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
        isSubmitting={isSubmitting}
        categoryButtons={SERVER_QUICK_CATEGORIES}
      />
    );
  }

  return null;
}
