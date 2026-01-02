import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import Navigation from "@/components/layout/navigation";
import ComplianceOverview from "@/components/dashboard/compliance-overview";
import UpcomingDeadlines from "@/components/dashboard/upcoming-deadlines";
import DashboardStats from "@/components/dashboard/dashboard-stats";
import ExecutiveDashboard from "@/components/dashboard/executive-dashboard";
import MyTasks from "@/components/dashboard/my-tasks";
import PendingAttestations from "@/components/dashboard/pending-attestations";
import DeadlineCalendar from "@/components/dashboard/deadline-calendar";
import RegulationList from "@/components/regulations/regulation-list";
import { AppliesToFilter } from "@/components/filters/applies-to-filter";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bell, CheckCircle, Users, ExternalLink, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Notification as _Notification } from "@shared/schema";

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

  const { data: notificationHistory, isLoading: notificationsLoading } = useQuery<{
    notifications: Array<{
      id: number;
      type: string;
      status: string;
      priority: string;
      content: any;
      createdAt: string;
      sentAt: string | null;
      regulation: { id: number; name: string; category: string } | null;
      user: { id: number; firstName: string; lastName: string; email: string } | null;
    }>;
    total: number;
  }>({
    queryKey: ["/api/notification-history", { status: 'sent', limit: 10 }],
  });



  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Welcome, {user?.username}
            </h1>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="analytics">
              <ExecutiveDashboard />
            </TabsContent>

            <TabsContent value="overview">
          {/* Dashboard Statistics */}
          <div className="mb-8">
            <DashboardStats />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8 items-stretch">
            {/* My Tasks - Most important for compliance officers */}
            <MyTasks />
            
            {/* Pending Attestations - Quick action for attestation requests */}
            <PendingAttestations />
            
            {/* Compliance Overview */}
            <ComplianceOverview
              onCategorySelect={setSelectedCategory}
              selectedCategory={selectedCategory}
            />
            
            {/* Upcoming Deadlines */}
            <UpcomingDeadlines
              categoryFilter={selectedCategory}
            />
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 mb-8">
            {/* Recent Notifications Card */}
            <Card className="min-h-[400px] md:h-[600px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-blue-500" />
                  Recent Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-2 max-h-[300px] md:max-h-[515px] overflow-y-auto pr-3 scrollbar-thin px-6 pb-4">
                  {notificationsLoading ? (
                    <p className="text-muted-foreground text-center py-4">Loading notifications...</p>
                  ) : notificationHistory?.notifications && notificationHistory.notifications.length > 0 ? (
                    notificationHistory.notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-3 border rounded-lg hover:bg-muted transition-colors ${notification.regulation ? 'cursor-pointer hover:border-blue-300' : ''}`}
                        onClick={() => {
                          if (notification.regulation) {
                            window.location.href = `/regulations/${notification.regulation.id}`;
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium text-sm leading-tight overflow-hidden" style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical'
                              }}>
                                {notification.regulation 
                                  ? (
                                    <>
                                      <span className="text-blue-600">
                                        {notification.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                                      </span>
                                      <span className="ml-1">
                                        {notification.regulation.name.length > 60 
                                          ? `${notification.regulation.name.substring(0, 60)}...`
                                          : notification.regulation.name
                                        }
                                      </span>
                                    </>
                                  )
                                  : notification.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                                }
                              </p>
                              {notification.priority === 'high' && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                                  High Priority
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>
                                {new Date(notification.sentAt || notification.createdAt).toLocaleDateString()}
                              </span>
                              {notification.regulation && (
                                <>
                                  <span>•</span>
                                  <span className="text-blue-600 truncate max-w-[120px]">
                                    {notification.regulation.category} →
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      No recent notifications
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Deadline Calendar */}
            <DeadlineCalendar />
          </div>

          {/* Board of Trustees Dashboard Card */}
          <Card className="mt-8 mb-6 bg-gradient-to-r from-muted to-blue-500/10 border-blue-500/20">
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <p className="text-sm text-muted-foreground max-w-xl">
                  Access the view-only dashboard providing an overview of our regulatory compliance status.
                  This dashboard is designed specifically for the board of trustees to monitor compliance metrics
                  and receive status updates.
                </p>
                <Button asChild className="gap-2 w-full sm:w-auto flex-shrink-0">
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
            <h2 className="text-2xl font-bold text-foreground mb-4">
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
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}