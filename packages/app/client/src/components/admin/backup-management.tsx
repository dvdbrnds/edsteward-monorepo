/**
 * Backup Management Component
 * 
 * Provides UI for:
 * - Viewing backup status and schedule
 * - Creating manual backups
 * - Listing all backups
 * - Restoring from backups
 * - Downloading backup files
 * - Deleting backups
 */

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Database, 
  Download, 
  Trash2, 
  RefreshCw, 
  Clock, 
  Calendar,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Upload,
  RotateCcw,
  Shield,
  Loader2,
  ShieldCheck,
  XCircle
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';

interface Backup {
  id: string;
  filename: string;
  type: 'daily' | 'weekly' | 'monthly' | 'manual';
  createdAt: string;
  size: number;
  sizeFormatted: string;
  tables: number;
  status: 'completed' | 'failed' | 'in_progress';
  duration?: number;
  error?: string;
}

interface BackupStatus {
  enabled: boolean;
  pgDumpAvailable: boolean;
  lastBackup: Backup | null;
  nextDaily: string;
  nextWeekly: string;
  nextMonthly: string;
  totalBackups: number;
  totalSize: string;
}

const typeColors: Record<string, string> = {
  daily: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  weekly: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  monthly: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  manual: 'bg-gray-100 text-foreground dark:bg-gray-900 dark:text-gray-200',
};

const statusColors: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
};

type RestorePhase = 'confirm' | 'running' | 'success' | 'error';

export function BackupManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [restorePhase, setRestorePhase] = useState<RestorePhase>('confirm');
  const [restoreError, setRestoreError] = useState<string>('');
  const [restoreElapsed, setRestoreElapsed] = useState(0);
  const restoreTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    return () => { if (restoreTimer.current) clearInterval(restoreTimer.current); };
  }, []);

  const startRestoreTimer = () => {
    setRestoreElapsed(0);
    restoreTimer.current = setInterval(() => setRestoreElapsed(s => s + 1), 1000);
  };
  const stopRestoreTimer = () => {
    if (restoreTimer.current) { clearInterval(restoreTimer.current); restoreTimer.current = null; }
  };

  const closeRestoreDialog = () => {
    if (restorePhase === 'running') return;
    setRestoreId(null);
    setRestorePhase('confirm');
    setRestoreError('');
    setRestoreElapsed(0);
    stopRestoreTimer();
  };

  // Fetch backup status
  const { data: statusData, isLoading: statusLoading } = useQuery<{ success: boolean; status: BackupStatus }>({
    queryKey: ['backup-status'],
    queryFn: () => apiRequest('GET', '/api/backups/status'),
    refetchInterval: 60000,
  });

  // Fetch backup list
  const { data: backupsData, isLoading: backupsLoading, refetch: refetchBackups } = useQuery<{ success: boolean; backups: Backup[] }>({
    queryKey: ['backups'],
    queryFn: () => apiRequest('GET', '/api/backups'),
  });

  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/backups'),
    onSuccess: () => {
      toast({
        title: 'Backup Created',
        description: 'Manual backup has been created successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backup-status'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Backup Failed',
        description: error.message || 'Failed to create backup.',
        variant: 'destructive',
      });
    },
  });

  // Restore backup mutation
  const restoreBackupMutation = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/backups/${id}/restore`),
    onSuccess: () => {
      stopRestoreTimer();
      setRestorePhase('success');
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backup-status'] });
    },
    onError: (error: Error) => {
      stopRestoreTimer();
      setRestoreError(error.message || 'Failed to restore backup.');
      setRestorePhase('error');
    },
  });

  const handleRestoreConfirm = (backupId: string) => {
    setRestorePhase('running');
    startRestoreTimer();
    restoreBackupMutation.mutate(backupId);
  };

  // Delete backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/backups/${id}`),
    onSuccess: () => {
      toast({
        title: 'Backup Deleted',
        description: 'Backup has been deleted successfully.',
      });
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backup-status'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete backup.',
        variant: 'destructive',
      });
      setDeleteId(null);
    },
  });

  const handleDownload = (backup: Backup) => {
    window.open(`/api/backups/${backup.id}/download`, '_blank');
  };

  const status = statusData?.status;
  const backups = backupsData?.backups || [];

  return (
    <div className="space-y-6">
      {/* Warning if pg_dump not available */}
      {status && !status.pgDumpAvailable && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">PostgreSQL Tools Not Found</p>
              <p className="text-sm text-amber-700">
                Install PostgreSQL client tools (pg_dump, psql) to enable backup functionality.
                For Docker deployments, ensure the postgresql-client package is installed.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduler Status</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.enabled ? (
                <span className="text-green-600">Active</span>
              ) : (
                <span className="text-yellow-600">Disabled</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {status?.enabled ? 'Automatic backups enabled' : 'Manual backups only'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Backups</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.totalBackups || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total size: {status?.totalSize || '0 B'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Backup</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.lastBackup 
                ? formatDistanceToNow(new Date(status.lastBackup.createdAt), { addSuffix: true })
                : 'Never'}
            </div>
            <p className="text-xs text-muted-foreground">
              {status?.lastBackup?.sizeFormatted || 'No backups yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Daily</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.nextDaily 
                ? format(new Date(status.nextDaily), 'h:mm a')
                : '2:00 AM'}
            </div>
            <p className="text-xs text-muted-foreground">
              {status?.nextDaily 
                ? format(new Date(status.nextDaily), 'MMM d, yyyy')
                : 'Not scheduled'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Backup Schedule
          </CardTitle>
          <CardDescription>
            Automatic backup retention policy for on-premises installations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold">Daily Backups</h4>
                <p className="text-sm text-muted-foreground">Every day at 2:00 AM</p>
                <p className="text-sm text-muted-foreground">Retained for 7 days</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold">Weekly Backups</h4>
                <p className="text-sm text-muted-foreground">Every Sunday at 3:00 AM</p>
                <p className="text-sm text-muted-foreground">Retained for 4 weeks</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <div className="p-2 bg-green-100 rounded-lg">
                <HardDrive className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold">Monthly Backups</h4>
                <p className="text-sm text-muted-foreground">1st of month at 4:00 AM</p>
                <p className="text-sm text-muted-foreground">Retained for 12 months</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions & Backup List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Backup History
              </CardTitle>
              <CardDescription>
                View, download, restore, or delete database backups
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetchBackups()}
                disabled={backupsLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${backupsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button 
                size="sm"
                onClick={() => createBackupMutation.mutate()}
                disabled={createBackupMutation.isPending}
              >
                {createBackupMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Create Backup
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {backupsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading backups...</span>
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No backups found</p>
              <p className="text-sm">Create your first backup using the button above</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {format(new Date(backup.createdAt), 'MMM d, yyyy')}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(backup.createdAt), 'h:mm:ss a')}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={typeColors[backup.type]}>
                        {backup.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{backup.sizeFormatted}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[backup.status]}>
                        {backup.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {backup.status === 'failed' && <AlertTriangle className="h-3 w-3 mr-1" />}
                        {backup.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {backup.duration ? `${(backup.duration / 1000).toFixed(1)}s` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(backup)}
                          title="Download backup"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        
                        {/* Restore Dialog */}
                        <AlertDialog open={restoreId === backup.id} onOpenChange={(open) => { if (!open) closeRestoreDialog(); }}>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setRestoreId(backup.id); setRestorePhase('confirm'); }}
                              title="Restore from this backup"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onEscapeKeyDown={(e) => { if (restorePhase === 'running') e.preventDefault(); }}>

                            {/* ── Confirm phase ── */}
                            {restorePhase === 'confirm' && (
                              <>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                                    <AlertTriangle className="h-5 w-5" />
                                    Restore Database?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription asChild>
                                    <div>
                                      <p>This will restore the database from <strong>{backup.filename}</strong>.</p>
                                      <p className="mt-2 text-red-600 font-semibold">
                                        All current data will be replaced with the backup data.
                                      </p>
                                      <p className="mt-2 text-muted-foreground text-xs">
                                        A safety backup is created automatically before the restore begins.
                                        If anything goes wrong, your data will be recovered automatically.
                                      </p>
                                    </div>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <Button
                                    onClick={() => handleRestoreConfirm(backup.id)}
                                    className="bg-amber-600 hover:bg-amber-700 text-white"
                                  >
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Restore Database
                                  </Button>
                                </AlertDialogFooter>
                              </>
                            )}

                            {/* ── Running phase ── */}
                            {restorePhase === 'running' && (
                              <div className="py-6 flex flex-col items-center gap-4 text-center">
                                <Loader2 className="h-10 w-10 animate-spin text-amber-600" />
                                <div>
                                  <p className="text-lg font-semibold">Restoring Database…</p>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {restoreElapsed < 10
                                      ? 'Creating safety backup…'
                                      : restoreElapsed < 25
                                        ? 'Applying backup data…'
                                        : 'Verifying restore…'}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                                    Elapsed: {restoreElapsed}s
                                  </p>
                                </div>
                                <p className="text-xs text-muted-foreground max-w-xs">
                                  Do not close this page. If the restore fails, your data will be recovered automatically.
                                </p>
                              </div>
                            )}

                            {/* ── Success phase ── */}
                            {restorePhase === 'success' && (
                              <>
                                <div className="py-6 flex flex-col items-center gap-4 text-center">
                                  <ShieldCheck className="h-10 w-10 text-green-600" />
                                  <div>
                                    <p className="text-lg font-semibold text-green-700">Restore Complete</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      Database restored from {backup.filename} in {restoreElapsed}s.
                                    </p>
                                  </div>
                                </div>
                                <AlertDialogFooter>
                                  <Button onClick={() => { closeRestoreDialog(); window.location.reload(); }}>
                                    Refresh Page
                                  </Button>
                                </AlertDialogFooter>
                              </>
                            )}

                            {/* ── Error phase ── */}
                            {restorePhase === 'error' && (
                              <>
                                <div className="py-6 flex flex-col items-center gap-4 text-center">
                                  <XCircle className="h-10 w-10 text-red-600" />
                                  <div>
                                    <p className="text-lg font-semibold text-red-700">Restore Failed</p>
                                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                                      {restoreError}
                                    </p>
                                  </div>
                                </div>
                                <AlertDialogFooter>
                                  <Button variant="outline" onClick={closeRestoreDialog}>
                                    Close
                                  </Button>
                                </AlertDialogFooter>
                              </>
                            )}

                          </AlertDialogContent>
                        </AlertDialog>

                        {/* Delete Dialog */}
                        <AlertDialog open={deleteId === backup.id} onOpenChange={(open) => !open && setDeleteId(null)}>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteId(backup.id)}
                              title="Delete backup"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Backup?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete <strong>{backup.filename}</strong>?
                                <br />
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteBackupMutation.mutate(backup.id)}
                                className="bg-red-600 hover:bg-red-700"
                                disabled={deleteBackupMutation.isPending}
                              >
                                {deleteBackupMutation.isPending ? (
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 mr-2" />
                                )}
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default BackupManagement;

