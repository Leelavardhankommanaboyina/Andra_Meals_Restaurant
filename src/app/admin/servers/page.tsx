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
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  User,
  Users,
} from 'lucide-react';
import { serversApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAdminStore } from '@/store';

interface Server {
  _id: string;
  username: string;
  role: 'server' | 'servent';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  username: string;
  password: string;
  role: 'server' | 'servent';
}

const getRoleLabel = (role: 'server' | 'servent') =>
  role === 'server' ? 'Supervisor' : 'Servant';

export default function ServersPage() {
  const { servers, setServers, addServer, updateServer, removeServer } = useAdminStore();
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [formData, setFormData] = useState<FormData>({ username: '', password: '', role: 'server' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchServers = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await serversApi.getAll();
      setServers(response.data.servers);
    } catch (error) {
      console.error('Error fetching servers:', error);
      toast.error('Failed to load servers');
    } finally {
      setIsLoading(false);
    }
  }, [setServers]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const handleAddServer = async () => {
    if (!formData.username || !formData.password) {
      toast.error('Please fill all fields');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await serversApi.create(formData);
      const data = response as { data: Server };
      addServer(data.data);
      toast.success('Staff added successfully');
      setShowAddDialog(false);
      setFormData({ username: '', password: '', role: 'server' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateServer = async () => {
    if (!selectedServer) return;

    const updateData: Partial<FormData & { isActive: boolean }> = {};
    if (formData.username !== selectedServer.username) {
      updateData.username = formData.username;
    }
    if (formData.role !== selectedServer.role) {
      updateData.role = formData.role;
    }
    if (formData.password) {
      if (formData.password.length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
      }
      updateData.password = formData.password;
    }

    if (Object.keys(updateData).length === 0) {
      setShowEditDialog(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await serversApi.update(selectedServer._id, updateData);
      updateServer(selectedServer._id, { username: formData.username, role: formData.role });
      toast.success('Staff updated successfully');
      setShowEditDialog(false);
      setSelectedServer(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (server: Server) => {
    try {
      await serversApi.update(server._id, { isActive: !server.isActive });
      updateServer(server._id, { isActive: !server.isActive });
      toast.success(`Staff ${server.isActive ? 'deactivated' : 'activated'}`);
    } catch {
      toast.error('Failed to update staff status');
    }
  };

  const handleDeleteServer = async (server: Server) => {
    if (!confirm(`Are you sure you want to delete ${getRoleLabel(server.role)} "${server.username}"?`)) return;

    try {
      await serversApi.delete(server._id);
      removeServer(server._id);
      toast.success('Staff deleted');
    } catch {
      toast.error('Failed to delete staff');
    }
  };

  const openEditDialog = (server: Server) => {
    setSelectedServer(server);
    setFormData({
      username: server.username,
      password: '',
      role: server.role,
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
            <h1 className="text-2xl font-bold text-gray-800">Staff</h1>
            <p className="text-gray-500">
              Total: {servers.length} | Active: {servers.filter(s => s.isActive).length} | Supervisors: {servers.filter(s => s.role === 'server').length} | Servants: {servers.filter(s => s.role === 'servent').length}
            </p>
          </div>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Staff
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 bg-gray-50">
        <div className="p-4 lg:p-6">
          {servers.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-800 mb-2">No Staff</h2>
                <p className="text-gray-500 mb-4">Add staff accounts to manage orders</p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Staff
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {servers.map((server) => (
                <Card key={server._id} className={server.isActive ? '' : 'opacity-75'}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          server.isActive ? 'bg-green-100' : 'bg-gray-100'
                        }`}>
                          <User className={`w-5 h-5 ${
                            server.isActive ? 'text-green-600' : 'text-gray-400'
                          }`} />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{server.username}</CardTitle>
                          <div className="flex gap-2 mt-1">
                            <Badge
                              variant={server.isActive ? 'default' : 'secondary'}
                              className={server.isActive ? 'bg-green-500' : ''}
                            >
                              {server.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge variant="outline">
                              {getRoleLabel(server.role)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-500 mb-4">
                      Created: {new Date(server.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(server)}
                        className="flex-1"
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(server)}
                      >
                        {server.isActive ? (
                          <PowerOff className="w-4 h-4 text-orange-500" />
                        ) : (
                          <Power className="w-4 h-4 text-green-500" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteServer(server)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Add Server Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Staff</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                placeholder="Enter username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Enter password (min 6 characters)"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'server' | 'servent' })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="server">Supervisor</option>
                <option value="servent">Servant</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddServer}
              disabled={isSubmitting}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Add Staff'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Server Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Staff</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                placeholder="Enter username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>New Password (leave empty to keep current)</Label>
              <Input
                type="password"
                placeholder="Enter new password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'server' | 'servent' })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="server">Supervisor</option>
                <option value="servent">Servant</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateServer}
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
