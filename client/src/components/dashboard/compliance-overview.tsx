import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { Regulation } from "@shared/schema";
import CustomPieChart from "@/components/common/custom-pie-chart";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

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
        <CustomPieChart
          data={data}
          title="Compliance Overview by Category"
          onSegmentClick={onCategorySelect}
          activeFilter={selectedCategory}
          allowExport={false}
        />
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {data.map((entry) => (
            <button
              key={entry.name}
              onClick={() => onCategorySelect(entry.name)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md transition-all ${
                selectedCategory === entry.name
                  ? 'bg-gray-100 font-medium ring-2 ring-gray-300'
                  : 'hover:bg-gray-50'
              }`}
            >
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor:  "#808080" }} // Default color if no color available
              />
              <span className="text-sm text-gray-700">
                {entry.name}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}