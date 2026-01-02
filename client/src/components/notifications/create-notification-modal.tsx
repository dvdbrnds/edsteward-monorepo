import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, X, AlertTriangle, Info, CheckCircle, Users, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
  department?: string;
}

interface Regulation {
  id: number;
  name: string;
  category: string;
}

interface CreateNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateNotificationModal({ isOpen, onClose }: CreateNotificationModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    type: 'manual_notification',
    title: '',
    message: '',
    priority: 'normal' as 'high' | 'normal' | 'low',
    recipients: [] as number[],
    regulationId: null as number | null,
    sendImmediately: true
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch users for recipient selection (admin only)
  const { data: users = [], error: usersError, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: isOpen,
    retry: false // Don't retry if access is denied
  });

  // Fetch regulations for optional linking
  const { data: regulations = [] } = useQuery<Regulation[]>({
    queryKey: ['/api/regulations'],
    enabled: isOpen
  });

  const createNotificationMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/notification-history/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send notification');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notification-history'] });
      onClose();
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      type: 'manual_notification',
      title: '',
      message: '',
      priority: 'normal',
      recipients: [],
      regulationId: null,
      sendImmediately: true
    });
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    }
    
    if (formData.recipients.length === 0) {
      newErrors.recipients = 'At least one recipient is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    createNotificationMutation.mutate(formData);
  };

  const handleRecipientToggle = (userId: number) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.includes(userId)
        ? prev.recipients.filter(id => id !== userId)
        : [...prev.recipients, userId]
    }));
  };

  const selectAllUsers = () => {
    setFormData(prev => ({
      ...prev,
      recipients: users.map(u => u.id)
    }));
  };

  const clearAllUsers = () => {
    setFormData(prev => ({
      ...prev,
      recipients: []
    }));
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'normal': return <Info className="h-4 w-4 text-blue-500" />;
      case 'low': return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
      default: return null;
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case 'manual_notification': return 'Manual Notification';
      case 'test_notification': return 'Test Notification';
      case 'system_alert': return 'System Alert';
      case 'compliance_reminder': return 'Compliance Reminder';
      default: return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-500" />
            Create New Notification
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Notification Type and Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Notification Type</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual_notification">Manual Notification</SelectItem>
                  <SelectItem value="test_notification">Test Notification</SelectItem>
                  <SelectItem value="system_alert">System Alert</SelectItem>
                  <SelectItem value="compliance_reminder">Compliance Reminder</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select 
                value={formData.priority} 
                onValueChange={(value: 'high' | 'normal' | 'low') => setFormData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      High Priority
                    </div>
                  </SelectItem>
                  <SelectItem value="normal">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-500" />
                      Normal Priority
                    </div>
                  </SelectItem>
                  <SelectItem value="low">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                      Low Priority
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter notification title..."
              className={errors.title ? 'border-red-500' : ''}
            />
            {errors.title && <p className="text-sm text-red-500 mt-1">{errors.title}</p>}
          </div>

          {/* Message */}
          <div>
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Enter your notification message..."
              rows={4}
              className={errors.message ? 'border-red-500' : ''}
            />
            {errors.message && <p className="text-sm text-red-500 mt-1">{errors.message}</p>}
          </div>

          {/* Optional Regulation Link */}
          <div>
            <Label htmlFor="regulation">Link to Regulation (Optional)</Label>
              <Select 
                value={formData.regulationId?.toString() || 'none'} 
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  regulationId: value === 'none' ? null : parseInt(value) 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a regulation (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No regulation</SelectItem>
                {regulations.map((regulation) => (
                  <SelectItem key={regulation.id} value={regulation.id.toString()}>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="font-medium">{regulation.name}</p>
                        <p className="text-xs text-muted-foreground">{regulation.category}</p>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recipients */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Recipients * ({formData.recipients.length} selected)</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllUsers}
                  className="text-xs"
                >
                  <Users className="h-3 w-3 mr-1" />
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearAllUsers}
                  className="text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear All
                </Button>
              </div>
            </div>
            
            <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
              {usersLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p className="text-muted-foreground text-sm">Loading users...</p>
                </div>
              ) : usersError ? (
                <div className="text-center py-4">
                  <p className="text-red-600 text-sm mb-2">⚠️ Access Denied</p>
                  <p className="text-muted-foreground text-xs">
                    Only administrators can send notifications. Please contact your system administrator.
                  </p>
                </div>
              ) : users.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No users available</p>
              ) : (
                <div className="space-y-2">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={formData.recipients.includes(user.id)}
                        onCheckedChange={() => handleRecipientToggle(user.id)}
                      />
                      <label
                        htmlFor={`user-${user.id}`}
                        className="flex-1 cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        {user.role && (
                          <Badge variant="secondary" className="text-xs">
                            {user.role}
                          </Badge>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {errors.recipients && <p className="text-sm text-red-500 mt-1">{errors.recipients}</p>}
          </div>

          {/* Send Options */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="sendImmediately"
              checked={formData.sendImmediately}
              onCheckedChange={(checked) => setFormData(prev => ({ 
                ...prev, 
                sendImmediately: checked as boolean 
              }))}
            />
            <Label htmlFor="sendImmediately" className="text-sm">
              Send immediately (uncheck to save as draft)
            </Label>
          </div>

          {/* Preview */}
          <div className="bg-background border rounded-lg p-4">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              Preview
              {getPriorityIcon(formData.priority)}
            </h4>
            <div className="space-y-2 text-sm">
              <p><strong>Type:</strong> {getNotificationTypeLabel(formData.type)}</p>
              <p><strong>Title:</strong> {formData.title || 'No title'}</p>
              <p><strong>Message:</strong> {formData.message || 'No message'}</p>
              <p><strong>Recipients:</strong> {formData.recipients.length} user(s)</p>
              <p><strong>Priority:</strong> {formData.priority}</p>
              {formData.regulationId && (
                <p><strong>Regulation:</strong> {regulations.find(r => r.id === formData.regulationId)?.name}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={createNotificationMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createNotificationMutation.isPending || !!usersError}
              className="flex items-center gap-2"
            >
              {createNotificationMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {formData.sendImmediately ? 'Sending...' : 'Saving...'}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {formData.sendImmediately ? 'Send Notification' : 'Save as Draft'}
                </>
              )}
            </Button>
          </div>

          {/* Error Display */}
          {createNotificationMutation.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">
                <strong>Error:</strong> {createNotificationMutation.error.message}
              </p>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
