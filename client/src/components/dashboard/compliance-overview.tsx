import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { Regulation } from "@shared/schema";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// Moravian University brand colors arranged for category consistency
const CATEGORY_COLORS = {
  "Academic Programs": "#00267A", // Moravian Blue - Primary
  "Financial Aid": "#001B56",     // Dark Blue
  "Student Services": "#078CF5",  // Accent Blue
  "Athletics": "#E58200",         // Gold
  "Campus Safety": "#BC204B",     // Red
  "Research": "#006668",          // Deep Green
  "Other": "#666666",             // Dark Grey
  "Admissions": "#CCCCCC",        // Moravian Grey
} as const;

interface ComplianceOverviewProps {
  onCategorySelect: (category: string | null) => void;
  selectedCategory: string | null;
}

export default function ComplianceOverview({ onCategorySelect, selectedCategory }: ComplianceOverviewProps) {
  const { data: regulations, isLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  if (isLoading || !regulations) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compliance Overview</CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    );
  }

  const categories = regulations.reduce((acc, reg) => {
    acc[reg.category] = (acc[reg.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const data = Object.entries(categories).map(([name, value]) => ({
    name,
    value,
    color: CATEGORY_COLORS[name as keyof typeof CATEGORY_COLORS] || "#666666" // Default to grey if category not found
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            Compliance Overview by Category
            {selectedCategory && (
              <Button
                variant="outline"
                size="sm"
                className="ml-2"
                onClick={() => onCategorySelect(null)}
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filter
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                style={{ outline: 'none' }}
                isAnimationActive={false}
                onClick={(entry) => onCategorySelect(entry.name)}
                className="cursor-pointer"
              >
                {data.map((entry) => (
                  <Cell
                    key={`cell-${entry.name}`}
                    fill={entry.color}
                    stroke="white"
                    strokeWidth={2}
                    opacity={selectedCategory && selectedCategory !== entry.name ? 0.5 : 1}
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #00267A',
                  borderRadius: '4px',
                  padding: '8px'
                }}
                itemStyle={{ color: '#00267A' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {data.map((entry) => (
            <button
              key={entry.name}
              onClick={() => onCategorySelect(entry.name)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md transition-all ${
                selectedCategory === entry.name 
                  ? 'bg-gray-100 font-medium ring-2 ring-[#00267A] ring-opacity-50' 
                  : 'hover:bg-gray-50'
              }`}
            >
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-gray-700">{entry.name}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}