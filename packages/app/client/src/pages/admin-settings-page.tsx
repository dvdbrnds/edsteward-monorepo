import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Download, Loader2, RefreshCw, Trash2, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import Navigation from "@/components/layout/navigation";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from "date-fns";
import { InstitutionSettings } from "@/components/admin/institution-settings";
import { BrandingSettingsV2 } from "@/components/admin/branding-settings";
import { BackupManagement } from "@/components/admin/backup-management";
import { NotificationSchedulerSettings } from "@/components/admin/notification-scheduler-settings";
import { RoleAssignmentsSettings } from "@/components/admin/role-assignments-settings";

import { ComplianceDocuments } from "@/components/admin/compliance-documents";
import { EmailDeliveryIssues } from "@/components/admin/email-delivery-issues";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/components/ui/alert";

const LOG_FACILITIES = {
  0: "KERNEL",
  1: "USER",
  2: "MAIL",
  3: "SYSTEM",
  4: "SECURITY",
  5: "INTERNAL",
  6: "PRINTER",
  7: "NETWORK",
  8: "UUCP",
  9: "CLOCK",
  10: "AUTHPRIV",
  11: "FTP",
  12: "NTP",
  13: "AUDIT",
  14: "ALERT",
  15: "CRON",
  16: "LOCAL0",
  17: "LOCAL1",
  18: "LOCAL2",
  19: "LOCAL3",
  20: "LOCAL4",
  21: "LOCAL5",
  22: "LOCAL6",
  23: "LOCAL7"
};

const LOG_LEVELS = {
  0: { name: "Emergency", color: "text-red-600 font-bold" },
  1: { name: "Alert", color: "text-red-500 font-bold" },
  2: { name: "Critical", color: "text-red-500" },
  3: { name: "Error", color: "text-red-400" },
  4: { name: "Warning", color: "text-yellow-500" },
  5: { name: "Notice", color: "text-blue-500" },
  6: { name: "Info", color: "text-blue-400" },
  7: { name: "Debug", color: "text-muted-foreground" }
};

const insertEmailConfigSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.number().int().positive(),
  secure: z.boolean().default(false),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  from: z.string().email("Must be a valid email address"),
});

const insertTwilioConfigSchema = z.object({
  accountSid: z.string().min(1, "Account SID is required"),
  authToken: z.string().min(1, "Auth Token is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
});

type FormValues = z.infer<typeof insertEmailConfigSchema>;
type TwilioFormValues = z.infer<typeof insertTwilioConfigSchema>;

export default function SystemSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("institution");
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<string>();
  const [facility, setFacility] = useState<string>();
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshInterval = 10000; // 10 seconds
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    role: 'department_head',
    department: '',
    password: '',
  });

  // Check if user is admin (used for conditional rendering below)
  const isAdmin = user?.role?.toLowerCase() === "admin";

  // ALL HOOKS MUST BE CALLED UNCONDITIONALLY (React rules of hooks)
  const form = useForm<FormValues>({
    resolver: zodResolver(insertEmailConfigSchema),
    defaultValues: {
      host: "",
      port: 587,
      secure: false,
      username: "",
      password: "",
      from: "",
    },
  });

  const twilioForm = useForm<TwilioFormValues>({
    resolver: zodResolver(insertTwilioConfigSchema),
    defaultValues: {
      accountSid: "",
      authToken: "",
      phoneNumber: "",
    },
  });

  useEffect(() => {
    if (!isAdmin) return; // Skip fetch if not admin
    const fetchEmailConfig = async () => {
      try {
        const response = await fetch("/api/admin/email-config");
        if (response.ok) {
          const data = await response.json();
          if (data) {
            form.reset(data);
          }
        }
      } catch (error) {
        console.error("Failed to fetch email configuration:", error);
      }
    };

    fetchEmailConfig();
  }, [form, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return; // Skip fetch if not admin
    const fetchTwilioConfig = async () => {
      try {
        const response = await fetch("/api/admin/twilio-config");
        if (response.ok) {
          const data = await response.json();
          if (data) {
            twilioForm.reset(data);
          }
        }
      } catch (error) {
        console.error("Failed to fetch Twilio configuration:", error);
      }
    };

    fetchTwilioConfig();
  }, [twilioForm, isAdmin]);

  // Log fetching is handled by useQuery below

  const onSubmitEmailConfig = async (data: FormValues) => {
    try {
      const response = await fetch("/api/admin/email-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        toast({
          title: "Email Configuration Updated",
          description: "The email configuration has been updated successfully.",
        });
      } else {
        throw new Error("Failed to update email configuration");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const onSubmitTwilioConfig = async (data: TwilioFormValues) => {
    try {
      const response = await fetch("/api/admin/twilio-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        toast({
          title: "Twilio Configuration Updated",
          description: "The Twilio configuration has been updated successfully.",
        });
      } else {
        throw new Error("Failed to update Twilio configuration");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const { data: logData, isLoading: logIsLoading, error: logError, refetch: refetchLogs } = useQuery({
    queryKey: ["/api/admin/logs", { search, level, facility, startDate, endDate, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (level && level !== "all") params.append("level", level);
      if (facility && facility !== "all") params.append("facility", facility);
      if (startDate) params.append("startDate", startDate.toISOString());
      if (endDate) params.append("endDate", endDate.toISOString());
      params.append("page", String(page));

      const response = await fetch(`/api/admin/logs?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch logs");
      }
      return response.json();
    },
    enabled: isAdmin
  });

  useEffect(() => {
    if (!isAdmin || !autoRefresh) return;
    const intervalId = setInterval(() => {
      refetchLogs();
    }, refreshInterval);
    return () => clearInterval(intervalId);
  }, [autoRefresh, refetchLogs, isAdmin]);

  const downloadCSV = () => {
    if (!logData?.logs) return;

    const headers = ["Timestamp", "Username", "Level", "Facility", "Message", "IP Address", "User Agent"];
    const csvContent = [
      headers.join(","),
      ...logData.logs.map((log: any) => {
        return [
          format(new Date(log.timestamp), "MMM d, yyyy HH:mm:ss"),
          log.username || 'system',
          log.level,
          LOG_FACILITIES[log.facility as keyof typeof LOG_FACILITIES] || log.facility,
          `"${log.message.replace(/"/g, '""')}"` ,
          log.ip,
          `"${log.userAgent.replace(/"/g, '""')}"`
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `system-logs-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const { mutate: updateUser } = useMutation({
    mutationFn: async (data: {id: number; role: string; department: string}) => {
      const response = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error('Failed to update user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: 'Success',
        description: 'User updated successfully'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const { mutate: resetPassword, isPending: isResettingPassword } = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id })
      });
      if (!response.ok) {
        throw new Error('Failed to reset password');
      }
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Password Reset Successful',
        description: `Temporary password: ${data.temporaryPassword}`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    }
  });

  const { mutate: deleteUser, isPending: isDeletingUser } = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete user');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'User Deleted',
        description: 'User has been removed from the system'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const { mutate: createUser, isPending: isCreatingUser } = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(userData)
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create user');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'User Created',
        description: `${data.firstName} ${data.lastName} has been added as ${data.role}`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setShowCreateUserDialog(false);
      setNewUser({
        firstName: '',
        lastName: '',
        email: '',
        username: '',
        role: 'department_head',
        department: '',
        password: '',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Creating User',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    },
    enabled: isAdmin && activeTab === 'users'
  });

  // Render access denied if not admin
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-foreground">Access Denied</h1>
              <p className="mt-2 text-muted-foreground">You do not have permission to access admin settings.</p>
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                className="mt-4"
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-6 sm:mb-8">System Settings</h1>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex flex-wrap gap-1 h-auto mb-4">
              <TabsTrigger value="institution" className="flex-shrink-0">Institution</TabsTrigger>
              <TabsTrigger value="branding" className="flex-shrink-0">Branding</TabsTrigger>
              <TabsTrigger value="notifications" className="flex-shrink-0">Notifications</TabsTrigger>
              <TabsTrigger value="users" className="flex-shrink-0">Users</TabsTrigger>
              <TabsTrigger value="roles" className="flex-shrink-0">Roles</TabsTrigger>
              <TabsTrigger value="compliance" className="flex-shrink-0">HECVAT</TabsTrigger>
              <TabsTrigger value="backups" className="flex-shrink-0">Backups</TabsTrigger>
              <TabsTrigger value="logs" className="flex-shrink-0">Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="institution">
              <InstitutionSettings 
                onConfigUpdate={() => {
                  toast({
                    title: "Institution Settings Updated",
                    description: "The institution configuration has been saved successfully.",
                  });
                }}
              />
            </TabsContent>

            <TabsContent value="branding">
              <BrandingSettingsV2 
                onConfigUpdate={() => {
                  toast({
                    title: "Branding Updated",
                    description: "Your branding configuration has been applied successfully. Changes will be visible on the next page load.",
                    duration: 7000,
                  });
                }}
              />
            </TabsContent>

            <TabsContent value="notifications">
              <div className="space-y-6">
                <EmailDeliveryIssues />

                <NotificationSchedulerSettings />

                <Card>
                  <CardHeader>
                    <CardTitle>Email Configuration</CardTitle>
                    <CardDescription>
                      SMTP server settings used to send notification emails.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmitEmailConfig)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="host"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SMTP Host</FormLabel>
                              <FormControl>
                                <Input placeholder="smtp.example.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="port"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Port</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    {...field}
                                    onChange={(e) => {
                                      const port = parseInt(e.target.value);
                                      field.onChange(port);
                                      if (port === 465) {
                                        form.setValue('secure', true);
                                      } else if (port === 587 || port === 25) {
                                        form.setValue('secure', false);
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="secure"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel>Use SSL/TLS</FormLabel>
                                  <FormDescription className="text-xs">
                                    Port 465 = ON, Port 587 = OFF
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input type="password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="from"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>From Address</FormLabel>
                              <FormControl>
                                <Input type="email" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button type="submit">
                          Save Email Configuration
                        </Button>
                      </form>
                    </Form>

                    <div className="mt-6 pt-6 border-t">
                      <h4 className="font-medium mb-3">Test Email Configuration</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Send a test email to verify your SMTP settings are working correctly.
                      </p>
                      <div className="flex gap-3 items-end">
                        <div className="flex-1">
                          <label htmlFor="test-email-address" className="text-sm font-medium mb-1 block">Send Test To</label>
                          <Input 
                            id="test-email-address"
                            type="email"
                            placeholder="test@example.com"
                            value={testEmailAddress}
                            onChange={(e) => setTestEmailAddress(e.target.value)}
                          />
                        </div>
                        <Button 
                          type="button" 
                          variant="outline"
                          disabled={!testEmailAddress || isSendingTest}
                          onClick={async () => {
                            if (!testEmailAddress) {
                              toast({
                                title: "Email Required",
                                description: "Please enter an email address to send the test to.",
                                variant: "destructive",
                              });
                              return;
                            }
                            setIsSendingTest(true);
                            toast({
                              title: "Sending...",
                              description: `Sending test email to ${testEmailAddress}`,
                            });
                            try {
                              const response = await fetch("/api/admin/email-config/test", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ to: testEmailAddress })
                              });
                              const data = await response.json();
                              if (response.ok) {
                                toast({
                                  title: "✅ Test Email Sent!",
                                  description: `Check ${testEmailAddress} for the test message.`,
                                });
                              } else {
                                toast({
                                  title: "❌ Test Failed",
                                  description: data.error || "Failed to send test email. Check your SMTP settings.",
                                  variant: "destructive",
                                });
                              }
                            } catch {
                              toast({
                                title: "❌ Error",
                                description: "Failed to send test email. Check server logs for details.",
                                variant: "destructive",
                              });
                            } finally {
                              setIsSendingTest(false);
                            }
                          }}
                        >
                          {isSendingTest ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            "Send Test Email"
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>SMS Configuration (Twilio)</CardTitle>
                    <CardDescription>
                      Configure Twilio for SMS notifications.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...twilioForm}>
                      <form onSubmit={twilioForm.handleSubmit(onSubmitTwilioConfig)} className="space-y-4">
                        <FormField
                          control={twilioForm.control}
                          name="accountSid"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account SID</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={twilioForm.control}
                          name="authToken"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Auth Token</FormLabel>
                              <FormControl>
                                <Input type="password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={twilioForm.control}
                          name="phoneNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number</FormLabel>
                              <FormControl>
                                <Input placeholder="+1234567890" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button type="submit">
                          Save SMS Configuration
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>User Management</CardTitle>
                      <CardDescription>
                        Manage user accounts, roles, and departments. Create Department Heads to assign as DRIs for regulations.
                      </CardDescription>
                    </div>
                    <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
                      <DialogTrigger asChild>
                        <Button>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Create User
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                          <DialogTitle>Create New User</DialogTitle>
                          <DialogDescription>
                            Add a new user who can be assigned as a DRI for regulations. Department Heads (like Chief of Police) can be assigned to major regulations.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label htmlFor="new-user-first-name" className="text-sm font-medium">First Name *</label>
                              <Input
                                id="new-user-first-name"
                                value={newUser.firstName}
                                onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                                placeholder="John"
                              />
                            </div>
                            <div className="space-y-2">
                              <label htmlFor="new-user-last-name" className="text-sm font-medium">Last Name *</label>
                              <Input
                                id="new-user-last-name"
                                value={newUser.lastName}
                                onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                                placeholder="Smith"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="new-user-email" className="text-sm font-medium">Email *</label>
                            <Input
                              id="new-user-email"
                              type="email"
                              value={newUser.email}
                              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                              placeholder="john.smith@university.edu"
                            />
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="new-user-username" className="text-sm font-medium">Username *</label>
                            <Input
                              id="new-user-username"
                              value={newUser.username}
                              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                              placeholder="jsmith"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label htmlFor="new-user-role" className="text-sm font-medium">Role *</label>
                              <Select
                                value={newUser.role}
                                onValueChange={(role) => setNewUser({ ...newUser, role })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="department_head">Department Head</SelectItem>
                                  <SelectItem value="compliance_officer">Compliance Officer</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="user">Staff</SelectItem>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label htmlFor="new-user-department" className="text-sm font-medium">Department</label>
                              <Input
                                id="new-user-department"
                                value={newUser.department}
                                onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                                placeholder="Campus Police"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="new-user-password" className="text-sm font-medium">Password (optional for SSO)</label>
                            <Input
                              id="new-user-password"
                              type="password"
                              value={newUser.password}
                              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                              placeholder="Leave blank for SSO users"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowCreateUserDialog(false)}>
                            Cancel
                          </Button>
                          <Button
                            onClick={() => createUser(newUser)}
                            disabled={isCreatingUser || !newUser.firstName || !newUser.lastName || !newUser.email || !newUser.username}
                          >
                            {isCreatingUser ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Creating...
                              </>
                            ) : (
                              'Create User'
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* User Table */}
                    {usersLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Username</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Department</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {users?.map((user: any) => (
                              <TableRow key={user.id}>
                                <TableCell>{user.firstName} {user.lastName}</TableCell>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                  <Select
                                    defaultValue={user.role}
                                    onValueChange={(role) =>
                                      updateUser({
                                        id: user.id,
                                        role,
                                        department: user.department
                                      })
                                    }
                                  >
                                    <SelectTrigger className="w-[160px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="admin">Admin</SelectItem>
                                      <SelectItem value="compliance_officer">
                                        Compliance Officer
                                      </SelectItem>
                                      <SelectItem value="department_head">
                                        Department Head
                                      </SelectItem>
                                      <SelectItem value="user">Staff</SelectItem>
                                      <SelectItem value="viewer">Viewer</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    defaultValue={user.department}
                                    onBlur={(e) =>
                                      updateUser({
                                        id: user.id,
                                        department: e.target.value,
                                        role: user.role
                                      })
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => resetPassword(user.id)}
                                      disabled={isResettingPassword}
                                    >
                                      {isResettingPassword ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      ) : null}
                                      Reset PW
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      aria-label={`Delete user ${user.username || user.email}`}
                                      onClick={() => {
                                        if (confirm(`Delete user "${user.username || user.email}"? This cannot be undone.`)) {
                                          deleteUser(user.id);
                                        }
                                      }}
                                      disabled={isDeletingUser}
                                    >
                                      {isDeletingUser ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="roles">
              <RoleAssignmentsSettings />
            </TabsContent>

            <TabsContent value="compliance">
              <ComplianceDocuments />
            </TabsContent>

            <TabsContent value="backups">
              <BackupManagement />
            </TabsContent>

            <TabsContent value="logs">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>System Logs</CardTitle>
                  <CardDescription>
                    View and filter system logs. Use the filters below to narrow down the results.
                  </CardDescription>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 border rounded-md p-2 bg-muted/20">
                    <span>• Authentication events (login/logout)</span>
                    <span>• Regulation access and updates</span>
                    <span>• Compliance status changes</span>
                    <span>• Report generation</span>
                    <span>• System configuration changes</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-2 mb-4 flex-wrap items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-auto"
                        onClick={() => {
                          setSearch("");
                          setLevel(undefined);
                          setFacility(undefined);
                          setStartDate(undefined);
                          setEndDate(undefined);
                          setPage(1);
                        }}
                      >
                        Clear All Filters
                      </Button>
                      <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh}>
                        Auto Refresh
                      </Switch>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div className="space-y-2">
                        <label htmlFor="log-search" className="text-sm font-medium">Search</label>
                        <div className="flex space-x-2">
                          <Input
                            id="log-search"
                            placeholder="Search logs..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                          <Button
                            variant="outline"
                            onClick={() => setSearch("")}
                            title="Show all logs"
                            size="sm"
                          >
                            All Logs
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="log-level-select" className="text-sm font-medium">Log Level</label>
                        <Select value={level} onValueChange={setLevel}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Levels</SelectItem>
                            {Object.entries(LOG_LEVELS).map(([value, { name }]) => (
                              <SelectItem key={value} value={value}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="log-facility-select" className="text-sm font-medium">Facility</label>
                        <Select value={facility} onValueChange={setFacility}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select facility" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Facilities</SelectItem>
                            {Object.entries(LOG_FACILITIES).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-end space-x-2">
                        <Button
                          onClick={() => {
                            setSearch(`username:${user?.username}`);
                            setPage(1);
                          }}
                          variant="outline"
                        >
                          My Activity
                        </Button>
                      </div>
                    </div>

                    {logIsLoading ? (
                      <div className="text-center py-8">Loading logs...</div>
                    ) : logError ? (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>
                          Failed to load logs. Please try again.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Timestamp</TableHead>
                                <TableHead>Username</TableHead>
                                <TableHead>Level</TableHead>
                                <TableHead>Facility</TableHead>
                                <TableHead>Message</TableHead>
                                <TableHead>IP Address</TableHead>
                                <TableHead>User Agent</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {logData?.logs.map((log: any, index: number) => (
                                <TableRow key={index}>
                                  <TableCell>
                                    {format(new Date(log.timestamp), "MMM d, yyyy HH:mm:ss")}
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {log.username || 'system'}
                                  </TableCell>
                                  <TableCell className={LOG_LEVELS[log.severity as keyof typeof LOG_LEVELS]?.color || ""}>
                                    {LOG_LEVELS[log.severity as keyof typeof LOG_LEVELS]?.name || log.level}
                                  </TableCell>
                                  <TableCell>{LOG_FACILITIES[log.facility as keyof typeof LOG_FACILITIES] || log.facility}</TableCell>
                                  <TableCell className="font-mono text-sm whitespace-pre-wrap max-w-md">
                                    {log.message}
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">
                                    {log.ip}
                                  </TableCell>
                                  <TableCell className="font-mono text-sm truncate max-w-xs" title={log.userAgent}>
                                    {log.userAgent}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        <div className="mt-4 flex justify-between items-center">
                          <div className="text-sm text-muted-foreground">
                            Showing {logData?.logs.length} of {logData?.total} logs
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={downloadCSV}
                              size="sm"
                              title="Export logs as CSV"
                              disabled={!logData?.logs?.length}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Export CSV
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => refetchLogs()}
                              size="sm"
                              title="Refresh logs"
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Refresh
                            </Button>
                            <Button
                              variant="outline"
                              disabled={page === 1}
                              onClick={() => setPage(p => p - 1)}
                            >
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              disabled={page === logData?.totalPages}
                              onClick={() => setPage(p => p + 1)}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}