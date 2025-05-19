import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, RefreshCw } from "lucide-react";

interface ChangeStatisticsProps {
  statistics: {
    added: number;
    removed: number;
    changed: number;
  };
}

export function ChangeStatistics({ statistics }: ChangeStatisticsProps) {
  const { added, removed, changed } = statistics;
  
  return (
    <Card className="bg-slate-50">
      <CardContent className="p-4">
        <div className="text-sm font-medium mb-2">Change Statistics:</div>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center">
            <ArrowUp className="h-4 w-4 mr-1 text-green-600" />
            <span className="font-medium text-green-600">{added}%</span>
            <span className="ml-1 text-sm text-muted-foreground">Added</span>
          </div>
          <div className="flex items-center">
            <ArrowDown className="h-4 w-4 mr-1 text-red-600" />
            <span className="font-medium text-red-600">{removed}%</span>
            <span className="ml-1 text-sm text-muted-foreground">Removed</span>
          </div>
          <div className="flex items-center">
            <RefreshCw className="h-4 w-4 mr-1 text-amber-600" />
            <span className="font-medium text-amber-600">{changed}%</span>
            <span className="ml-1 text-sm text-muted-foreground">Changed</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}