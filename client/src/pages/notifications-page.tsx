import Navigation from "@/components/layout/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Bell } from "lucide-react";

export default function NotificationsPage() {
  const { user } = useAuth();

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const updateNotificationMutation = useMutation({
    mutationFn: async (notification: Notification) => {
      const res = await apiRequest("POST", "/api/notifications", notification);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Notification preferences updated",
        description: "Your notification settings have been saved.",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            Loading...
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
          <div className="flex items-center mb-8">
            <Bell className="h-6 w-6 mr-3 text-blue-500" />
            <h1 className="text-3xl font-bold text-gray-900">
              Notification Settings
            </h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Manage Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Notifications */}
              <div className="border-b pb-4">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <Label className="text-lg font-medium">Email Notifications</Label>
                    <p className="text-sm text-gray-500">Receive updates via email</p>
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
                  <Label>Frequency</Label>
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
                    <p className="text-sm text-gray-500">Receive updates via SMS</p>
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
                  <Label>Frequency</Label>
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
      </main>
    </div>
  );
}
