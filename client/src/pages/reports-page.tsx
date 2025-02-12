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
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";

// Define custom colors using Moravian's brand colors
const COLORS = [
  '#002147', // Deep blue (Moravian primary)
  '#718096', // Medium grey
  '#003166', // Navy blue
  '#a0aec0', // Light grey
  '#004185', // Royal blue
  '#4a5568', // Dark grey
  '#0052a4', // Bright blue
  '#e2e8f0', // Pale grey
];

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
              // Explicitly set sector props to override defaults
              startAngle={90}
              endAngle={-270}
              style={{ outline: 'none' }}
              isAnimationActive={false} // Disable animation to ensure immediate color application
            >
              {data.map((entry, index) => (
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
                border: `1px solid ${COLORS[0]}`,
                borderRadius: '4px',
                padding: '8px'
              }}
              itemStyle={{ color: COLORS[0] }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              formatter={(value, entry: any) => (
                <span style={{ color: entry.color, padding: '0 8px' }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
);

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

  const categoryChartData = Object.entries(categorySummary).map(([name, value]) => ({
    name,
    value,
  }));

  const deadlineChartData = Object.entries(deadlineSummary).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-8">
            <FileText className="h-6 w-6 mr-3 text-[#002147]" />
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