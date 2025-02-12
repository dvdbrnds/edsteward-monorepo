import { useQuery } from "@tanstack/react-query";
import type { Regulation, Deadline } from "@shared/schema";
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
import { Search, ExternalLink, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { useLocation } from "wouter";

type SortConfig = {
  key: keyof Regulation;
  direction: 'asc' | 'desc';
} | null;

interface RegulationListProps {
  categoryFilter: string | null;
}

export default function RegulationList({ categoryFilter }: RegulationListProps) {
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [_, navigate] = useLocation();

  const { data: regulations, isLoading: regulationsLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  const { data: deadlines, isLoading: deadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
  });

  const handleRowClick = (regulationId: number) => {
    if (regulationId) {
      navigate(`/regulations/${regulationId}`);
    }
  };

  const sortData = (data: Regulation[]) => {
    if (!sortConfig || !data) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (!aValue && !bValue) return 0;
      if (!aValue) return 1;
      if (!bValue) return -1;

      if (sortConfig.key === 'itemId') {
        const numA = parseInt(aValue as string, 10);
        const numB = parseInt(bValue as string, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
        }
      }

      const comparison = String(aValue).localeCompare(String(bValue));
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  };

  const requestSort = (key: keyof Regulation) => {
    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };

  const getColumnStyle = (key: keyof Regulation) => {
    if (!sortConfig || sortConfig.key !== key) {
      return "cursor-pointer hover:bg-gray-50";
    }
    return "cursor-pointer hover:bg-gray-50 font-bold";
  };

  const getDeadlineStatus = (regulationId: number) => {
    if (!deadlines) return null;

    const regulationDeadlines = deadlines.filter(d => d.regulationId === regulationId);
    if (regulationDeadlines.length === 0) return null;

    // Get the nearest deadline
    const sortedDeadlines = regulationDeadlines.sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );

    const nextDeadline = sortedDeadlines[0];
    const daysUntilDue = differenceInDays(new Date(nextDeadline.dueDate), new Date());

    if (nextDeadline.status === "completed") {
      return {
        icon: <CheckCircle className="h-4 w-4 text-green-500" />,
        label: "Completed",
        className: "text-green-600",
        date: format(new Date(nextDeadline.dueDate), "PP")
      };
    }

    if (nextDeadline.status === "overdue" || daysUntilDue < 0) {
      return {
        icon: <AlertCircle className="h-4 w-4 text-red-500" />,
        label: "Overdue",
        className: "text-red-600",
        date: format(new Date(nextDeadline.dueDate), "PP")
      };
    }

    if (daysUntilDue <= 7) {
      return {
        icon: <Clock className="h-4 w-4 text-yellow-500" />,
        label: "Due Soon",
        className: "text-yellow-600",
        date: `${format(new Date(nextDeadline.dueDate), "PP")} (${daysUntilDue} ${daysUntilDue === 1 ? 'day' : 'days'} remaining)`
      };
    }

    return {
      icon: <Clock className="h-4 w-4 text-blue-500" />,
      label: "Upcoming",
      className: "text-blue-600",
      date: format(new Date(nextDeadline.dueDate), "PP")
    };
  };

  const filteredRegulations = regulations?.filter((reg) => {
    const matchesSearch =
      reg.topic.toLowerCase().includes(search.toLowerCase()) ||
      reg.statute.toLowerCase().includes(search.toLowerCase()) ||
      reg.itemId.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = !categoryFilter || reg.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(
    new Set(regulations?.map((reg) => reg.category))
  ).sort();

  if (regulationsLoading || deadlinesLoading) {
    return <div>Loading...</div>;
  }

  const sortedRegulations = sortData(filteredRegulations || []);

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
              {sortedRegulations?.map((regulation) => (
                <TableRow
                  key={regulation.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleRowClick(regulation.id)}
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
                    {deadlineStatus ? (
                      <div className="flex items-center gap-2">
                        {deadlineStatus.icon}
                        <span className={deadlineStatus.className}>
                          {deadlineStatus.label}: {deadlineStatus.date}
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