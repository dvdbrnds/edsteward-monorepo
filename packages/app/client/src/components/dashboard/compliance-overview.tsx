import { useQuery } from "@tanstack/react-query";
import type { Regulation } from "@shared/schema";
import CustomPieChart from "@/components/common/custom-pie-chart";

interface ComplianceOverviewProps {
  onCategorySelect: (_category: string | null) => void;
  selectedCategory: string | null;
}

export default function ComplianceOverview({ onCategorySelect, selectedCategory }: ComplianceOverviewProps) {
  const { data: regulations, isLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  if (isLoading || !regulations) {
    return <div>Loading...</div>;
  }

  const categories = Array.isArray(regulations) ? regulations.reduce((acc, reg) => {
    acc[reg.category] = (acc[reg.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) : {};

  const data = Object.entries(categories).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <CustomPieChart
      data={data}
      title="Compliance Overview"
      onSegmentClick={onCategorySelect}
      activeFilter={selectedCategory}
      allowExport={false}
    />
  );
}