import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { Deadline } from "@shared/schema";
import { format } from "date-fns";
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
          {sortedDeadlines.map((deadline) => (
            <div
              key={deadline.id}
              className="flex items-center justify-between p-4 bg-white border rounded-lg"
            >
              <div className="flex items-center space-x-4">
                {deadline.status === "completed" ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : deadline.status === "overdue" ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <Clock className="h-5 w-5 text-yellow-500" />
                )}
                <div>
                  <p className="font-medium text-gray-900">
                    Regulation #{deadline.regulationId}
                  </p>
                  <p className="text-sm text-gray-500">
                    Due: {format(new Date(deadline.dueDate), "PP")}
                  </p>
                </div>
              </div>
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  deadline.status === "completed"
                    ? "bg-green-100 text-green-800"
                    : deadline.status === "overdue"
                    ? "bg-red-100 text-red-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {deadline.status}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
