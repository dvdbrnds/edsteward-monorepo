import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  Send, 
  Building2, 
  User, 
  UserCog,
  XCircle,
  Clock,
  CheckCircle,
  FileWarning,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface RegulationAction {
  type: string;
  status: string;
  required: boolean;
  completedAt?: Date | string;
  completedBy?: {
    userId: number;
    username: string;
    fullName?: string;
  };
}

interface Deadline {
  id: number;
  dueDate: string;
  status: string;
}

interface EscalateIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regulation: {
    id: number;
    name?: string;
    topic?: string;
    responsibleOffice?: string;
    responsibleOfficeEmail?: string;
    escalationTarget?: string;
    escalationEmail?: string;
    ownerId?: number;
    actions?: RegulationAction[];
  };
  deadlines?: Deadline[];
  assignedUser?: {
    id: number;
    username: string;
    firstName?: string;
    lastName?: string;
  } | null;
}

const URGENCY_LEVELS = [
  { value: "normal", label: "Normal", color: "bg-blue-100 text-blue-800", description: "Standard review requested" },
  { value: "high", label: "High", color: "bg-yellow-100 text-yellow-800", description: "Prompt attention needed" },
  { value: "critical", label: "Critical", color: "bg-red-100 text-red-800", description: "Immediate action required" },
];

export function EscalateIssueDialog({
  open,
  onOpenChange,
  regulation,
  deadlines = [],
  assignedUser,
}: EscalateIssueDialogProps) {
  const [urgency, setUrgency] = useState("normal");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [ccFieldOffice, setCcFieldOffice] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  const regulationName = regulation.name || regulation.topic || "Unknown Regulation";
  
  // The field office (who should be managing this regulation)
  const fieldOffice = regulation.responsibleOffice || "Compliance Office";
  const fieldOfficeEmail = regulation.responsibleOfficeEmail || "compliance@university.edu";
  
  // The escalation target (supervisor/VP)
  const escalationTarget = regulation.escalationTarget || "VP of Administration";
  const escalationEmail = regulation.escalationEmail || "vp-administration@university.edu";

  // Calculate compliance issues
  const complianceIssues = useMemo(() => {
    const issues: { type: string; description: string; severity: 'critical' | 'warning' }[] = [];
    
    // Check required actions
    const requiredActions = regulation.actions?.filter(a => a.required) || [];
    const incompleteActions = requiredActions.filter(a => a.status !== 'completed');
    
    incompleteActions.forEach(action => {
      const actionName = action.type
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      if (action.type === 'attestation') {
        issues.push({
          type: 'Missing Attestation',
          description: `Required compliance attestation has not been completed`,
          severity: 'critical'
        });
      } else if (action.type === 'website_publish') {
        issues.push({
          type: 'Website Publication Pending',
          description: `Required website publication has not been completed`,
          severity: 'warning'
        });
      } else if (action.type === 'community_communication') {
        issues.push({
          type: 'Communication Pending',
          description: `Required community communication has not been sent`,
          severity: 'warning'
        });
      } else if (action.type === 'agency_submission') {
        issues.push({
          type: 'Agency Submission Pending',
          description: `Required agency submission has not been completed`,
          severity: 'critical'
        });
      } else {
        issues.push({
          type: `${actionName} Incomplete`,
          description: `Required action "${actionName}" has not been completed`,
          severity: 'warning'
        });
      }
    });
    
    // Check deadlines
    const regulationDeadlines = deadlines.filter(d => d.status !== 'completed');
    const overdueDeadlines = regulationDeadlines.filter(d => 
      d.status === 'overdue' || new Date(d.dueDate) < new Date()
    );
    const upcomingDeadlines = regulationDeadlines.filter(d => 
      d.status === 'pending' && new Date(d.dueDate) >= new Date()
    );
    
    overdueDeadlines.forEach(deadline => {
      issues.push({
        type: 'Overdue Deadline',
        description: `Deadline was due on ${format(new Date(deadline.dueDate), 'PPP')}`,
        severity: 'critical'
      });
    });
    
    upcomingDeadlines.forEach(deadline => {
      const daysUntil = Math.ceil((new Date(deadline.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 7) {
        issues.push({
          type: 'Imminent Deadline',
          description: `Deadline due in ${daysUntil} day${daysUntil === 1 ? '' : 's'} (${format(new Date(deadline.dueDate), 'PPP')})`,
          severity: 'warning'
        });
      }
    });
    
    return issues;
  }, [regulation.actions, deadlines]);

  // Auto-determine urgency based on issues
  const suggestedUrgency = useMemo(() => {
    const hasCritical = complianceIssues.some(i => i.severity === 'critical');
    const hasWarning = complianceIssues.some(i => i.severity === 'warning');
    if (hasCritical) return 'critical';
    if (hasWarning) return 'high';
    return 'normal';
  }, [complianceIssues]);

  // Set urgency to suggested when dialog opens
  React.useEffect(() => {
    if (open) {
      setUrgency(suggestedUrgency);
    }
  }, [open, suggestedUrgency]);

  // Generate the email content
  const emailContent = useMemo(() => {
    const assignedInfo = assignedUser 
      ? `${assignedUser.firstName || ''} ${assignedUser.lastName || ''} (${assignedUser.username})` 
      : 'Unassigned';
    
    let issuesText = '';
    if (complianceIssues.length > 0) {
      issuesText = 'COMPLIANCE ISSUES IDENTIFIED:\n' +
        '---------------------------\n' +
        complianceIssues.map((issue, i) => 
          `${i + 1}. [${issue.severity.toUpperCase()}] ${issue.type}\n   ${issue.description}`
        ).join('\n\n') + '\n\n';
    }
    
    const additionalNotesText = additionalNotes.trim() 
      ? `ADDITIONAL NOTES FROM CHIEF COMPLIANCE OFFICER:\n---------------------------\n${additionalNotes}\n\n` 
      : '';
    
    return {
      subject: `[ESCALATION - ${urgency.toUpperCase()}] ${regulationName}`,
      body: 
        `COMPLIANCE ESCALATION NOTICE\n` +
        `================================\n\n` +
        `TO: ${escalationTarget}\n` +
        `FROM: Chief Compliance Officer\n` +
        `DATE: ${format(new Date(), 'PPP')}\n\n` +
        `This escalation requires your immediate attention.\n\n` +
        `REGULATION DETAILS:\n` +
        `------------------\n` +
        `Regulation: ${regulationName}\n` +
        `Regulation ID: ${regulation.id}\n` +
        `Urgency Level: ${urgency.toUpperCase()}\n` +
        `Responsible Office: ${fieldOffice}\n` +
        `Assigned Field Officer: ${assignedInfo}\n\n` +
        issuesText +
        additionalNotesText +
        `ACTION REQUESTED:\n` +
        `------------------\n` +
        `Please ensure the ${fieldOffice} addresses these compliance gaps immediately.\n\n` +
        `------------------\n` +
        `This escalation was sent via EdSteward Compliance Portal.`
    };
  }, [regulationName, regulation.id, urgency, fieldOffice, assignedUser, complianceIssues, additionalNotes, escalationTarget]);

  const handleSendEscalation = async () => {
    setIsSending(true);
    
    try {
      const subject = encodeURIComponent(emailContent.subject);
      const body = encodeURIComponent(emailContent.body);

      // CC the field office if checkbox is checked
      const ccEmails = ccFieldOffice ? `&cc=${encodeURIComponent(fieldOfficeEmail)}` : '';
      const mailtoLink = `mailto:${escalationEmail}?subject=${subject}&body=${body}${ccEmails}`;
      
      // Open mail client
      window.location.href = mailtoLink;

      // Log the escalation to the audit trail
      try {
        await fetch('/api/audit/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: 'escalation_sent',
            resourceType: 'regulation',
            resourceId: regulation.id.toString(),
            details: {
              regulationName,
              escalationTarget,
              escalationEmail,
              fieldOffice,
              fieldOfficeEmail,
              ccFieldOffice,
              urgency,
              complianceIssues: complianceIssues.map(i => i.type),
              additionalNotes: additionalNotes.substring(0, 500),
              assignedUserId: assignedUser?.id || null,
            },
          }),
        });
      } catch (auditError) {
        console.error('Failed to log escalation to audit trail:', auditError);
      }

      toast({
        title: "Escalation Prepared",
        description: `Your email client should open with the escalation to ${escalationTarget}.`,
      });

      // Reset form
      setAdditionalNotes("");
      setUrgency("normal");
      setCcFieldOffice(false);
      setShowEmailPreview(false);
      onOpenChange(false);
      
    } catch (error) {
      console.error('Escalation error:', error);
      toast({
        title: "Escalation Failed",
        description: "Failed to prepare escalation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Escalate to Supervisor
          </DialogTitle>
          <DialogDescription>
            Escalate this compliance issue to {escalationTarget} for immediate attention.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Escalation Target */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-red-800 mb-2">
              <UserCog className="h-4 w-4" />
              Escalation Will Be Sent To:
            </div>
            <div className="text-red-900 font-semibold text-lg">{escalationTarget}</div>
            <div className="text-red-700 text-sm">{escalationEmail}</div>
          </div>

          {/* Compliance Issues - Auto-detected */}
          {complianceIssues.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-yellow-800 mb-3">
                <FileWarning className="h-4 w-4" />
                Compliance Issues Detected ({complianceIssues.length})
              </div>
              <div className="space-y-2">
                {complianceIssues.map((issue, index) => (
                  <div 
                    key={index} 
                    className={`flex items-start gap-2 p-2 rounded ${
                      issue.severity === 'critical' ? 'bg-red-100' : 'bg-yellow-100'
                    }`}
                  >
                    {issue.severity === 'critical' ? (
                      <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Clock className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <div className={`text-sm font-medium ${
                        issue.severity === 'critical' ? 'text-red-800' : 'text-yellow-800'
                      }`}>
                        {issue.type}
                      </div>
                      <div className={`text-xs ${
                        issue.severity === 'critical' ? 'text-red-700' : 'text-yellow-700'
                      }`}>
                        {issue.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-yellow-700 mt-3 italic">
                ✓ These issues will be automatically included in the escalation email
              </p>
            </div>
          )}

          {complianceIssues.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">No compliance issues detected</span>
              </div>
              <p className="text-xs text-green-700 mt-1">
                All required actions appear to be complete. You may still escalate if there are other concerns.
              </p>
            </div>
          )}

          {/* Context Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-background p-3 rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Building2 className="h-4 w-4" />
                <span className="font-medium">Field Office:</span>
              </div>
              <div className="text-foreground">{fieldOffice}</div>
            </div>
            <div className="bg-background p-3 rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <User className="h-4 w-4" />
                <span className="font-medium">Assigned To:</span>
              </div>
              <div className="text-foreground">
                {assignedUser 
                  ? (assignedUser.firstName && assignedUser.lastName 
                      ? `${assignedUser.firstName} ${assignedUser.lastName}` 
                      : assignedUser.username)
                  : <span className="text-muted-foreground italic">Unassigned</span>
                }
              </div>
            </div>
          </div>

          {/* Urgency Level */}
          <div className="space-y-2">
            <Label htmlFor="urgency">Urgency Level</Label>
            <Select value={urgency} onValueChange={setUrgency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {URGENCY_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    <div className="flex items-center gap-2">
                      <Badge className={level.color}>{level.label}</Badge>
                      <span className="text-muted-foreground text-xs">{level.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {suggestedUrgency !== 'normal' && (
              <p className="text-xs text-muted-foreground">
                Auto-set to "{suggestedUrgency}" based on detected issues
              </p>
            )}
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="additionalNotes">Additional Notes (optional)</Label>
            <Textarea
              id="additionalNotes"
              placeholder="Add any additional context or specific instructions for the supervisor..."
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* CC Field Office Option */}
          <div className="flex items-center space-x-2 bg-blue-50 p-3 rounded-lg">
            <Checkbox 
              id="ccFieldOffice" 
              checked={ccFieldOffice}
              onCheckedChange={(checked) => setCcFieldOffice(checked === true)}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="ccFieldOffice"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                CC the Field Office ({fieldOffice})
              </label>
              <p className="text-xs text-muted-foreground">
                Send a copy to {fieldOfficeEmail}
              </p>
            </div>
          </div>

          {/* Email Preview Toggle */}
          <button
            type="button"
            onClick={() => setShowEmailPreview(!showEmailPreview)}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
          >
            {showEmailPreview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showEmailPreview ? 'Hide' : 'Preview'} Email Content
          </button>

          {showEmailPreview && (
            <div className="bg-gray-100 border rounded-lg p-4 text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
              <div className="font-bold text-foreground mb-2">Subject: {emailContent.subject}</div>
              <div className="text-muted-foreground">{emailContent.body}</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSendEscalation}
            disabled={isSending}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isSending ? (
              "Preparing..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Escalation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
