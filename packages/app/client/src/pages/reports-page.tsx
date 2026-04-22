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
import { Download, FileText, X, CheckCircle, AlertCircle, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// Extended color palette with Moravian brand colors and complementary shades
const COLORS = [
  '#00267A', // Moravian Primary Blue
  '#BC204B', // Moravian Primary Red
  '#E58200', // Moravian Primary Gold
  '#434343', // Moravian Primary Grey
  '#001B56', // Moravian Dark Blue
  '#8B0000', // Moravian Dark Red
  '#C17000', // Moravian Dark Gold
  '#666666', // Moravian Dark Grey
  '#4DB6FF', // Moravian Light Blue
  '#FF9EBB', // Moravian Light Red
  '#FFB347', // Moravian Light Gold
  '#CCCCCC', // Moravian Light Grey
  '#2563eb', //Added
  '#16a34a', //Added
  '#dc2626', //Added
  '#ca8a04', //Added
  '#9333ea', //Added
  '#0891b2', //Added
  '#be185d', //Added
  '#ea580c'  //Added
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

const CustomPieChart = ({
  data,
  title,
  onSegmentClick,
  activeFilter,
}: {
  data: any[],
  title: string,
  onSegmentClick: (name: string) => void,
  activeFilter: string | null,
}) => {
  // Sort data by value for the pie chart while keeping a separate sorted copy for the legend
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  const legendData = [...data].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {title}
            {activeFilter && (
              <Button
                variant="outline"
                size="sm"
                className="ml-2"
                onClick={() => onSegmentClick("")}
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filter
              </Button>
            )}
          </div>
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
                data={sortedData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                style={{ outline: 'none' }}
                isAnimationActive={false}
                onClick={(entry) => onSegmentClick(entry.name)}
                className="cursor-pointer"
              >
                {sortedData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    stroke="white"
                    strokeWidth={2}
                    opacity={activeFilter && activeFilter !== entry.name ? 0.5 : 1}
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
                height={80}
                iconType="circle"
                payload={legendData.map((entry, _index) => ({
                  value: entry.name,
                  type: 'circle',
                  color: COLORS[sortedData.findIndex(d => d.name === entry.name) % COLORS.length],
                  id: entry.name
                }))}
                formatter={(value) => (
                  <span
                    className={`
                      text-[#666666]
                      ml-2
                      cursor-pointer
                      inline-flex
                      items-center
                      ${value.length > 15 ? 'text-xs' : 'text-sm'}
                      ${activeFilter === value ? 'font-bold' : ''}
                    `}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSegmentClick(value as string)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSegmentClick(value as string); }}
                  >
                    {value}
                  </span>
                )}
                wrapperStyle={{
                  paddingTop: '20px',
                  paddingBottom: '10px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '8px',
                  width: '100%'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

const getAgencyName = (url: string | null): string => {
  if (!url) return "N/A";

  const urlMap: Record<string, string> = {
    "www.ed.gov": "Department of Education",
    "www.eeoc.gov": "Equal Employment Opportunity Commission",
    "www.justice.gov": "Department of Justice",
    "www.osha.gov": "Occupational Safety and Health Administration",
    "www.dhs.gov": "Department of Homeland Security"
  };

  try {
    const hostname = new URL(url).hostname;
    return urlMap[hostname] || hostname;
  } catch {
    return url;
  }
};

const getCongressUrl = (statute: string): string | null => {
  if (!statute) return null;

  try {
    

    // Check for common acts first using the lookup table from congress-gov-links.md
    const commonActs: Record<string, string> = {
      'Higher Education Act': 'https://www.congress.gov/browse/uscode/20/section/1092',
      'Higher Education Act: Textbook Information': 'https://www.congress.gov/browse/uscode/20/section/1015',
      'Section 504 of The Rehabilitation Act': 'https://www.congress.gov/browse/uscode/29/section/794',
      'Drug Free Schools and Communities Act': 'https://www.congress.gov/browse/uscode/20/section/1011i',
      'Family Educational Rights and Privacy Act': 'https://www.congress.gov/browse/uscode/20/section/1232g',
      'FERPA': 'https://www.congress.gov/browse/uscode/20/section/1232g',
      'Americans with Disabilities Act': 'https://www.congress.gov/browse/uscode/42/section/12101',
      'Title IX': 'https://www.congress.gov/browse/uscode/20/sections/1681-1688'
    };

    for (const [actName, url] of Object.entries(commonActs)) {
      if (statute.toLowerCase().includes(actName.toLowerCase())) {
        return url;
      }
    }

    // Handle U.S. Code citations with section ranges
    // Match patterns like: "42 U.S.C. §§ 12101-12213"
    const rangeMatch = statute.match(/(\d+)\s*U\.?S\.?C\.?\s*§§\s*(\d+)-(\d+)/i);
    if (rangeMatch) {
      const [_, title, start] = rangeMatch;
      return `https://www.congress.gov/browse/uscode/${title.trim()}/sections/${start.trim()}-${rangeMatch[3].trim()}`;
    }

    // Handle single U.S. Code citations
    // Match patterns like: "20 U.S.C. § 1232g" or "29 USC 621"
    const uscMatch = statute.match(/(\d+)\s*U\.?S\.?C\.?\s*(?:§+|\s+)?(\d+[a-z]?)(?:-\d+)?/i);
    if (uscMatch) {
      const [_, title, section] = uscMatch;
      return `https://www.congress.gov/browse/uscode/${title.trim()}/section/${section.trim()}`;
    }

    // Handle Public Law citations
    // Match patterns like: "Public Law 110-315" or "Pub. L. No. 110-315"
    const publicLawMatch = statute.match(/(?:Public\s+Law|Pub\.\s*L\.)\s*(?:No\.)?\s*(\d+)-(\d+)/i);
    if (publicLawMatch) {
      const [_, congress, lawNumber] = publicLawMatch;
      const cleanCongress = congress.trim();
      const cleanLawNumber = lawNumber.trim().padStart(3, '0');
      return `https://www.congress.gov/public-laws/${cleanCongress}th-congress/public-law/${cleanLawNumber}`;
    }

    
    return null;
  } catch (error) {
    console.error('Error processing statute citation:', error);
    return null;
  }
};

export default function ReportsPage() {
  const [_location, setLocation] = useLocation();
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const { toast: _toast } = useToast();

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

      if (!aValue && !bValue) return 0;
      if (!aValue) return 1;
      if (!bValue) return -1;

      if (sortConfig.key === 'lastUpdated') {
        const dateA = new Date(aValue as string).getTime();
        const dateB = new Date(bValue as string).getTime();
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }

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

  const _requestSort = (key: keyof Regulation) => {
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

  const _getColumnStyle = (key: keyof Regulation) => {
    if (!sortConfig || sortConfig.key !== key) {
      return "cursor-pointer hover:bg-background";
    }
    return "cursor-pointer hover:bg-background font-bold";
  };

  if (regulationsLoading || deadlinesLoading) {
    return (
      <div className="min-h-screen bg-background">
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

  const _calculateDeadlineStatus = (deadline: any) => {
    const today = new Date();
    const dueDate = new Date(deadline.dueDate);
    if (deadline.status === "completed") return "completed";
    return dueDate < today ? "overdue" : "pending";
  };

  const deadlineSummary = deadlines?.reduce((acc: Record<string, number>, deadline) => {
    if (!acc.completed) acc.completed = 0;
    if (!acc.overdue) acc.overdue = 0;
    if (!acc.pending) acc.pending = 0;

    if (deadline.status === "completed") {
      acc.completed += 1;
    } else {
      const today = new Date();
      const dueDate = new Date(deadline.dueDate);
      acc[dueDate < today ? "overdue" : "pending"] += 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const categoryChartData = Object.entries(categorySummary).map(([name, value]) => ({
    name,
    value,
  }));

  const deadlineChartData = Object.entries(deadlineSummary || {}).map(([name, value]) => {
    const displayName = name === "completed"
      ? "Completed"
      : name === "overdue"
      ? "Overdue"
      : "Pending";
    return {
      name: displayName,
      value,
    };
  });

  const _getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600";
      case "overdue":
        return "text-red-600";
      default:
        return "text-yellow-600";
    }
  };

  // Filter regulations based on selected category and status
  let filteredRegulations = regulations || [];

  if (categoryFilter) {
    filteredRegulations = filteredRegulations.filter(reg => reg.category === categoryFilter);
  }

  if (statusFilter) {
    const statusMap = {
      "Completed": "completed",
      "Overdue": "overdue",
      "Pending": "pending"
    };
    const filterStatus = statusMap[statusFilter as keyof typeof statusMap];

    filteredRegulations = filteredRegulations.filter(reg => {
      const regDeadlines = deadlines?.filter(d => d.regulationId === reg.id) || [];
      return regDeadlines.some(d => d.status === filterStatus);
    });
  }

  const sortedRegulations = sortData(filteredRegulations);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <FileText className="h-6 w-6 mr-3 text-[#00267A]" />
              <h1 className="text-3xl font-bold text-foreground">
                Compliance Reports
              </h1>
            </div>

          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 mb-8">
            <CustomPieChart
              data={categoryChartData}
              title="Regulations by Category"
              onSegmentClick={setCategoryFilter}
              activeFilter={categoryFilter}
            />
            <CustomPieChart
              data={deadlineChartData}
              title="Deadlines by Status"
              onSegmentClick={setStatusFilter}
              activeFilter={statusFilter}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  Detailed Regulations Report
                  {(categoryFilter || statusFilter) && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {categoryFilter && `Category: ${categoryFilter}`}
                      {categoryFilter && statusFilter && " | "}
                      {statusFilter && `Status: ${statusFilter}`}
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadCSV(sortedRegulations, 'regulations-detailed.csv')}
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
                    <TableHead>Name</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Agency Info</TableHead>
                    <TableHead>Next Deadline</TableHead>
                    <TableHead>Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRegulations.map((regulation) => {
                    const regulationDeadlines = deadlines?.filter(d => d.regulationId === regulation.id) || [];
                    const nextDeadline = regulationDeadlines.length > 0
                      ? regulationDeadlines.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
                      : null;

                    const congressUrl = getCongressUrl(regulation.statute);

                    return (
                      <TableRow
                        key={regulation.id}
                        className="cursor-pointer hover:bg-background"
                        onClick={() => setLocation(`/regulations/${regulation.id}`)}
                      >
                        <TableCell>{regulation.itemId}</TableCell>
                        <TableCell>{regulation.name || regulation.statute}</TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground mt-1">
                            {regulation.topic}
                          </div>
                        </TableCell>
                        <TableCell>{regulation.category}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="text-sm">
                              {regulation.agency_name || getAgencyName(regulation.agency_url)}
                            </div>
                            {regulation.agency_url && (
                              <a
                                href={regulation.agency_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#00267A] hover:text-[#003166] underline inline-flex items-center gap-1 text-sm group"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View Agency Page
                                <ExternalLink className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                              </a>
                            )}
                            {congressUrl && (
                              <a
                                href={congressUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#00267A] hover:text-[#003166] underline inline-flex items-center gap-1 text-sm group"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View on congress.gov
                                <ExternalLink className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {nextDeadline ? (
                            <div className="flex items-center gap-2">
                              {nextDeadline.status === "completed" ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : nextDeadline.status === "overdue" ? (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              ) : (
                                <Clock className="h-4 w-4 text-yellow-500" />
                              )}
                              <span className={
                                nextDeadline.status === "completed"
                                  ? "text-green-600"
                                  : nextDeadline.status === "overdue"
                                  ? "text-red-600"
                                  : "text-yellow-600"
                              }>
                                {format(new Date(nextDeadline.dueDate), "PP")}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No deadlines</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {regulation.lastUpdated
                            ? format(new Date(regulation.lastUpdated), "PP")
                            : "N/A"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}