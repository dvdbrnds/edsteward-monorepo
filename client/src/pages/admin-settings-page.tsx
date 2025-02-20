import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { EmailConfig } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEmailConfigSchema } from "@shared/schema";
import { insertTwilioConfigSchema } from "@shared/schema"; // Added import for Twilio schema
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
import { Mail, Loader2, Bell } from "lucide-react"; // Added Bell icon import
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";
import type { z } from "zod";
import type { TwilioConfig } from "@shared/schema"; // Added import for TwilioConfig type


type FormValues = z.infer<typeof insertEmailConfigSchema>;
type TwilioFormValues = z.infer<typeof insertTwilioConfigSchema>;

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Redirect non-admin users
  if (user?.role !== "admin") {
    return <Redirect to="/" />;
  }

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

  if (emailLoading || twilioLoading) {
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
                <Bell className="h-6 w-6 mr-3 text-blue-500" />
                <h1 className="text-3xl font-bold text-gray-900">
                  SMS Configuration
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
          </div>
        </div>
      </main>
    </div>
  );
}