import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { Deadline } from "@shared/schema";
import { format, differenceInDays } from "date-fns";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";

export default function UpcomingDeadlines() {
  const { data: deadlines, isLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
  });

  if (isLoading || !deadlines) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Deadlines</CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    );
  }

  const getStatusDetails = (deadline: Deadline) => {
    if (deadline.status === "completed") {
      return {
        icon: <CheckCircle className="h-5 w-5 text-green-500" />,
        bgColor: "bg-green-100",
        textColor: "text-green-800"
      };
    }

    const daysUntilDue = differenceInDays(new Date(deadline.dueDate), new Date());

    if (deadline.status === "overdue" || daysUntilDue < 0) {
      return {
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
        bgColor: "bg-red-100",
        textColor: "text-red-800"
      };
    }

    if (daysUntilDue <= 7) {
      return {
        icon: <Clock className="h-5 w-5 text-yellow-500" />,
        bgColor: "bg-yellow-100",
        textColor: "text-yellow-800"
      };
    }

    return {
      icon: <Clock className="h-5 w-5 text-blue-500" />,
      bgColor: "bg-blue-100",
      textColor: "text-blue-800"
    };
  };

  const sortedDeadlines = [...deadlines].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Deadlines</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedDeadlines.map((deadline) => {
            const { icon, bgColor, textColor } = getStatusDetails(deadline);
            const daysUntilDue = differenceInDays(new Date(deadline.dueDate), new Date());

            return (
              <div
                key={deadline.id}
                className="flex items-center justify-between p-4 bg-white border rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  {icon}
                  <div>
                    <p className="font-medium text-gray-900">
                      Regulation #{deadline.regulationId}
                    </p>
                    <p className="text-sm text-gray-500">
                      Due: {format(new Date(deadline.dueDate), "PP")}
                      {daysUntilDue > 0 && deadline.status !== "completed" && (
                        <span className="ml-2">
                          ({daysUntilDue} {daysUntilDue === 1 ? 'day' : 'days'} remaining)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${bgColor} ${textColor}`}
                >
                  {deadline.status === "completed" 
                    ? "Completed"
                    : daysUntilDue < 0 
                    ? "Overdue"
                    : daysUntilDue <= 7 
                    ? "Due Soon"
                    : "Upcoming"}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}