'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  Plus, 
  Minus, 
  X, 
  Search,
  Loader2 
} from 'lucide-react';
import { menuApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

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

interface OrderItemsInputProps {
  tableNumber: number;
  customerName: string;
  onDone: (items: OrderItem[]) => void;
  onBack: () => void;
  initialItems?: OrderItem[];
}

export function OrderItemsInput({
  tableNumber,
  customerName,
  onDone,
  onBack,
  initialItems = [],
}: OrderItemsInputProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>(initialItems);
  const [isLoading, setIsLoading] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch menu items
  useEffect(() => {
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
  }, []);

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
    setFilteredItems(filtered.slice(0, 8)); // Limit to 8 suggestions
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
    toast.success(`Added ${item.name}`);
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

  const handleQuantityInput = useCallback((menuItemId: string, value: string) => {
    const num = parseInt(value);
    if (!isNaN(num) && num >= 1 && num <= 99) {
      setSelectedItems((prev) =>
        prev.map((item) =>
          item.menuItemId === menuItemId ? { ...item, quantity: num } : item
        )
      );
    }
  }, []);

  const handleDone = () => {
    if (selectedItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    onDone(selectedItems);
  };

  const handleSwipeToRemove = (menuItemId: string, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 100) {
      removeItem(menuItemId);
      toast.info('Item removed');
    }
  };

  const totalAmount = selectedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="font-semibold text-gray-800">Add Items</h1>
          <p className="text-sm text-gray-500">
            Table {tableNumber} • {customerName}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 bg-white border-b" ref={searchRef}>
        <div className="relative">
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

          {showSuggestions && searchQuery && filteredItems.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 p-4 text-center text-gray-500">
              No items found matching "{searchQuery}"
            </div>
          )}
        </div>
      </div>

      {/* Selected Items */}
      <div className="flex-1 overflow-hidden bg-gray-50">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : selectedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
            <Search className="w-16 h-16 mb-4 text-gray-300" />
            <p className="text-lg font-medium">No items added yet</p>
            <p className="text-sm">Search and add items to the order</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              <AnimatePresence>
                {selectedItems.map((item) => (
                  <motion.div
                    key={item.menuItemId}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 100 }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(_, info) => handleSwipeToRemove(item.menuItemId, info)}
                    className="bg-white rounded-lg shadow-sm border p-4 cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <p className="text-sm text-gray-500">
                          ₹{item.price} × {item.quantity} ={' '}
                          <span className="font-semibold text-orange-600">
                            ₹{item.price * item.quantity}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.menuItemId, -1)}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={item.quantity}
                          onChange={(e) =>
                            handleQuantityInput(item.menuItemId, e.target.value)
                          }
                          className="w-12 h-8 text-center p-0"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.menuItemId, 1)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => removeItem(item.menuItemId)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <p className="text-xs text-gray-400 text-center mt-4">
                Swipe left or right to remove items
              </p>
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t p-4 space-y-3">
        {selectedItems.length > 0 && (
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500">
                {selectedItems.length} item(s)
              </p>
              <p className="text-lg font-bold text-gray-800">
                Total: <span className="text-orange-600">₹{totalAmount}</span>
              </p>
            </div>
            <Badge variant="secondary" className="text-sm">
              {selectedItems.reduce((sum, i) => sum + i.quantity, 0)} qty
            </Badge>
          </div>
        )}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-12" onClick={onBack}>
            Back
          </Button>
          <Button
            className="flex-1 h-12 bg-orange-500 hover:bg-orange-600"
            onClick={handleDone}
            disabled={selectedItems.length === 0}
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
