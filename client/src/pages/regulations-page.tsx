import Navigation from "@/components/layout/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, X, FileCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import type { Regulation, Deadline } from "@shared/schema";
import { useLocation } from "wouter";
import RegulationList from "@/components/regulations/regulation-list";

// Moravian University brand colors
const COLORS = [
  '#00267A', // Moravian Blue - Primary
  '#001B56', // Dark Blue
  '#078CF5', // Accent Blue
  '#E58200', // Gold
  '#BC204B', // Red
  '#006668', // Deep Green
  '#666666', // Dark Grey
  '#CCCCCC', // Moravian Grey
];

const CategoryPieChart = ({
  data,
  onSegmentClick,
  activeFilter,
}: {
  data: any[],
  onSegmentClick: (name: string) => void,
  activeFilter: string | null,
}) => (
  <Card className="mb-8">
    <CardHeader>
      <CardTitle className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          Regulations by Category
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
              onClick={(entry) => onSegmentClick(entry.name)}
              className="cursor-pointer"
            >
              {data.map((entry, index) => (
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
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              itemStyle={{ color: '#1f2937' }}
            />
            <Legend
              verticalAlign="bottom"
              height={48}
              iconType="square"
              iconSize={16}
              formatter={(value, entry: any) => (
                <div
                  className={`
                    inline-flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer
                    transition-colors duration-200
                    ${activeFilter === value ? 'bg-[#00267A] text-white' : 'hover:bg-gray-100'}
                  `}
                  onClick={() => onSegmentClick(value as string)}
                >
                  <span className={`text-sm ${activeFilter === value ? 'font-medium' : ''}`}>
                    {value}
                  </span>
                </div>
              )}
              wrapperStyle={{
                paddingTop: '24px',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                gap: '12px'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
);

export default function RegulationsPage() {
  const [open, setOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [_, navigate] = useLocation();

  const { data: regulations } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  const { data: deadlines } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
  });

  const categorySummary = regulations?.reduce((acc, reg) => {
    acc[reg.category] = (acc[reg.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const categoryChartData = Object.entries(categorySummary).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Regulations
            </h1>

            <div className="space-x-4">
              <Button
                variant="outline"
                onClick={() => navigate("/regulations/validate")}
              >
                <FileCheck className="h-4 w-4 mr-2" />
                Validate Data
              </Button>

              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Regulation
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Regulation</DialogTitle>
                  </DialogHeader>
                  <div className="p-4">
                    <p>Regulation form will be added here</p>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <CategoryPieChart
            data={categoryChartData}
            onSegmentClick={setCategoryFilter}
            activeFilter={categoryFilter}
          />

          <RegulationList regulations={regulations} deadlines={deadlines} categoryFilter={categoryFilter} />
        </div>
      </main>
    </div>
  );
}