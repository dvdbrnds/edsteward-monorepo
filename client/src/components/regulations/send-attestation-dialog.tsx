/**
 * Send Attestation Request Dialog
 * 
 * Allows admins to send one-click email attestation requests
 * to field compliance officers for low-risk regulations.
 */

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Mail,
  Send,
  AlertTriangle,
  Loader2,
  Calendar,
  Shield,
  Info,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface User {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

interface SendAttestationDialogProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  regulationId: number;
  regulationName: string;
  riskLevel?: string;
  assignedUserId?: number;
  responsibleOffice?: string;
  responsibleOfficeEmail?: string;
}

const ATTESTATION_TYPES = [
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
  { value: 'incident', label: 'Incident Response' },
  { value: 'ad_hoc', label: 'Ad-hoc Request' },
];

const CURRENT_PERIOD_OPTIONS = [
  { value: 'Q1 2025', label: 'Q1 2025' },
  { value: 'Q2 2025', label: 'Q2 2025' },
  { value: 'Q3 2025', label: 'Q3 2025' },
  { value: 'Q4 2025', label: 'Q4 2025' },
  { value: 'Annual 2025', label: 'Annual 2025' },
  { value: 'Annual 2026', label: 'Annual 2026' },
];

export function SendAttestationDialog({
  open,
  onOpenChange,
  regulationId,
  regulationName,
  riskLevel = 'medium',
  assignedUserId,
  responsibleOffice,
  responsibleOfficeEmail,
}: SendAttestationDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(assignedUserId || null);
  const [manualEmail, setManualEmail] = useState('');
  const [useManualEmail, setUseManualEmail] = useState(false);
  const [attestationType, setAttestationType] = useState('annual');
  const [attestationPeriod, setAttestationPeriod] = useState('Annual 2025');
  const [attestationStatement, setAttestationStatement] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Fetch users for the dropdown
  const { data: usersData } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
    enabled: open,
  });

  // Set default statement based on regulation
  useEffect(() => {
    if (open && !attestationStatement) {
      setAttestationStatement(
        `I, as the Directly Responsible Individual (DRI) for the ${regulationName} regulation, confirm that the institution is in compliance with all requirements.\n\n` +
        `Specifically, I attest that:\n` +
        `• All required policies and procedures are in place\n` +
        `• Staff have received required training\n` +
        `• Required notices and disclosures have been published\n` +
        `• All documentation is current and accessible`
      );
    }
  }, [open, regulationName, responsibleOffice, attestationStatement]);

  // Reset form and set default user when dialog opens
  useEffect(() => {
    if (open && usersData) {
      // Priority: 1) assignedUserId, 2) user matching responsibleOfficeEmail, 3) null
      if (assignedUserId) {
        setSelectedUserId(assignedUserId);
        setUseManualEmail(false);
      } else if (responsibleOfficeEmail) {
        const matchingUser = usersData.find(u => 
          u.email?.toLowerCase() === responsibleOfficeEmail.toLowerCase()
        );
        if (matchingUser) {
          setSelectedUserId(matchingUser.id);
          setUseManualEmail(false);
        } else {
          // No matching user - use manual email with the responsible office email
          setManualEmail(responsibleOfficeEmail);
          setUseManualEmail(true);
          setSelectedUserId(null);
        }
      } else {
        setSelectedUserId(null);
      }
    }
  }, [open, assignedUserId, responsibleOfficeEmail, usersData]);

  // Send attestation mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/attestation/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          regulationId,
          userId: useManualEmail ? null : selectedUserId,
          email: useManualEmail ? manualEmail : undefined,
          attestationType,
          attestationPeriod,
          attestationStatement,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send attestation request');
      }
      return response.json();
    },
    onSuccess: () => {
      const recipientEmail = useManualEmail ? manualEmail : selectedUser?.email;
      toast({
        title: 'Attestation Request Sent',
        description: `Email sent to ${recipientEmail}. Token expires in 14 days.`,
      });
      onOpenChange(false);
      // Reset form
      setAttestationStatement('');
      setShowPreview(false);
      setManualEmail('');
      setUseManualEmail(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Send',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const selectedUser = usersData?.find(u => u.id === selectedUserId);
  const isHighRisk = riskLevel === 'high' || riskLevel === 'critical';

  // Show all users with emails - prioritize compliance officers and admins
  const eligibleUsers = (usersData || [])
    .filter(u => u.email) // Must have email
    .sort((a, b) => {
      // Sort compliance officers and admins first
      const priority = (role: string) => {
        if (role === 'compliance_officer') return 0;
        if (role === 'admin') return 1;
        if (role === 'department_head') return 2;
        return 3;
      };
      return priority(a.role) - priority(b.role);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            Send Attestation Request
          </DialogTitle>
          <DialogDescription>
            Send a one-click email attestation request to the field compliance officer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Risk Level Warning */}
          {isHighRisk && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>High-Risk Regulation</AlertTitle>
              <AlertDescription>
                Email attestation is not recommended for high-risk regulations. 
                Consider requiring the officer to log in and complete a full attestation.
              </AlertDescription>
            </Alert>
          )}

          {/* Regulation Info */}
          <div className="bg-slate-50 rounded-lg p-4 border">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">{regulationName}</h4>
                <p className="text-sm text-muted-foreground">Regulation ID: {regulationId}</p>
              </div>
              <Badge variant={
                riskLevel === 'low' ? 'default' :
                riskLevel === 'high' ? 'destructive' :
                riskLevel === 'critical' ? 'destructive' :
                'secondary'
              }>
                {riskLevel} risk
              </Badge>
            </div>
            {responsibleOffice && (
              <p className="text-sm mt-2">
                <span className="text-muted-foreground">Responsible Office:</span>{' '}
                <span className="font-medium">{responsibleOffice}</span>
              </p>
            )}
          </div>

          {/* Recipient Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Send To
              </Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="manual-email"
                  checked={useManualEmail}
                  onCheckedChange={(checked) => {
                    setUseManualEmail(checked === true);
                    if (checked) setSelectedUserId(null);
                  }}
                />
                <label htmlFor="manual-email" className="text-xs text-muted-foreground cursor-pointer">
                  Enter email manually
                </label>
              </div>
            </div>
            
            {useManualEmail ? (
              <Input
                type="email"
                placeholder="Enter email address..."
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
              />
            ) : (
              <Select
                value={selectedUserId?.toString() || ''}
                onValueChange={(value) => setSelectedUserId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a field officer..." />
                </SelectTrigger>
                <SelectContent>
                  {eligibleUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{user.firstName || user.username} {user.lastName || ''}</span>
                        <span className="text-muted-foreground text-xs">({user.email})</span>
                        <Badge variant="outline" className="text-xs ml-auto">
                          {user.role}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {(selectedUser || (useManualEmail && manualEmail)) && (
              <p className="text-sm text-muted-foreground">
                Email will be sent to: <span className="font-medium">{useManualEmail ? manualEmail : selectedUser?.email}</span>
              </p>
            )}
          </div>

          {/* Attestation Type & Period */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Attestation Type
              </Label>
              <Select value={attestationType} onValueChange={setAttestationType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTESTATION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Attestation Period
              </Label>
              <Select value={attestationPeriod} onValueChange={setAttestationPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENT_PERIOD_OPTIONS.map((period) => (
                    <SelectItem key={period.value} value={period.value}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Attestation Statement */}
          <div className="space-y-2">
            <Label>Attestation Statement</Label>
            <Textarea
              value={attestationStatement}
              onChange={(e) => setAttestationStatement(e.target.value)}
              placeholder="What is the officer attesting to?"
              rows={6}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              This is what the field officer will see and acknowledge before confirming.
            </p>
          </div>

          {/* Email Preview Toggle */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="preview"
              checked={showPreview}
              onCheckedChange={(checked) => setShowPreview(checked === true)}
            />
            <label htmlFor="preview" className="text-sm cursor-pointer">
              Show email preview
            </label>
          </div>

          {/* Email Preview */}
          {showPreview && (selectedUser || (useManualEmail && manualEmail)) && (
            <div className="bg-white border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm border-b pb-2">
                <span className="font-medium">To:</span>
                <span>{useManualEmail ? manualEmail : selectedUser?.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm border-b pb-2">
                <span className="font-medium">Subject:</span>
                <span>Action Required: {regulationName} Compliance Attestation</span>
              </div>
              <div className="text-sm whitespace-pre-wrap text-slate-700 bg-slate-50 p-3 rounded">
                Dear {useManualEmail ? manualEmail.split('@')[0] : (selectedUser?.firstName || selectedUser?.email?.split('@')[0])},

                You are receiving this email because you are the designated Directly Responsible Individual (DRI) for the following regulation:

                REGULATION: {regulationName}
                PERIOD: {attestationPeriod}

                ATTESTATION REQUIRED:
                {attestationStatement}

                ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                [CONFIRM COMPLIANCE BUTTON]

                This link will expire in 14 days.
              </div>
            </div>
          )}

          {/* Info Note */}
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700 text-sm">
              The recipient will receive an email with a secure link. Clicking the link takes them 
              to a confirmation page where they acknowledge the attestation statement and confirm 
              compliance. No login is required - the link itself serves as authentication.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={
              (!useManualEmail && !selectedUserId) || 
              (useManualEmail && !manualEmail.trim()) || 
              !attestationStatement.trim() || 
              sendMutation.isPending
            }
            className="gap-2"
          >
            {sendMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Attestation Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


