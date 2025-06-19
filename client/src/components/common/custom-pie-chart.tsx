import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Download, X } from "lucide-react";

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

interface ChartData {
  name: string;
  value: number;
}

interface CustomPieChartProps {
  data: ChartData[];
  title: string;
  onSegmentClick: (_name: string) => void;
  activeFilter: string | null;
  allowExport?: boolean;
}

function downloadCSV(data: ChartData[], filename: string) {
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => row[header as keyof ChartData]).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

export default function CustomPieChart({
  data,
  title,
  onSegmentClick,
  activeFilter,
  allowExport = true,
}: CustomPieChartProps) {
  // Sort data by value for the pie chart while keeping a separate sorted copy for the legend
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  const legendData = [...data].sort((a, b) => {
    const aName = a.name || '';
    const bName = b.name || '';
    return aName.localeCompare(bName);
  });

  return (
    <Card className="h-[600px]">
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
          {allowExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCSV(
                data.map(({ name, value }) => ({
                  name,
                  value,
                })),
                `${title.toLowerCase().replace(/ /g, '-')}.csv`
              )}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Chart container */}
        <div className="h-[250px] w-full mb-4 px-6">
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
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Custom legend outside of ResponsiveContainer */}
        <div className="mt-2 px-8 pb-4">
          <div className="flex flex-wrap justify-center gap-2">
            {legendData.map((entry, index) => (
              <div 
                key={`legend-${index}`} 
                className={`
                  flex items-center rounded px-2 py-1 transition-colors
                  ${activeFilter === entry.name ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}
                  cursor-pointer
                `}
                onClick={() => onSegmentClick(entry.name)}
                title={entry.name}
              >
                <div 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: COLORS[sortedData.findIndex(d => d.name === entry.name) % COLORS.length] }}
                ></div>
                <span className="text-xs truncate max-w-[120px]">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
