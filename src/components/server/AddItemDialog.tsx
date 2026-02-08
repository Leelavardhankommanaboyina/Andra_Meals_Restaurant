'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Plus,
    Minus,
    X,
    Search,
    Loader2
} from 'lucide-react';
import { menuApi, ordersApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface MenuItem {
    _id: string;
    name: string;
    price: number;
    category: string;
}

interface OrderItem {
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
}

interface AddItemDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: string;
    tableNumber: number;
    customerName: string;
    onSuccess: () => void;
}

export function AddItemDialog({
    open,
    onOpenChange,
    orderId,
    tableNumber,
    customerName,
    onSuccess,
}: AddItemDialogProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [filteredItems, setFilteredItems] = useState<MenuItem[]>([]);
    const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Fetch menu items when dialog opens
    useEffect(() => {
        if (!open) return;

        const fetchMenuItems = async () => {
            try {
                setIsLoading(true);
                const response = await menuApi.getAll({ activeOnly: true });
                setMenuItems(response.data.items);
            } catch (error) {
                console.error('Error fetching menu:', error);
                toast.error('Failed to load menu items');
            } finally {
                setIsLoading(false);
            }
        };

        fetchMenuItems();
    }, [open]);

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setSearchQuery('');
            setSelectedItems([]);
            setShowSuggestions(false);
        }
    }, [open]);

    // Filter items based on search query
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredItems([]);
            setShowSuggestions(false);
            return;
        }

        const filtered = menuItems.filter((item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredItems(filtered.slice(0, 6)); // Limit to 6 suggestions for dialog
        setShowSuggestions(true);
    }, [searchQuery, menuItems]);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const addItem = useCallback((item: MenuItem) => {
        setSelectedItems((prev) => {
            const existingIndex = prev.findIndex((i) => i.menuItemId === item._id);
            if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex].quantity += 1;
                return updated;
            }
            return [
                ...prev,
                {
                    menuItemId: item._id,
                    name: item.name,
                    price: item.price,
                    quantity: 1,
                },
            ];
        });
        setSearchQuery('');
        setShowSuggestions(false);
    }, []);

    const removeItem = useCallback((menuItemId: string) => {
        setSelectedItems((prev) => prev.filter((i) => i.menuItemId !== menuItemId));
    }, []);

    const updateQuantity = useCallback((menuItemId: string, delta: number) => {
        setSelectedItems((prev) =>
            prev.map((item) => {
                if (item.menuItemId === menuItemId) {
                    const newQty = Math.max(1, Math.min(99, item.quantity + delta));
                    return { ...item, quantity: newQty };
                }
                return item;
            })
        );
    }, []);

    const handleSubmit = async () => {
        if (selectedItems.length === 0) {
            toast.error('Please add at least one item');
            return;
        }

        setIsSubmitting(true);
        try {
            await ordersApi.update(orderId, { items: selectedItems });
            toast.success(`Items added to ${customerName}'s order!`);
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to add items');
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalAmount = selectedItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Add Items</DialogTitle>
                    <p className="text-sm text-gray-500">
                        Table {tableNumber} • {customerName}
                    </p>
                </DialogHeader>

                {/* Search Bar */}
                <div className="relative" ref={searchRef}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                        type="text"
                        placeholder="Search menu items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-12 text-base"
                    />

                    {/* Autocomplete Suggestions */}
                    <AnimatePresence>
                        {showSuggestions && filteredItems.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 overflow-hidden"
                            >
                                {filteredItems.map((item) => (
                                    <button
                                        key={item._id}
                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 border-b last:border-b-0 transition-colors"
                                        onClick={() => addItem(item)}
                                    >
                                        <div className="flex-1 text-left">
                                            <p className="font-medium text-gray-800">{item.name}</p>
                                            <p className="text-sm text-gray-500">{item.category}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-semibold text-orange-600">
                                                ₹{item.price}
                                            </span>
                                            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                                                <Plus className="w-4 h-4 text-white" />
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {showSuggestions && searchQuery && filteredItems.length === 0 && !isLoading && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 p-4 text-center text-gray-500">
                            No items found matching "{searchQuery}"
                        </div>
                    )}
                </div>

                {/* Selected Items */}
                <ScrollArea className="flex-1 min-h-[150px] max-h-[300px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                        </div>
                    ) : selectedItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                            <Search className="w-10 h-10 mb-2" />
                            <p className="text-sm">Search and add items</p>
                        </div>
                    ) : (
                        <div className="space-y-2 p-1">
                            <AnimatePresence>
                                {selectedItems.map((item) => (
                                    <motion.div
                                        key={item.menuItemId}
                                        layout
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 100 }}
                                        className="bg-gray-50 rounded-lg border p-3"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-800 text-sm truncate">{item.name}</p>
                                                <p className="text-xs text-gray-500">
                                                    ₹{item.price} × {item.quantity} = <span className="font-semibold text-orange-600">₹{item.price * item.quantity}</span>
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => updateQuantity(item.menuItemId, -1)}
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </Button>
                                                <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => updateQuantity(item.menuItemId, 1)}
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => removeItem(item.menuItemId)}
                                                >
                                                    <X className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </ScrollArea>

                {/* Footer */}
                <DialogFooter className="flex-col sm:flex-col gap-2">
                    {selectedItems.length > 0 && (
                        <div className="flex justify-between items-center w-full py-2 border-t">
                            <span className="text-sm text-gray-500">
                                {selectedItems.length} item(s)
                            </span>
                            <span className="font-bold text-orange-600">
                                Total: ₹{totalAmount}
                            </span>
                        </div>
                    )}
                    <div className="flex gap-3 w-full">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="flex-1 bg-orange-500 hover:bg-orange-600"
                            onClick={handleSubmit}
                            disabled={selectedItems.length === 0 || isSubmitting}
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                'Add Items'
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
