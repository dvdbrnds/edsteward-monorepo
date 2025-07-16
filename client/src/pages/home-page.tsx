import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import Navigation from "@/components/layout/navigation";
import ComplianceOverview from "@/components/dashboard/compliance-overview";
import UpcomingDeadlines from "@/components/dashboard/upcoming-deadlines";
import RegulationList from "@/components/regulations/regulation-list";
import { AppliesToFilter } from "@/components/filters/applies-to-filter";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bell, CheckCircle, XCircle, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Notification } from "@shared/schema";

export default function HomePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedInstitutionTypes, setSelectedInstitutionTypes] = useState<string[]>([]);

  // Check if we're in admin mode and redirect admin users to admin dashboard
  useEffect(() => {
    const isAdminMode = import.meta.env.VITE_ADMIN_MODE === 'true' || window.location.hostname.includes('admin');
    if (user?.role?.toLowerCase() === "admin" && isAdminMode) {
      setLocation("/admin/dashboard");
      return;
    }
  }, [user, setLocation]);

  const { data: notifications, isLoading: notificationsLoading, error } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", "v2"],
  });



  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-[#002147] mb-8">
            Welcome, {user?.username}
          </h1>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 mb-8 items-stretch">
            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 items-stretch h-full">
                <ComplianceOverview
                  onCategorySelect={setSelectedCategory}
                  selectedCategory={selectedCategory}
                />
                <UpcomingDeadlines
                  categoryFilter={selectedCategory}
                />
              </div>
            </div>

            {/* Recent Notifications Card */}
            <Card className="h-[600px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-blue-500" />
                  Recent Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-2 max-h-[515px] overflow-y-auto pr-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400 px-6 pb-4">
                  {notificationsLoading ? (
                    <p className="text-gray-500 text-center py-4">Loading notifications...</p>
                  ) : Array.isArray(notifications) && notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {notification.enabled ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <div>
                            <p className="font-medium">
                              {notification.type === 'email' ? 'Email' : 'SMS'} Notification
                            </p>
                            <p className="text-sm text-gray-500">
                              Frequency: {notification.frequency}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      No recent notifications
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Board of Trustees Dashboard Card */}
          <Card className="mt-8 mb-6 bg-gradient-to-r from-slate-50 to-blue-50 border-blue-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Board of Trustees Dashboard
              </CardTitle>
              <CardDescription>
                A public dashboard with compliance insights for trustees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600 max-w-xl">
                  Access the view-only dashboard providing an overview of our regulatory compliance status.
                  This dashboard is designed specifically for the board of trustees to monitor compliance metrics
                  and receive status updates.
                </p>
                <Button asChild className="gap-2">
                  <Link href="/public-dashboard">
                    <span>Open Trustees Dashboard</span>
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Regulations List Section */}
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {selectedCategory ? `${selectedCategory} Regulations` : 'All Regulations'}
            </h2>

            {/* Filters Section */}
            <div className="mb-6">
              <AppliesToFilter
                selectedInstitutionTypes={selectedInstitutionTypes}
                onInstitutionTypesChange={setSelectedInstitutionTypes}
                compact={true}
              />
            </div>

            <RegulationList
              categoryFilter={selectedCategory}
              jurisdictionFilter={null}
              appliesToFilter={selectedInstitutionTypes}
            />
          </div>
        </div>
      </main>
    </div>
  );
}