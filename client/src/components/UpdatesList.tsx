import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

type RegulationUpdate = {
  id: number;
  name: string;
  changes: {
    added: number;
    removed: number;
    changed: number;
  };
  priority: "HIGH" | "MEDIUM" | "LOW";
  date: string;
};

export default function UpdatesList() {
  const [, navigate] = useLocation();
  const [sortField, setSortField] = useState<"name" | "priority" | "date">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Fetch pending regulation updates
  const { data: updates, isLoading, error } = useQuery<RegulationUpdate[]>({
    queryKey: ["/api/regulations/updates"],
    refetchOnWindowFocus: false,
  });

  const handleSort = (field: "name" | "priority" | "date") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedUpdates = updates
    ? [...updates].sort((a, b) => {
        if (sortField === "name") {
          return sortDirection === "asc"
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        } else if (sortField === "priority") {
          const priorityValue = { HIGH: 3, MEDIUM: 2, LOW: 1 };
          return sortDirection === "asc"
            ? priorityValue[a.priority] - priorityValue[b.priority]
            : priorityValue[b.priority] - priorityValue[a.priority];
        } else {
          // date
          return sortDirection === "asc"
            ? new Date(a.date).getTime() - new Date(b.date).getTime()
            : new Date(b.date).getTime() - new Date(a.date).getTime();
        }
      })
    : [];

  const getPriorityBadgeClass = (priority: string) => {
    if (priority === "HIGH") return "bg-red-100 text-red-800";
    if (priority === "MEDIUM") return "bg-yellow-100 text-yellow-800";
    return "bg-blue-100 text-blue-800";
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner className="w-10 h-10" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-500">
            <p>Error loading updates. Please try again later.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Pending Regulation Updates</CardTitle>
        <CardDescription>
          Review and process updates to regulatory documents
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("name")}
                >
                  Title {sortField === "name" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead>Changes</TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("priority")}
                >
                  Priority {sortField === "priority" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("date")}
                >
                  Date {sortField === "date" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUpdates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">
                    No pending updates at this time
                  </TableCell>
                </TableRow>
              ) : (
                sortedUpdates.map((update) => (
                  <TableRow key={update.id} className="hover:bg-muted/50">
                    <TableCell>{update.name}</TableCell>
                    <TableCell>
                      <span className="text-green-600">+{update.changes.added}%</span>{" "}
                      <span className="text-red-600">-{update.changes.removed}%</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityBadgeClass(update.priority)}>
                        {update.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(update.date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/regulations/updates/${update.id}`)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}