Reasoning:

1. The edited code provides a complete new implementation of `SystemSettingsPage`, including a new tab for system logs.  It uses React hooks, form handling, and data fetching to display and filter logs.  This requires replacing a significant portion of the original code.

2. The original code has sections for user management, email configuration, notification settings, and SMS configuration which will need to be integrated with the new tab structure provided by the edited code.  The original code's notification handling will likely be replaced, as the new code uses a different approach to fetch and handle those settings.

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/components/ui/use-toast";
import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import Navigation from "@/components/layout/navigation";
import { useAuth } from "@/hooks/auth";
import { insertEmailConfigSchema, insertTwilioConfigSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Alert, AlertCircle, AlertDescription, AlertTitle } from "@/components/ui";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type FormValues = z.infer<typeof insertEmailConfigSchema>;
type TwilioFormValues = z.infer<typeof insertTwilioConfigSchema>;

// Log level definitions copied from logs-page
const LOG_LEVELS = {
  0: { name: "EMERGENCY", color: "text-red-700 font-bold" },
  1: { name: "ALERT", color: "text-red-600 font-bold" },
  2: { name: "CRITICAL", color: "text-red-500 font-bold" },
  3: { name: "ERROR", color: "text-red-400" },
  4: { name: "WARNING", color: "text-amber-500" },
  5: { name: "NOTICE", color: "text-blue-500" },
  6: { name: "INFO", color: "text-gray-600" },
  7: { name: "DEBUG", color: "text-gray-400" },
};

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

export default function SystemSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("email");
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<string>();
  const [facility, setFacility] = useState<string>();
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshInterval = 10000; // 10 seconds

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

  // Load email configuration
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

  // Load Twilio configuration
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

  // Fetch logs data
  const { data: logsData, isLoading: logsLoading, error: logsError, refetch: refetchLogs } = useQuery({
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
    enabled: activeTab === "logs" && user?.role === "admin"
  });

  // Auto-refresh logs
  useEffect(() => {
    if (autoRefresh && activeTab === "logs") {
      const intervalId = setInterval(() => {
        refetchLogs();
      }, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [autoRefresh, refetchLogs, activeTab]);

  // Load notifications settings
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch("/api/admin/notifications");
        if (response.ok) {
          const data = await response.json();
          setNotifications(data);
          // Check if notifications are enabled
          const globalSetting = data.find((n: any) => n.key === "notifications_enabled");
          setNotificationEnabled(globalSetting?.value === "true");
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      }
    };

    fetchNotifications();
  }, []);

  const onEmailSubmit = async (data: FormValues) => {
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
          title: "Success",
          description: "Email configuration updated successfully",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update email configuration",
        });
      }
    } catch (error) {
      console.error("Failed to update email configuration:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    }
  };

  const onTwilioSubmit = async (data: TwilioFormValues) => {
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
          title: "Success",
          description: "Twilio configuration updated successfully",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update Twilio configuration",
        });
      }
    } catch (error) {
      console.error("Failed to update Twilio configuration:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    }
  };

  const toggleNotifications = async () => {
    try {
      const newValue = !notificationEnabled;
      setNotificationEnabled(newValue);

      const response = await fetch("/api/admin/notifications/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: newValue }),
      });

      if (!response.ok) {
        setNotificationEnabled(!newValue); // Revert if failed
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update notification settings",
        });
      }
    } catch (error) {
      console.error("Failed to toggle notifications:", error);
      setNotificationEnabled(!notificationEnabled); // Revert if failed
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    }
  };

  // Download logs as CSV
  const downloadCSV = () => {
    if (!logsData?.logs) return;

    const headers = ["Timestamp", "Username", "Level", "Facility", "Message", "IP", "User Agent"];
    const rows = logsData.logs.map((log: any) => [
      log.timestamp,
      log.username,
      LOG_LEVELS[log.severity as keyof typeof LOG_LEVELS]?.name || log.level,
      LOG_FACILITIES[log.facility as keyof typeof LOG_FACILITIES] || log.facility,
      log.message,
      log.ip,
      log.userAgent
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `system_logs_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (user?.role !== "admin") {
    return (
      <PageLayout>
        <Navigation />
        <div className="p-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              Only administrators can access system settings.
            </AlertDescription>
          </Alert>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <Navigation />
      <div className="container mx-auto py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>System Settings</CardTitle>
            <CardDescription>
              Configure system-wide settings for your compliance management platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="email" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="email">Email Settings</TabsTrigger>
                <TabsTrigger value="twilio">SMS Settings</TabsTrigger>
                <TabsTrigger value="logs">System Logs</TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="py-4">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onEmailSubmit)} className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-medium">Email Configuration</h3>
                        <p className="text-sm text-gray-500">
                          Configure SMTP settings for sending email notifications.
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={notificationEnabled}
                          onCheckedChange={toggleNotifications}
                          id="notifications-enabled"
                        />
                        <label
                          htmlFor="notifications-enabled"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Enable Notifications
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <FormLabel>SMTP Port</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="587"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Username</FormLabel>
                            <FormControl>
                              <Input placeholder="user@example.com" {...field} />
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
                            <FormLabel>SMTP Password</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="••••••••"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="from"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>From Email</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="compliance@yourcompany.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit">Save Email Settings</Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="twilio" className="py-4">
                <Form {...twilioForm}>
                  <form onSubmit={twilioForm.handleSubmit(onTwilioSubmit)} className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium">Twilio SMS Configuration</h3>
                      <p className="text-sm text-gray-500">
                        Configure Twilio settings for sending SMS notifications.
                      </p>
                    </div>

                    <FormField
                      control={twilioForm.control}
                      name="accountSid"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account SID</FormLabel>
                          <FormControl>
                            <Input placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx" {...field} />
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
                            <Input
                              type="password"
                              placeholder="••••••••"
                              {...field}
                            />
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
                          <FormLabel>From Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="+15551234567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit">Save Twilio Settings</Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="logs" className="py-4">
                <div>
                  <div className="flex flex-col space-y-2 mb-4">
                    <h3 className="text-lg font-medium">System Logs</h3>
                    <p className="text-sm text-gray-500">
                      View and filter system logs. Use the filters below to narrow down the results.
                    </p>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 border rounded-md p-2 bg-muted/20">
                      <span>• Authentication events (login/logout)</span>
                      <span>• Regulation access and updates</span>
                      <span>• Compliance status changes</span>
                      <span>• Report generation</span>
                      <span>• System configuration changes</span>
                    </div>
                  </div>

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

                  <div className="flex justify-between mb-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search logs..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-64"
                      />
                      <select
                        value={level || ""}
                        onChange={(e) => setLevel(e.target.value || undefined)}
                        className="px-3 py-2 rounded-md border border-input"
                      >
                        <option value="">All Levels</option>
                        {Object.entries(LOG_LEVELS).map(([key, { name }]) => (
                          <option key={key} value={key}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button onClick={downloadCSV} size="sm" variant="outline">
                      Export CSV
                    </Button>
                  </div>

                  {logsLoading ? (
                    <div className="text-center py-8">Loading logs...</div>
                  ) : logsError ? (
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
                            {logsData?.logs.map((log: any, index: number) => (
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

                      <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-muted-foreground">
                          Showing {logsData?.logs.length || 0} of {logsData?.total || 0} logs
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((old) => Math.max(old - 1, 1))}
                            disabled={page === 1}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((old) => old + 1)}
                            disabled={
                              !logsData?.totalPages || page >= logsData.totalPages
                            }
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}