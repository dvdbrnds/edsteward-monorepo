/**
 * Role Assignments Settings
 * 
 * Allows admins to map suggested roles (from MCP Engine) to default DRIs.
 * Tasks with these roles will auto-assign to the configured person.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Edit2,
  Trash2,
  Loader2,
  Mail,
  User as UserIcon,
  AlertCircle,
  Plus,
  Download,
} from 'lucide-react';

interface RoleAssignment {
  id: number;
  roleName: string;
  displayName: string | null;
  officeName: string | null;
  officeEmail: string | null;
  defaultUserId: number | null;
  defaultEmail: string | null;
  defaultName: string | null;
  backupUserId: number | null;
  backupEmail: string | null;
  category: string | null;
  description: string | null;
  autoAssignEnabled: boolean;
  defaultUser: {
    id: number;
    username: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  backupUser: {
    id: number;
    username: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

interface SystemUser {
  id: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export function RoleAssignmentsSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingRole, setEditingRole] = useState<RoleAssignment | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  // Form state for editing
  const [formData, setFormData] = useState({
    officeName: '',
    officeEmail: '',
    defaultUserId: '',
    defaultEmail: '',
    defaultName: '',
    backupUserId: '',
    backupEmail: '',
    category: '',
    description: '',
    autoAssignEnabled: true,
  });

  // Form state for adding new role
  const [newRoleData, setNewRoleData] = useState({
    roleName: '',
    displayName: '',
    officeName: '',
    officeEmail: '',
    defaultUserId: '',
    defaultEmail: '',
    defaultName: '',
    category: '',
    description: '',
    autoAssignEnabled: true,
  });

  // Fetch role assignments
  const { data: assignments, isLoading } = useQuery<RoleAssignment[]>({
    queryKey: ['role-assignments'],
    queryFn: async () => {
      const response = await fetch('/api/role-assignments');
      if (!response.ok) throw new Error('Failed to fetch role assignments');
      return response.json();
    },
  });

  // Fetch users for dropdown
  const { data: users } = useQuery<SystemUser[]>({
    queryKey: ['users-list'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<RoleAssignment> }) => {
      const response = await fetch(`/api/role-assignments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update role assignment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-assignments'] });
      toast({ title: 'Role updated', description: 'Assignment saved successfully.' });
      setEditingRole(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof newRoleData) => {
      const response = await fetch('/api/role-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          defaultUserId: data.defaultUserId ? parseInt(data.defaultUserId) : null,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create role');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-assignments'] });
      toast({ title: 'Role created', description: 'New role assignment added.' });
      setShowAddDialog(false);
      setNewRoleData({
        roleName: '',
        displayName: '',
        officeName: '',
        officeEmail: '',
        defaultUserId: '',
        defaultEmail: '',
        defaultName: '',
        category: '',
        description: '',
        autoAssignEnabled: true,
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/role-assignments/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete role');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-assignments'] });
      toast({ title: 'Role deleted', description: 'Role assignment removed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Toggle auto-assign
  const toggleAutoAssign = (role: RoleAssignment) => {
    updateMutation.mutate({
      id: role.id,
      data: { autoAssignEnabled: !role.autoAssignEnabled },
    });
  };

  // Open edit dialog
  const openEditDialog = (role: RoleAssignment) => {
    setEditingRole(role);
    setFormData({
      officeName: role.officeName || '',
      officeEmail: role.officeEmail || '',
      defaultUserId: role.defaultUserId?.toString() || '',
      defaultEmail: role.defaultEmail || '',
      defaultName: role.defaultName || '',
      backupUserId: role.backupUserId?.toString() || '',
      backupEmail: role.backupEmail || '',
      category: role.category || '',
      description: role.description || '',
      autoAssignEnabled: role.autoAssignEnabled,
    });
  };

  // Save edit
  const saveEdit = () => {
    if (!editingRole) return;
    updateMutation.mutate({
      id: editingRole.id,
      data: {
        officeName: formData.officeName || null,
        officeEmail: formData.officeEmail || null,
        defaultUserId: formData.defaultUserId ? parseInt(formData.defaultUserId) : null,
        defaultEmail: formData.defaultEmail || null,
        defaultName: formData.defaultName || null,
        backupUserId: formData.backupUserId ? parseInt(formData.backupUserId) : null,
        backupEmail: formData.backupEmail || null,
        category: formData.category || null,
        description: formData.description || null,
        autoAssignEnabled: formData.autoAssignEnabled,
      },
    });
  };

  // Export tasks for a role as CSV download
  const exportRoleTasks = async (roleName: string) => {
    try {
      const response = await fetch(`/api/role-assignments/${encodeURIComponent(roleName)}/export-tasks`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${roleName.toLowerCase().replace(/\s+/g, '-')}-tasks.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Export complete', description: `Downloaded tasks for ${roleName}.` });
    } catch (error) {
      toast({ title: 'Export failed', description: String(error), variant: 'destructive' });
    }
  };

  // Get unique categories
  const categories = Array.from(new Set(assignments?.map(a => a.category).filter(Boolean) || []));

  // Filter assignments
  const filteredAssignments = filterCategory === 'all' 
    ? assignments 
    : assignments?.filter(a => a.category === filterCategory);

  // Get user display name
  const getUserName = (user: SystemUser | null) => {
    if (!user) return null;
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Role Assignments
            </CardTitle>
            <CardDescription>
              Map suggested roles to default assignees. Tasks with these roles will auto-assign to the configured person.
            </CardDescription>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Role
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filter */}
        <div className="flex items-center gap-4 mb-4">
          <Label>Filter by Category:</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
            <div className="text-2xl font-bold">{assignments?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Total Roles</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">
              {assignments?.filter(a => a.defaultUserId || a.defaultEmail).length || 0}
            </div>
            <div className="text-sm text-muted-foreground">Assigned</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
            <div className="text-2xl font-bold text-amber-600">
              {assignments?.filter(a => !a.defaultUserId && !a.defaultEmail).length || 0}
            </div>
            <div className="text-sm text-muted-foreground">Unassigned</div>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Canonical Office</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>DRI (Attestation Signer)</TableHead>
                <TableHead className="text-center">Auto-Assign</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments?.map(role => (
                <TableRow key={role.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{role.roleName}</div>
                      {role.displayName && role.displayName !== role.roleName && (
                        <div className="text-sm text-muted-foreground">{role.displayName}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(role.officeName || role.officeEmail) ? (
                      <div>
                        {role.officeName && <div className="font-medium text-sm">{role.officeName}</div>}
                        {role.officeEmail && <div className="text-xs text-muted-foreground">{role.officeEmail}</div>}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {role.category && (
                      <Badge variant="outline">{role.category}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {role.defaultUser ? (
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-slate-400" />
                        <div>
                          <div className="font-medium">{getUserName(role.defaultUser)}</div>
                          <div className="text-sm text-muted-foreground">{role.defaultUser.email}</div>
                        </div>
                      </div>
                    ) : role.defaultEmail ? (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <div>
                          <div className="font-medium">{role.defaultName || 'External'}</div>
                          <div className="text-sm text-muted-foreground">{role.defaultEmail}</div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        Not assigned
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={role.autoAssignEnabled}
                      onCheckedChange={() => toggleAutoAssign(role)}
                      disabled={updateMutation.isPending}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Export tasks for ${role.roleName}`}
                        title="Export tasks spreadsheet"
                        onClick={() => exportRoleTasks(role.roleName)}
                      >
                        <Download className="h-4 w-4 text-indigo-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit role ${role.roleName}`}
                        onClick={() => openEditDialog(role)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete role ${role.roleName}`}
                        onClick={() => deleteMutation.mutate(role.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!filteredAssignments || filteredAssignments.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No role assignments found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Role Assignment</DialogTitle>
            <DialogDescription>
              Configure who should receive tasks assigned to <strong>{editingRole?.roleName}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-office-name">Canonical Office Name</Label>
                <Input
                  id="edit-office-name"
                  value={formData.officeName}
                  onChange={(e) => setFormData(prev => ({ ...prev, officeName: e.target.value }))}
                  placeholder="e.g., Office of General Counsel"
                />
              </div>
              <div>
                <Label htmlFor="edit-office-email">Canonical Office Email</Label>
                <Input
                  id="edit-office-email"
                  value={formData.officeEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, officeEmail: e.target.value }))}
                  placeholder="e.g., counsel@institution.edu"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              The canonical office is the institutional contact for this role. The DRI below signs attestations.
            </p>

            <Separator />

            <div>
              <Label>DRI — Assign to User (from system)</Label>
              <Select
                value={formData.defaultUserId || "_none_"}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  defaultUserId: value === "_none_" ? "" : value,
                  defaultEmail: value && value !== "_none_" ? '' : prev.defaultEmail, // Clear external email if user selected
                  defaultName: value && value !== "_none_" ? '' : prev.defaultName,
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">-- None --</SelectItem>
                  {users?.map(user => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {getUserName(user)} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or external email</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role-external-email">External Email</Label>
                <Input
                  id="role-external-email"
                  value={formData.defaultEmail}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    defaultEmail: e.target.value,
                    defaultUserId: e.target.value ? '' : prev.defaultUserId, // Clear user if email entered
                  }))}
                  placeholder="external@example.edu"
                  disabled={!!formData.defaultUserId}
                />
              </div>
              <div>
                <Label htmlFor="role-external-name">Name</Label>
                <Input
                  id="role-external-name"
                  value={formData.defaultName}
                  onChange={(e) => setFormData(prev => ({ ...prev, defaultName: e.target.value }))}
                  placeholder="John Doe"
                  disabled={!!formData.defaultUserId}
                />
              </div>
            </div>

            <Separator />

            <div>
              <Label htmlFor="role-category">Category</Label>
              <Input
                id="role-category"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="e.g., Academic, Safety, HR"
              />
            </div>

            <div>
              <Label htmlFor="role-description">Description</Label>
              <Input
                id="role-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Role responsibilities..."
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Auto-assign enabled</Label>
              <Switch
                checked={formData.autoAssignEnabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoAssignEnabled: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRole(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Role</DialogTitle>
            <DialogDescription>
              Create a new role assignment for automatic task assignment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Role Name *</Label>
              <Input
                value={newRoleData.roleName}
                onChange={(e) => setNewRoleData(prev => ({ ...prev, roleName: e.target.value }))}
                placeholder="e.g., Registrar, Title IX Coordinator"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Must match the suggested role name from EdSteward
              </p>
            </div>

            <div>
              <Label>Display Name</Label>
              <Input
                value={newRoleData.displayName}
                onChange={(e) => setNewRoleData(prev => ({ ...prev, displayName: e.target.value }))}
                placeholder="e.g., Office of the Registrar"
              />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Canonical Office Name</Label>
                <Input
                  value={newRoleData.officeName}
                  onChange={(e) => setNewRoleData(prev => ({ ...prev, officeName: e.target.value }))}
                  placeholder="e.g., Office of General Counsel"
                />
              </div>
              <div>
                <Label>Canonical Office Email</Label>
                <Input
                  value={newRoleData.officeEmail}
                  onChange={(e) => setNewRoleData(prev => ({ ...prev, officeEmail: e.target.value }))}
                  placeholder="e.g., counsel@institution.edu"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              The canonical office is the institutional contact. The DRI below signs attestations.
            </p>

            <Separator />

            <div>
              <Label>DRI — Assign to User</Label>
              <Select
                value={newRoleData.defaultUserId || "_none_"}
                onValueChange={(value) => setNewRoleData(prev => ({ 
                  ...prev, 
                  defaultUserId: value === "_none_" ? "" : value,
                  defaultEmail: value && value !== "_none_" ? '' : prev.defaultEmail,
                  defaultName: value && value !== "_none_" ? '' : prev.defaultName,
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">-- None --</SelectItem>
                  {users?.map(user => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {getUserName(user)} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>External Email</Label>
                <Input
                  value={newRoleData.defaultEmail}
                  onChange={(e) => setNewRoleData(prev => ({ ...prev, defaultEmail: e.target.value }))}
                  placeholder="external@example.edu"
                  disabled={!!newRoleData.defaultUserId}
                />
              </div>
              <div>
                <Label>External Name</Label>
                <Input
                  value={newRoleData.defaultName}
                  onChange={(e) => setNewRoleData(prev => ({ ...prev, defaultName: e.target.value }))}
                  placeholder="Name"
                  disabled={!!newRoleData.defaultUserId}
                />
              </div>
            </div>

            <div>
              <Label>Category</Label>
              <Input
                value={newRoleData.category}
                onChange={(e) => setNewRoleData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="e.g., Academic, Safety, HR"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Auto-assign enabled</Label>
              <Switch
                checked={newRoleData.autoAssignEnabled}
                onCheckedChange={(checked) => setNewRoleData(prev => ({ ...prev, autoAssignEnabled: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button 
              onClick={() => createMutation.mutate(newRoleData)} 
              disabled={!newRoleData.roleName || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
