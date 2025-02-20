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

// Moravian University official brand colors in priority order
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
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            Compliance Overview
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
      <CardContent>
        <div className="h-[300px] relative">
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
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    stroke="white"
                    strokeWidth={2}
                    opacity={selectedCategory && selectedCategory !== entry.name ? 0.5 : 1}
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
                    className={`text-[#666666] ml-2 cursor-pointer ${selectedCategory === value ? 'font-bold' : ''}`}
                    onClick={() => onCategorySelect(value as string)}
                  >
                    {value}
                  </span>
                )}
                wrapperStyle={{
                  paddingTop: '20px',
                  width: '100%',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  gap: '8px',
                  position: 'absolute',
                  bottom: '-10px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}