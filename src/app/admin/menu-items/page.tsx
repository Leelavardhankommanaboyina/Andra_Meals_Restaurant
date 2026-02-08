'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  UtensilsCrossed,
} from 'lucide-react';
import { menuApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAdminStore } from '@/store';

interface MenuItem {
  _id: string;
  name: string;
  price: number;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  name: string;
  price: string;
  category: string;
}

export default function MenuItemsPage() {
  const { menuItems, menuCategories, setMenuItems, updateMenuItem, removeMenuItem, addMenuItem } = useAdminStore();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState<FormData>({ name: '', price: '', category: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMenuItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await menuApi.getAll({ activeOnly: false });
      setMenuItems(response.data.items);
    } catch (error) {
      console.error('Error fetching menu items:', error);
      toast.error('Failed to load menu items');
    } finally {
      setIsLoading(false);
    }
  }, [setMenuItems]);

  useEffect(() => {
    fetchMenuItems();
  }, [fetchMenuItems]);

  const filteredItems = selectedCategory === 'all'
    ? menuItems
    : menuItems.filter((item) => item.category === selectedCategory);

  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  const handleAddItem = async () => {
    if (!formData.name || !formData.price || !formData.category) {
      toast.error('Please fill all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await menuApi.create({
        name: formData.name,
        price: parseFloat(formData.price),
        category: formData.category,
      });
      
      const data = response as { data: MenuItem };
      addMenuItem(data.data);
      toast.success('Menu item added successfully');
      setShowAddDialog(false);
      setFormData({ name: '', price: '', category: '' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!selectedItem) return;

    setIsSubmitting(true);
    try {
      await menuApi.update(selectedItem._id, {
        name: formData.name,
        price: parseFloat(formData.price),
        category: formData.category,
      });
      
      updateMenuItem(selectedItem._id, {
        name: formData.name,
        price: parseFloat(formData.price),
        category: formData.category,
      });
      
      toast.success('Menu item updated successfully');
      setShowEditDialog(false);
      setSelectedItem(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (item: MenuItem) => {
    try {
      await menuApi.update(item._id, { isActive: !item.isActive });
      updateMenuItem(item._id, { isActive: !item.isActive });
      toast.success(`Item ${item.isActive ? 'deactivated' : 'activated'}`);
    } catch (error) {
      toast.error('Failed to update item status');
    }
  };

  const handleDeleteItem = async (item: MenuItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;

    try {
      await menuApi.delete(item._id);
      removeMenuItem(item._id);
      toast.success('Menu item deleted');
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  const openEditDialog = (item: MenuItem) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      price: item.price.toString(),
      category: item.category,
    });
    setShowEditDialog(true);
  };

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Menu Items</h1>
            <p className="text-gray-500">
              Total: {menuItems.length} items | Active: {menuItems.filter(i => i.isActive).length}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {menuCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 bg-gray-50">
        <div className="p-4 lg:p-6 space-y-6">
          {Object.entries(groupedItems).map(([category, items]) => (
            <Card key={category}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5 text-orange-500" />
                  {category}
                  <Badge variant="secondary">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {items.map((item) => (
                    <div
                      key={item._id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        item.isActive ? 'bg-white' : 'bg-gray-100 opacity-75'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            item.isActive ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        />
                        <div>
                          <p className="font-medium text-gray-800">{item.name}</p>
                          <p className="text-sm text-gray-500">₹{item.price}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(item)}
                        >
                          <Pencil className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleActive(item)}
                        >
                          {item.isActive ? (
                            <PowerOff className="w-4 h-4 text-orange-500" />
                          ) : (
                            <Power className="w-4 h-4 text-green-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteItem(item)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Add Item Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Menu Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Item Name</Label>
              <Input
                placeholder="Enter item name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Price (₹)</Label>
              <Input
                type="number"
                placeholder="Enter price"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input
                placeholder="Enter category (e.g., Main Course, Beverages)"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                list="categories"
              />
              <datalist id="categories">
                {menuCategories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddItem}
              disabled={isSubmitting}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Add Item'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Item Name</Label>
              <Input
                placeholder="Enter item name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Price (₹)</Label>
              <Input
                type="number"
                placeholder="Enter price"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input
                placeholder="Enter category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                list="categories-edit"
              />
              <datalist id="categories-edit">
                {menuCategories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateItem}
              disabled={isSubmitting}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
