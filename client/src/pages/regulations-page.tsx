import Navigation from "@/components/layout/navigation";
import RegulationList from "@/components/regulations/regulation-list";
import RegulationForm from "@/components/regulations/regulation-form";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
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
import type { Regulation } from "@shared/schema";

// Moravian University brand colors
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
                <span 
                  className={`text-[#666666] ml-2 cursor-pointer ${activeFilter === value ? 'font-bold' : ''}`}
                  onClick={() => onSegmentClick(value as string)}
                >
                  {value}
                </span>
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

export default function RegulationsPage() {
  const [open, setOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const { data: regulations } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
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
                <RegulationForm onSuccess={() => setOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>

          <CategoryPieChart 
            data={categoryChartData}
            onSegmentClick={setCategoryFilter}
            activeFilter={categoryFilter}
          />

          <RegulationList categoryFilter={categoryFilter} />
        </div>
      </main>
    </div>
  );
}