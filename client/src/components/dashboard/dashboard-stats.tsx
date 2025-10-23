import { useQuery } from "@tanstack/react-query";
import type { Regulation, Deadline } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, AlertTriangle, CheckCircle } from "lucide-react";

export default function DashboardStats() {
  const { data: regulations, isLoading: regulationsLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  const { data: deadlines, isLoading: deadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
  });

  if (regulationsLoading || deadlinesLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const totalRegulations = Array.isArray(regulations) ? regulations.length : 0;
  const totalDeadlines = Array.isArray(deadlines) ? deadlines.length : 0;
  
  // Calculate deadline statistics
  const now = new Date();
  const upcomingDeadlines = deadlines?.filter(deadline => {
    const dueDate = new Date(deadline.dueDate);
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue >= 0 && daysUntilDue <= 30 && deadline.status !== "completed";
  }) || [];

  const overdueDeadlines = deadlines?.filter(deadline => {
    const dueDate = new Date(deadline.dueDate);
    return dueDate < now && deadline.status !== "completed";
  }) || [];

  const completedDeadlines = deadlines?.filter(deadline => 
    deadline.status === "completed"
  ) || [];

  const stats = [
    {
      title: "Total Regulations",
      value: totalRegulations,
      description: "Regulations being tracked",
      icon: FileText,
      color: "text-blue-600",
    },
    {
      title: "Upcoming Deadlines",
      value: upcomingDeadlines.length,
      description: "Due within 30 days",
      icon: Clock,
      color: "text-yellow-600",
    },
    {
      title: "Overdue Items",
      value: overdueDeadlines.length,
      description: "Require immediate attention",
      icon: AlertTriangle,
      color: "text-red-600",
    },
    {
      title: "Completed",
      value: completedDeadlines.length,
      description: "Tasks completed",
      icon: CheckCircle,
      color: "text-green-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
