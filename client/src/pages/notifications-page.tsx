import Navigation from "@/components/layout/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import type { Notification } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, CheckCircle, XCircle } from "lucide-react";

export default function NotificationsPage() {
  const { user } = useAuth();

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
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
              Notifications
            </h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {notifications?.map((notification) => (
                <div 
                  key={notification.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {notification.enabled ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium">{notification.type === 'email' ? 'Email' : 'SMS'} Notification</p>
                      <p className="text-sm text-gray-500">
                        Frequency: {notification.frequency}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {(!notifications || notifications.length === 0) && (
                <p className="text-gray-500 text-center py-4">
                  No notifications found
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
