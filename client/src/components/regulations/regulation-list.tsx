import { useQuery } from "@tanstack/react-query";
import type { Regulation, Deadline } from "@shared/schema";
import { useLocation } from "wouter";
import { Search, ExternalLink, CheckCircle, AlertCircle, Clock, Loader2 } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";

interface RegulationListProps {
  categoryFilter: string | null;
}

type StatusType = {
  icon: JSX.Element;
  label: string;
  className: string;
  date: string;
};

export default function RegulationList({ categoryFilter }: RegulationListProps) {
  const [search, setSearch] = useState("");
  const [_, navigate] = useLocation();

  const { data: regulations, isLoading: regulationsLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  const { data: deadlines, isLoading: deadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
  });

  if (regulationsLoading || deadlinesLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-4">
            <Loader2 className="h-6 w-6 animate-spin text-[#00267A]" />
            <span>Loading regulations...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleRowClick = (regulation: Regulation) => {
    if (regulation && regulation.id) {
      console.log('[RegulationList] Clicking regulation:', {
        id: regulation.id,
        topic: regulation.topic,
        navigationPath: `/regulations/${regulation.id}`
      });
      navigate(`/regulations/${regulation.id}`);
    }
  };

  const getDeadlineStatus = (regulationId: number): StatusType | null => {
    if (!deadlines?.length) return null;

    const regulationDeadlines = deadlines.filter(d => d.regulationId === regulationId);
    if (!regulationDeadlines.length) return null;

    const nextDeadline = regulationDeadlines.sort((a, b) =>
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    )[0];

    const daysUntilDue = differenceInDays(new Date(nextDeadline.dueDate), new Date());

    if (nextDeadline.status === "completed") {
      return {
        icon: <CheckCircle className="h-5 w-5 text-green-500" />,
        label: "Completed",
        className: "text-green-600",
        date: format(new Date(nextDeadline.dueDate), "PP")
      };
    }

    if (nextDeadline.status === "overdue" || daysUntilDue < 0) {
      return {
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
        label: "Overdue",
        className: "text-red-600",
        date: format(new Date(nextDeadline.dueDate), "PP")
      };
    }

    if (daysUntilDue <= 7) {
      return {
        icon: <Clock className="h-5 w-5 text-yellow-500" />,
        label: "Due Soon",
        className: "text-yellow-600",
        date: `${format(new Date(nextDeadline.dueDate), "PP")} (${daysUntilDue} ${daysUntilDue === 1 ? 'day' : 'days'} remaining)`
      };
    }

    return {
      icon: <Clock className="h-5 w-5 text-blue-500" />,
      label: "Upcoming",
      className: "text-blue-600",
      date: format(new Date(nextDeadline.dueDate), "PP")
    };
  };


  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search regulations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Statute</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Requirements</TableHead>
                <TableHead>Next Deadline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regulations?.map((regulation) => (
                <TableRow
                  key={regulation.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleRowClick(regulation)}
                >
                  <TableCell className="font-medium">
                    {regulation.itemId}
                  </TableCell>
                  <TableCell>{regulation.topic}</TableCell>
                  <TableCell>{regulation.statute}</TableCell>
                  <TableCell>{regulation.category}</TableCell>
                  <TableCell>
                    {regulation.requirements && regulation.regulationUrl ? (
                      <a
                        href={regulation.regulationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#00267A] hover:text-[#003166] underline decoration-[#00267A] hover:decoration-[#003166] inline-flex items-center gap-2 group"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="break-words">{regulation.requirements}</span>
                        <ExternalLink className="h-3 w-3 text-[#00267A] group-hover:text-[#003166] transition-colors" />
                      </a>
                    ) : regulation.requirements || "N/A"}
                  </TableCell>
                  <TableCell>
                    {getDeadlineStatus(regulation.id) ? (
                      <div className="flex items-center gap-2">
                        {getDeadlineStatus(regulation.id)!.icon}
                        <span className={getDeadlineStatus(regulation.id)!.className}>
                          {getDeadlineStatus(regulation.id)!.label}: {getDeadlineStatus(regulation.id)!.date}
                        </span>
                      </div>
                    ) : (
                      "No deadlines"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}