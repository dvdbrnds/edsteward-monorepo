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
import { AlertCircle, Download, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import Navigation from "@/components/layout/navigation";
import { apiRequest } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from "date-fns";
import { InstitutionSettings } from "@/components/admin/institution-settings";
import { BrandingSettingsV2 } from "@/components/admin/branding-settings";
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
  7: { name: "Debug", color: "text-gray-400" }
};

const insertEmailConfigSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.number().int().positive(),
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
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const refreshInterval = 10000; // 10 seconds
  
  // Redirect if user is not an admin
  if (!user || user.role?.toLowerCase() !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-900">Access Denied</h2>
              <p className="mt-2 text-gray-600">You do not have permission to access admin settings.</p>
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


  const form = useForm<FormValues>({
    resolver: zodResolver(insertEmailConfigSchema),
    defaultValues: {
      host: "",
      port: 587,
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
  }, [form]);

  useEffect(() => {
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
  }, [twilioForm]);

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (level) params.append('level', level);
      if (facility) params.append('facility', facility);
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      params.append('page', page.toString());

      const response = await fetch(`/api/admin/logs?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    }
  };

  useEffect(() => {
    if (activeTab === "logs") {
      fetchLogs();
    }
  }, [activeTab, search, level, facility, startDate, endDate, page]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (autoRefresh && activeTab === "logs") {
      interval = setInterval(() => {
        fetchLogs();
      }, refreshInterval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, activeTab, search, level, facility, startDate, endDate, page]);

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
    enabled: user?.role?.toLowerCase() === "admin"
  });

  useEffect(() => {
    if (autoRefresh) {
      const intervalId = setInterval(() => {
        refetchLogs();
      }, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [autoRefresh, refetchLogs]);

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

  const { mutate: updateUser, isPending: isUpdatingUser } = useMutation({
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
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
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
    enabled: user?.role?.toLowerCase() === 'admin' && activeTab === 'users'
  });


  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">System Settings</h1>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-6 mb-4">
              <TabsTrigger value="institution">Institution</TabsTrigger>
              <TabsTrigger value="branding">Branding</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="sms">SMS</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="logs">System Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="institution">
              <InstitutionSettings 
                tenantId="admin"
                onConfigUpdate={(config) => {
                  toast({
                    title: "Institution Settings Updated",
                    description: "The institution configuration has been saved successfully.",
                  });
                }}
              />
            </TabsContent>

            <TabsContent value="branding">
              <BrandingSettingsV2 
                onConfigUpdate={(config) => {
                  toast({
                    title: "Branding Updated",
                    description: "Your branding configuration has been applied successfully. Changes will be visible on the next page load.",
                    duration: 7000,
                  });
                }}
              />
            </TabsContent>

            <TabsContent value="email">
              <Card>
                <CardHeader>
                  <CardTitle>Email Configuration</CardTitle>
                  <CardDescription>
                    Configure the email server settings for notifications.
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
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sms">
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
            </TabsContent>

            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    Manage user accounts, roles, and departments.
                  </CardDescription>
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
                                    <SelectTrigger className="w-[140px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="user">User</SelectItem>
                                      <SelectItem value="compliance_officer">
                                        Compliance Officer
                                      </SelectItem>
                                      <SelectItem value="admin">Admin</SelectItem>
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
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => resetPassword(user.id)}
                                    disabled={isResettingPassword}
                                  >
                                    {isResettingPassword ? (
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : null}
                                    Reset Password
                                  </Button>
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
                        <label className="text-sm font-medium">Search</label>
                        <div className="flex space-x-2">
                          <Input
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
                        <label className="text-sm font-medium">Log Level</label>
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
                        <label className="text-sm font-medium">Facility</label>
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