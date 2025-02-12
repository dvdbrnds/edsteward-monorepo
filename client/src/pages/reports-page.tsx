import Navigation from "@/components/layout/navigation";
import { useQuery } from "@tanstack/react-query";
import type { Regulation, Deadline } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

function downloadCSV(data: any[], filename: string) {
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => row[header]).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { data: regulations, isLoading: regulationsLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  const { data: deadlines, isLoading: deadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
  });

  if (regulationsLoading || deadlinesLoading) {
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

  const categorySummary = regulations?.reduce((acc, reg) => {
    acc[reg.category] = (acc[reg.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const deadlineSummary = deadlines?.reduce((acc, deadline) => {
    acc[deadline.status] = (acc[deadline.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-8">
            <FileText className="h-6 w-6 mr-3 text-blue-500" />
            <h1 className="text-3xl font-bold text-gray-900">
              Compliance Reports
            </h1>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 mb-8">
            {/* Category Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Regulations by Category
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadCSV(
                      Object.entries(categorySummary).map(([category, count]) => ({
                        category,
                        count,
                      })),
                      'regulations-by-category.csv'
                    )}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(categorySummary).map(([category, count]) => (
                      <TableRow key={category}>
                        <TableCell>{category}</TableCell>
                        <TableCell className="text-right">{count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Deadline Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Deadlines by Status
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadCSV(
                      Object.entries(deadlineSummary).map(([status, count]) => ({
                        status,
                        count,
                      })),
                      'deadlines-by-status.csv'
                    )}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(deadlineSummary).map(([status, count]) => (
                      <TableRow key={status}>
                        <TableCell className="capitalize">{status}</TableCell>
                        <TableCell className="text-right">{count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Regulations Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                Detailed Regulations Report
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadCSV(regulations || [], 'regulations-detailed.csv')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regulations?.map((regulation) => (
                    <TableRow key={regulation.id}>
                      <TableCell>{regulation.itemId}</TableCell>
                      <TableCell>{regulation.topic}</TableCell>
                      <TableCell>{regulation.category}</TableCell>
                      <TableCell>
                        {regulation.lastUpdated
                          ? format(new Date(regulation.lastUpdated), "PP")
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
