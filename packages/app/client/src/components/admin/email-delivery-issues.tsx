import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, RefreshCw, Mail, XCircle } from "lucide-react";
import { format } from "date-fns";

interface DeliveryIssue {
  id: number;
  recipientEmail: string;
  recipientUserId: number | null;
  emailType: string;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  subject: string | null;
  smtpResponseCode: string | null;
  errorMessage: string | null;
  bounceType: string | null;
  escalationTriggered: boolean;
  escalationRecipient: string | null;
  sentAt: string;
  statusUpdatedAt: string;
  userName: string | null;
  entityName: string | null;
}

interface DeliveryIssuesResponse {
  issues: DeliveryIssue[];
  summary: {
    bounced: number;
    failed: number;
    delivered: number;
    periodDays: number;
  };
  total: number;
}

const EMAIL_TYPE_LABELS: Record<string, string> = {
  task_reminder: "Task Reminder",
  attestation_request: "Attestation Request",
  deadline_warning: "Deadline Warning",
  escalation: "Escalation",
  final_attestation: "Final Attestation",
  manual_notification: "Manual Notification",
  other: "Other",
};

export function EmailDeliveryIssues() {
  const [days, setDays] = useState("30");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<DeliveryIssuesResponse>({
    queryKey: ["/api/admin/email-delivery-issues", days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/email-delivery-issues?days=${days}&limit=100`);
      if (!res.ok) throw new Error("Failed to fetch delivery issues");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const resolveMutation = useMutation({
    mutationFn: async (issueId: number) => {
      const res = await fetch(`/api/admin/email-delivery-issues/${issueId}/resolve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to resolve issue");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Issue resolved", description: "The delivery issue has been marked as resolved and the user's email status reset." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-delivery-issues"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to resolve delivery issue.", variant: "destructive" });
    },
  });

  const summary = data?.summary;
  const issues = data?.issues ?? [];
  const totalIssues = (summary?.bounced ?? 0) + (summary?.failed ?? 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Delivery Issues
            </CardTitle>
            {totalIssues > 0 && (
              <Badge variant="destructive" className="text-xs">
                {totalIssues}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>
          Emails that failed to deliver to DRIs and compliance contacts. Failed emails trigger automatic escalation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary stats */}
        {summary && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{summary.delivered}</div>
              <div className="text-xs text-muted-foreground mt-1">Delivered</div>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{summary.bounced}</div>
              <div className="text-xs text-muted-foreground mt-1">Bounced</div>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{summary.failed}</div>
              <div className="text-xs text-muted-foreground mt-1">Failed</div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Loading delivery issues...
          </div>
        ) : issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mb-2 text-green-500" />
            <p className="font-medium">No delivery issues</p>
            <p className="text-sm">All emails were delivered successfully in the last {days} days.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Related To</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Escalated</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[100px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">{issue.userName || issue.recipientEmail}</div>
                        {issue.userName && (
                          <div className="text-xs text-muted-foreground">{issue.recipientEmail}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {EMAIL_TYPE_LABELS[issue.emailType] || issue.emailType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm max-w-[200px] truncate">
                        {issue.entityName || (issue.relatedEntityType ? `${issue.relatedEntityType} #${issue.relatedEntityId}` : "-")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {issue.bounceType === "permanent" ? (
                          <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                        )}
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {issue.smtpResponseCode && `${issue.smtpResponseCode}: `}
                          {issue.errorMessage?.substring(0, 80) || "Unknown error"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {issue.escalationTriggered ? (
                        <Badge variant="secondary" className="text-xs">
                          Sent to {issue.escalationRecipient?.split("@")[0] || "admin"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(issue.sentAt), "MMM d, h:mm a")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => resolveMutation.mutate(issue.id)}
                        disabled={resolveMutation.isPending}
                      >
                        Resolve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
