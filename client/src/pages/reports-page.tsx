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
import { Download, FileText, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";

// Moravian University official brand colors - same as compliance-overview.tsx
const COLORS = [
  '#CCCCCC', // Moravian Grey
  '#00267A', // Moravian Blue
  '#001B56', // Dark Blue
  '#666666', // Dark Grey
  '#078CF5', // Accent Blue
  '#E58200', // Gold
  '#BC204B', // Red
  '#006668', // Deep Green
];

type SortConfig = {
  key: keyof Regulation;
  direction: 'asc' | 'desc';
} | null;

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

const CustomPieChart = ({ data, title }: { data: any[], title: string }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex justify-between items-center">
        {title}
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadCSV(
            data.map(({ name, value }) => ({
              [title.toLowerCase().replace(/ /g, '_')]: name,
              count: value,
            })),
            `${title.toLowerCase().replace(/ /g, '-')}.csv`
          )}
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              style={{ outline: 'none' }}
              isAnimationActive={false}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  stroke="white"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: `1px solid ${COLORS[1]}`,
                borderRadius: '4px',
                padding: '8px'
              }}
              itemStyle={{ color: COLORS[1] }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              formatter={(value) => (
                <span className="text-[#666666] ml-2">{value}</span>
              )}
              wrapperStyle={{
                paddingTop: '20px'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
);

export default function ReportsPage() {
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const { data: regulations, isLoading: regulationsLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  const { data: deadlines, isLoading: deadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
  });

  const sortData = (data: Regulation[]) => {
    if (!sortConfig || !data) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // Handle null values
      if (!aValue && !bValue) return 0;
      if (!aValue) return 1;
      if (!bValue) return -1;

      // Special handling for lastUpdated dates
      if (sortConfig.key === 'lastUpdated') {
        const dateA = new Date(aValue as string).getTime();
        const dateB = new Date(bValue as string).getTime();
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }

      // Special handling for itemId (numeric string comparison)
      if (sortConfig.key === 'itemId') {
        const numA = parseInt(aValue as string, 10);
        const numB = parseInt(bValue as string, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
        }
      }

      // Default string comparison
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

  const categoryChartData = Object.entries(categorySummary).map(([name, value]) => ({
    name,
    value,
  }));

  const deadlineChartData = Object.entries(deadlineSummary).map(([name, value]) => ({
    name,
    value,
  }));

  const sortedRegulations = regulations ? sortData(regulations) : [];

  const getSortIcon = (key: keyof Regulation) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ChevronUp className="h-4 w-4 text-gray-400" />;
    }
    return sortConfig.direction === 'asc'
      ? <ChevronUp className="h-4 w-4" />
      : <ChevronDown className="h-4 w-4" />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-8">
            <FileText className="h-6 w-6 mr-3 text-[#00267A]" />
            <h1 className="text-3xl font-bold text-gray-900">
              Compliance Reports
            </h1>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 mb-8">
            <CustomPieChart
              data={categoryChartData}
              title="Regulations by Category"
            />
            <CustomPieChart
              data={deadlineChartData}
              title="Deadlines by Status"
            />
          </div>

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
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => requestSort('itemId')}
                    >
                      <div className="flex items-center gap-2">
                        ID {getSortIcon('itemId')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => requestSort('topic')}
                    >
                      <div className="flex items-center gap-2">
                        Topic {getSortIcon('topic')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => requestSort('category')}
                    >
                      <div className="flex items-center gap-2">
                        Category {getSortIcon('category')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => requestSort('lastUpdated')}
                    >
                      <div className="flex items-center gap-2">
                        Last Updated {getSortIcon('lastUpdated')}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRegulations.map((regulation) => (
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