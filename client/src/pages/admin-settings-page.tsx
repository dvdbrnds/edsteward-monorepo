import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { EmailConfig, User } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEmailConfigSchema } from "@shared/schema";
import { insertTwilioConfigSchema } from "@shared/schema";
import { z } from "zod"; // Add this import
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Mail, Loader2, Bell, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";
import type { TwilioConfig } from "@shared/schema";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, Users, Pencil, Trash2 } from "lucide-react";
import { insertUserSchema } from "@shared/schema";


// Type definitions using the imported z
type FormValues = z.infer<typeof insertEmailConfigSchema>;
type TwilioFormValues = z.infer<typeof insertTwilioConfigSchema>;

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Redirect non-admin users
  if (user?.role !== "admin") {
    return <Redirect to="/" />;
  }

  // Fetch all users
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  // User form setup with added resetPassword field
  const userForm = useForm<z.infer<typeof insertUserSchema> & { resetPassword?: string }>({
    resolver: zodResolver(
      selectedUser
        ? insertUserSchema.omit({ password: true }).extend({
            resetPassword: z.string().min(6, "Password must be at least 6 characters").optional()
          })
        : insertUserSchema
    ),
    defaultValues: {
      username: "",
      password: "",
      role: "user",
      department: "",
      email: "",
      resetPassword: "",
    },
  });

  // User management mutations
  const createUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertUserSchema>) => {
      return apiRequest("POST", "/api/admin/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setUserDialogOpen(false);
      userForm.reset();
      toast({
        title: "User created",
        description: "New user account has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: Partial<User> & { id: number; resetPassword?: string }) => {
      // If resetPassword is provided, include it in the update
      const updateData = data.resetPassword
        ? { ...data, password: data.resetPassword }
        : data;

      // Remove resetPassword from the payload
      const { resetPassword, ...cleanData } = updateData;
      return apiRequest("PATCH", `/api/admin/users/${data.id}`, cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setUserDialogOpen(false);
      setSelectedUser(null);
      toast({
        title: "User updated",
        description: "User account has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User deleted",
        description: "User account has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: emailConfig, isLoading: emailLoading } = useQuery<EmailConfig>({
    queryKey: ["/api/admin/email-config"],
  });

  const { data: twilioConfig, isLoading: twilioLoading } = useQuery<TwilioConfig>({
    queryKey: ["/api/admin/twilio-config"],
  });

  const emailForm = useForm<FormValues>({
    resolver: zodResolver(insertEmailConfigSchema),
    defaultValues: {
      fromEmail: emailConfig?.fromEmail || "",
      smtpHost: emailConfig?.smtpHost || "",
      smtpPort: emailConfig?.smtpPort || 587,
      smtpSecure: emailConfig?.smtpSecure || true,
      smtpUser: emailConfig?.smtpUser || "",
      smtpPass: emailConfig?.smtpPass || "",
      updatedBy: user?.id || 0,
    },
  });

  const twilioForm = useForm<TwilioFormValues>({
    resolver: zodResolver(insertTwilioConfigSchema),
    defaultValues: {
      accountSid: twilioConfig?.accountSid || "",
      authToken: twilioConfig?.authToken || "",
      fromNumber: twilioConfig?.fromNumber || "",
      updatedBy: user?.id || 0,
    },
  });

  const updateEmailConfigMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const response = await apiRequest("POST", "/api/admin/email-config", data);
      if (!response.ok) {
        throw new Error("Failed to update email configuration");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-config"] });
      toast({
        title: "Email configuration updated",
        description: "Your email settings have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTwilioConfigMutation = useMutation({
    mutationFn: async (data: TwilioFormValues) => {
      const response = await apiRequest("POST", "/api/admin/twilio-config", data);
      if (!response.ok) {
        throw new Error("Failed to update Twilio configuration");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/twilio-config"] });
      toast({
        title: "Twilio configuration updated",
        description: "Your SMS settings have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onEmailSubmit = (data: FormValues) => {
    updateEmailConfigMutation.mutate(data);
  };

  const onTwilioSubmit = (data: TwilioFormValues) => {
    updateTwilioConfigMutation.mutate(data);
  };

  //This is a placeholder, replace with actual notification data fetching and mutation
  const updateNotificationMutation = useMutation({
    mutationFn: async (data: any) => {
      // Placeholder for API call to update notification settings
      console.log("Updating notification:", data);
      //Replace with your actual API call
      return data;
    },
    onSuccess: () => {
      // Placeholder for success handling
      console.log("Notification updated successfully!");
    },
    onError: (error) => {
      // Placeholder for error handling
      console.error("Error updating notification:", error);
    },
  })

  if (emailLoading || twilioLoading || usersLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#00267A]" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            {/* User Management Section */}
            <div>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center">
                  <Users className="h-6 w-6 mr-3 text-blue-500" />
                  <h1 className="text-3xl font-bold text-gray-900">
                    User Management
                  </h1>
                </div>
                <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setSelectedUser(null);
                        userForm.reset();
                      }}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {selectedUser ? "Edit User" : "Create New User"}
                      </DialogTitle>
                      <DialogDescription>
                        {selectedUser
                          ? "Update user account details"
                          : "Add a new user to the system"}
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...userForm}>
                      <form
                        onSubmit={userForm.handleSubmit((data) =>
                          selectedUser
                            ? updateUserMutation.mutate({
                                ...data,
                                id: selectedUser.id,
                              })
                            : createUserMutation.mutate(data)
                        )}
                        className="space-y-4"
                      >
                        <FormField
                          control={userForm.control}
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

                        {!selectedUser ? (
                          <FormField
                            control={userForm.control}
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
                        ) : (
                          <FormField
                            control={userForm.control}
                            name="resetPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Reset Password</FormLabel>
                                <FormControl>
                                  <Input
                                    type="password"
                                    placeholder="Enter new password to reset"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Leave blank to keep the current password
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        <FormField
                          control={userForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={userForm.control}
                          name="role"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Role</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a role" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="compliance_officer">
                                    Compliance Officer
                                  </SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={userForm.control}
                          name="department"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Department</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit"
                          className="w-full"
                          disabled={
                            createUserMutation.isPending ||
                            updateUserMutation.isPending
                          }
                        >
                          {createUserMutation.isPending ||
                          updateUserMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {selectedUser ? "Updating..." : "Creating..."}
                            </>
                          ) : (
                            selectedUser ? "Update User" : "Create User"
                          )}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : users?.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center text-gray-500 py-4"
                          >
                            No users found
                          </TableCell>
                        </TableRow>
                      ) : (
                        users?.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell>{u.username}</TableCell>
                            <TableCell>{u.email}</TableCell>
                            <TableCell className="capitalize">
                              {u.role.replace("_", " ")}
                            </TableCell>
                            <TableCell>{u.department}</TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(u);
                                  userForm.reset({
                                    username: u.username,
                                    email: u.email,
                                    role: u.role,
                                    department: u.department || "",
                                  });
                                  setUserDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "Are you sure you want to delete this user?"
                                    )
                                  ) {
                                    deleteUserMutation.mutate(u.id);
                                  }
                                }}
                                disabled={u.id === user?.id}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Email Configuration */}
            <div>
              <div className="flex items-center mb-8">
                <Mail className="h-6 w-6 mr-3 text-blue-500" />
                <h1 className="text-3xl font-bold text-gray-900">
                  Email Configuration
                </h1>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>SMTP Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...emailForm}>
                    <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-6">
                      <FormField
                        control={emailForm.control}
                        name="fromEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>From Email Address</FormLabel>
                            <FormControl>
                              <Input placeholder="compliance@university.edu" {...field} />
                            </FormControl>
                            <FormDescription>
                              This email address will be used as the sender for all notifications
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={emailForm.control}
                        name="smtpHost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Host</FormLabel>
                            <FormControl>
                              <Input placeholder="smtp.university.edu" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={emailForm.control}
                        name="smtpPort"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Port</FormLabel>
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
                        control={emailForm.control}
                        name="smtpSecure"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Use Secure Connection (TLS)
                              </FormLabel>
                              <FormDescription>
                                Enable TLS encryption for secure email transmission
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

                      <FormField
                        control={emailForm.control}
                        name="smtpUser"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Username</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={emailForm.control}
                        name="smtpPass"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Password</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={updateEmailConfigMutation.isPending}
                      >
                        {updateEmailConfigMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Configuration"
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>

            {/* Twilio Configuration */}
            <div>
              <div className="flex items-center mb-8">
                <MessageSquare className="h-6 w-6 mr-3 text-blue-500" />
                <h1 className="text-3xl font-bold text-gray-900">
                  SMS Service Configuration
                </h1>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Twilio Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...twilioForm}>
                    <form onSubmit={twilioForm.handleSubmit(onTwilioSubmit)} className="space-y-6">
                      <FormField
                        control={twilioForm.control}
                        name="accountSid"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account SID</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormDescription>
                              Your Twilio Account SID from the Twilio Console
                            </FormDescription>
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
                            <FormDescription>
                              Your Twilio Auth Token from the Twilio Console
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={twilioForm.control}
                        name="fromNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>From Phone Number</FormLabel>
                            <FormControl>
                              <Input placeholder="+1234567890" {...field} />
                            </FormControl>
                            <FormDescription>
                              Your Twilio phone number in E.164 format (e.g., +1234567890)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={updateTwilioConfigMutation.isPending}
                      >
                        {updateTwilioConfigMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Configuration"
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>
            {/* Notification Settings */}
            <div>
              <div className="flex items-center mb-8">
                <Bell className="h-6 w-6 mr-3 text-blue-500" />
                <h1 className="text-3xl font-bold text-gray-900">
                  Notification Settings
                </h1>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Global Notification Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Email Notifications */}
                  <div className="border-b pb-4">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <Label className="text-lg font-medium">Email Notifications</Label>
                        <p className="text-sm text-gray-500">Send compliance updates via email</p>
                      </div>
                      <Switch
                        checked={notifications?.some(n => n.type === 'email' && n.enabled)}
                        onCheckedChange={(checked) => {
                          if (notifications) {
                            const emailNotif = notifications.find(n => n.type === 'email');
                            if (emailNotif) {
                              updateNotificationMutation.mutate({
                                ...emailNotif,
                                enabled: checked,
                              });
                            }
                          }
                        }}
                      />
                    </div>
                    <div className="ml-4">
                      <Label>Default Frequency</Label>
                      <Select
                        defaultValue={notifications?.find(n => n.type === 'email')?.frequency || 'daily'}
                        onValueChange={(value) => {
                          if (notifications) {
                            const emailNotif = notifications.find(n => n.type === 'email');
                            if (emailNotif) {
                              updateNotificationMutation.mutate({
                                ...emailNotif,
                                frequency: value,
                              });
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* SMS Notifications */}
                  <div className="pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <Label className="text-lg font-medium">SMS Notifications</Label>
                        <p className="text-sm text-gray-500">Send compliance updates via SMS</p>
                      </div>
                      <Switch
                        checked={notifications?.some(n => n.type === 'sms' && n.enabled)}
                        onCheckedChange={(checked) => {
                          if (notifications) {
                            const smsNotif = notifications.find(n => n.type === 'sms');
                            if (smsNotif) {
                              updateNotificationMutation.mutate({
                                ...smsNotif,
                                enabled: checked,
                              });
                            }
                          }
                        }}
                      />
                    </div>
                    <div className="ml-4">
                      <Label>Default Frequency</Label>
                      <Select
                        defaultValue={notifications?.find(n => n.type === 'sms')?.frequency || 'weekly'}
                        onValueChange={(value) => {
                          if (notifications) {
                            const smsNotif = notifications.find(n => n.type === 'sms');
                            if (smsNotif) {
                              updateNotificationMutation.mutate({
                                ...smsNotif,
                                frequency: value,
                              });
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}