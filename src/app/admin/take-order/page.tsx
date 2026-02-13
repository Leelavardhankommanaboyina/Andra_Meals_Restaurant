'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { TableNumberInput, CustomerNameInput, OrderItemsInput } from '@/components/server';
import { ordersApi, serversApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

interface StaffUser {
  _id: string;
  username: string;
  role: 'server' | 'servent';
  isActive: boolean;
}

type Step = 'table' | 'customer' | 'items';
type AssignmentMode = 'manual' | 'auto';
type AssigneeRole = 'server' | 'servent';

const getRoleLabel = (role: AssigneeRole) => (role === 'server' ? 'Supervisor' : 'Servant');

export default function AdminTakeOrderPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('table');
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [groupSize, setGroupSize] = useState<number | null>(null);
  const [pendingItems, setPendingItems] = useState<OrderItem[] | null>(null);

  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('manual');
  const [assigneeRole, setAssigneeRole] = useState<AssigneeRole>('server');
  const [assigneeId, setAssigneeId] = useState('');
  const submitLockRef = useRef(false);
  const pendingRequestRef = useRef<{ requestId: string; signature: string } | null>(null);

  const generateRequestId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `order-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setIsLoadingStaff(true);
        const response = await serversApi.getAll();
        const users = (response.data.servers as StaffUser[]).filter((user) => user.isActive);
        setStaffUsers(users);
      } catch (error) {
        console.error('Failed to fetch staff:', error);
        toast.error('Failed to load staff list');
      } finally {
        setIsLoadingStaff(false);
      }
    };

    fetchStaff();
  }, []);

  const filteredStaff = useMemo(
    () => staffUsers.filter((staff) => staff.role === assigneeRole && staff.isActive),
    [staffUsers, assigneeRole]
  );

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

  const handleItemsDone = (items: OrderItem[]) => {
    setPendingItems(items);
    setAssigneeId('');
    setShowAssignDialog(true);
  };

  const handleCreateOrder = async () => {
    if (!tableNumber || !customerName || !pendingItems || pendingItems.length === 0) {
      return;
    }

    if (assignmentMode === 'manual' && !assigneeId) {
      toast.error('Please select a user for manual assignment');
      return;
    }
    if (submitLockRef.current) {
      return;
    }

    const signature = JSON.stringify({
      tableNumber,
      customerName: customerName.trim().toLowerCase(),
      groupSize: groupSize ?? null,
      items: pendingItems
        .map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity }))
        .sort((a, b) => a.menuItemId.localeCompare(b.menuItemId)),
      assignmentMode,
      assigneeRole,
      assigneeId: assignmentMode === 'manual' ? assigneeId : null,
    });
    if (!pendingRequestRef.current || pendingRequestRef.current.signature !== signature) {
      pendingRequestRef.current = {
        requestId: generateRequestId(),
        signature,
      };
    }
    const clientRequestId = pendingRequestRef.current.requestId;

    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      await ordersApi.create({
        tableNumber,
        customerName,
        ...(groupSize ? { groupSize } : {}),
        items: pendingItems,
        clientRequestId,
        assignment: {
          mode: assignmentMode,
          assigneeRole,
          ...(assignmentMode === 'manual' ? { assigneeId } : {}),
        },
      });

      pendingRequestRef.current = null;
      toast.success('Order created and assigned successfully');
      setShowAssignDialog(false);
      router.push('/admin/customers');
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
      <>
        <OrderItemsInput
          tableNumber={tableNumber}
          customerName={customerName}
          onDone={handleItemsDone}
          onBack={handleBack}
          isSubmitting={isSubmitting}
        />

        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Order</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Assignment Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={assignmentMode === 'manual' ? 'default' : 'outline'}
                    className={assignmentMode === 'manual' ? 'bg-orange-500 hover:bg-orange-600' : ''}
                    onClick={() => setAssignmentMode('manual')}
                  >
                    Manual Assign
                  </Button>
                  <Button
                    type="button"
                    variant={assignmentMode === 'auto' ? 'default' : 'outline'}
                    className={assignmentMode === 'auto' ? 'bg-orange-500 hover:bg-orange-600' : ''}
                    onClick={() => setAssignmentMode('auto')}
                  >
                    Auto Assign
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>User Type</Label>
                <select
                  value={assigneeRole}
                  onChange={(e) => {
                    setAssigneeRole(e.target.value as AssigneeRole);
                    setAssigneeId('');
                  }}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="server">Supervisor</option>
                  <option value="servent">Servant</option>
                </select>
              </div>

              {assignmentMode === 'manual' && (
                <div className="space-y-2">
                  <Label>Select User</Label>
                  {isLoadingStaff ? (
                    <div className="h-10 border rounded-md flex items-center justify-center text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Loading staff...
                    </div>
                  ) : filteredStaff.length === 0 ? (
                    <Input value={`No active ${getRoleLabel(assigneeRole)} accounts found`} disabled />
                  ) : (
                    <select
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Select user</option>
                      {filteredStaff.map((staff) => (
                        <option key={staff._id} value={staff._id}>
                          {staff.username}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssignDialog(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateOrder}
                disabled={
                  isSubmitting ||
                  (assignmentMode === 'manual' && (!assigneeId || filteredStaff.length === 0))
                }
                className="bg-orange-500 hover:bg-orange-600"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create & Assign'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return null;
}
