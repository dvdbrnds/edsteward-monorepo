import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
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
  onSegmentClick: (name: string) => void;
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
          {allowExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCSV(
                data.map(({ name, value }) => ({
                  name,
                  value
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
      <CardContent>
        <div className="h-auto min-h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%" minHeight={340}>
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
                height={100}
                iconType="circle"
                layout="horizontal"
                payload={legendData.map((entry, index) => ({
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
                      text-xs
                      ${activeFilter === value ? 'font-bold' : ''}
                      break-words
                    `}
                    onClick={() => onSegmentClick(value as string)}
                  >
                    {value}
                  </span>
                )}
                wrapperStyle={{
                  paddingTop: '20px',
                  paddingBottom: '10px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, auto))',
                  gap: '8px',
                  width: '100%',
                  height: 'auto'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
