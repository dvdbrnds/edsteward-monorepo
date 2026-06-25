/**
 * Role Assignments Settings
 * 
 * Allows admins to map canonical compliance roles to default DRIs.
 * Tasks with these roles will auto-assign to the configured person.
 * Includes role explanations (group, aliases) inline.
 */

import React, { useState, useMemo } from 'react';
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
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

const CANONICAL_ROLE_ALIASES: Record<string, string[]> = {
  "Compliance Officer": ["compliance", "institutional compliance officer", "director of compliance", "compliance reporting manager"],
  "General Counsel": ["legal counsel", "legal", "university counsel"],
  "CFO": ["chief financial officer", "controller", "accounting manager"],
  "HR Director": ["human resources director", "hr", "benefits manager", "payroll manager"],
  "Title IX Coordinator": ["title ix coordinator / general counsel", "hr/title ix"],
  "Clery Compliance Officer": [],
  "Financial Aid Director": ["financial aid officer", "student financial services director", "student accounts manager"],
  "IT Security Officer": ["ciso", "chief information security officer", "data protection officer", "it security manager"],
  "Campus Police Chief": ["campus safety director", "public safety director", "security director"],
  "Registrar": ["records manager"],
  "VP Academic Affairs": ["provost", "chief academic officer", "academic affairs dean"],
  "VP Student Affairs": ["chief student affairs officer", "vice president for student affairs"],
  "Dean of Students": ["student life director", "student conduct officer", "housing director"],
  "Privacy Officer": ["chief privacy officer"],
  "President": ["president/chancellor", "senior administration"],
  "Disability Services Coordinator": ["disability services director", "ada coordinator", "section 504 coordinator"],
  "Emergency Management Director": ["emergency response coordinator"],
  "Facilities Director": ["facilities", "ehs director", "environmental health and safety director"],
  "Environmental Compliance Officer": ["environmental compliance manager"],
  "Fire Safety Officer": ["safety officer"],
  "Export Control Officer": ["ofac compliance officer"],
  "Research Compliance Officer": ["research integrity officer", "vice president for research"],
  "Training Coordinator": ["training director"],
  "Procurement Director": ["procurement manager", "procurement officer"],
  "Internal Auditor": ["quality assurance manager", "risk management officer"],
  "International Programs Director": [],
  "Institutional Research Director": ["institutional research", "assessment coordinator"],
  "Library Director": [],
  "Ethics Officer": [],
  "Communications Director": ["communications", "web services"],
  "Government Relations": [],
  "Board Compensation Committee": [],
  "Technology Transfer Officer": ["patent attorney", "grants administrator"],
  "Title VI Coordinator": ["chief diversity officer"],
  "Admissions Director": [],
  "Curriculum Coordinator": ["teacher preparation program director"],
};

const GROUP_COLORS: Record<string, string> = {
  "Compliance": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  "Legal": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  "Finance": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Human Resources": "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
  "Civil Rights": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  "Campus Safety": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  "Enrollment & Financial Aid": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  "Information Technology": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  "Academic Records": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  "Academic Affairs": "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  "Student Affairs": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  "Student Services": "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400",
  "Executive": "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
  "Operations": "bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-400",
  "Research & Compliance": "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400",
  "Communications": "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
  "External Affairs": "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-400",
  "Governance": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

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
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRoles, setExpandedRoles] = useState<Set<number>>(new Set());
  
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

  // Filter assignments by category and search
  const filteredAssignments = useMemo(() => {
    let result = assignments || [];
    if (filterCategory !== 'all') {
      result = result.filter(a => a.category === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.roleName.toLowerCase().includes(q) ||
        (a.category || '').toLowerCase().includes(q) ||
        (CANONICAL_ROLE_ALIASES[a.roleName] || []).some(alias => alias.toLowerCase().includes(q))
      );
    }
    return result;
  }, [assignments, filterCategory, searchQuery]);

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
              {assignments?.length || 0} canonical roles map statutory responsibilities to real people at your institution.
              Assign a DRI to each role and tasks auto-route to the right person.
            </CardDescription>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Role
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Explanation */}
        <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4 mb-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Regulations use hundreds of different titles for the same person (e.g. "CISO", "IT Security Manager",
            "Chief Information Security Officer"). EdSteward normalizes these into <strong>{assignments?.length || 36} canonical roles</strong>.
            Assign each role once below, and every compliance task referencing any variant of that title automatically
            routes to the correct DRI. Click the arrow next to any role to see which titles it consolidates.
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Input
              placeholder="Search roles or aliases..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
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
                <TableHead className="w-8"></TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>DRI (Attestation Signer)</TableHead>
                <TableHead className="text-center">Auto-Assign</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments?.map(role => {
                const aliases = CANONICAL_ROLE_ALIASES[role.roleName] || [];
                const colorClass = GROUP_COLORS[role.category || ''] || 'bg-gray-100 text-gray-800';
                const isExpanded = expandedRoles.has(role.id);
                const toggleExpand = () => {
                  setExpandedRoles(prev => {
                    const next = new Set(prev);
                    if (next.has(role.id)) next.delete(role.id);
                    else next.add(role.id);
                    return next;
                  });
                };
                return (
                <React.Fragment key={role.id}>
                <TableRow className={isExpanded ? 'border-b-0' : ''}>
                  <TableCell className="w-8 pr-0">
                    {aliases.length > 0 ? (
                      <button
                        onClick={toggleExpand}
                        className="p-1 rounded hover:bg-muted transition-colors"
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} aliases for ${role.roleName}`}
                      >
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        }
                      </button>
                    ) : (
                      <span className="inline-block w-6" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{role.roleName}</div>
                      {role.officeName && (
                        <div className="text-xs text-muted-foreground">{role.officeName}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {role.category && (
                      <Badge variant="outline" className={colorClass + ' text-[11px]'}>{role.category}</Badge>
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
                {isExpanded && aliases.length > 0 && (
                  <TableRow className="bg-muted/30 hover:bg-muted/40">
                    <TableCell colSpan={6} className="py-2 pl-12">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Consolidated titles ({aliases.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {aliases.map(alias => (
                            <span
                              key={alias}
                              className="text-xs bg-background border px-2 py-0.5 rounded text-muted-foreground"
                            >
                              {alias}
                            </span>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </React.Fragment>
                );
              })}
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
