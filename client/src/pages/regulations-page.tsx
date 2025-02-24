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
import { useQuery } from "@tanstack/react-query";
import type { Regulation, Deadline } from "@shared/schema";
import { useLocation } from "wouter";
import RegulationList from "@/components/regulations/regulation-list";
import CustomPieChart from "@/components/common/custom-pie-chart";
import RegulationWizard from "@/components/regulations/regulation-wizard";

// Nine distinct colors from different parts of the color wheel
const CATEGORY_COLORS = {
  "Academic Programs": "#FF0000",    // Red
  "Financial Aid": "#0066FF",        // Blue
  "Student Services": "#FFD700",     // Yellow
  "Athletics": "#9400D3",           // Purple
  "Campus Safety": "#00CC00",       // Green
  "Research": "#90EE90",            // Lime
  "Other": "#808080",               // Gray (for misc categories)
  "Accounting": "#00CCCC",          // Cyan
  "Human Resources": "#FF6600",      // Orange
} as const;

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
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Add New Regulation</DialogTitle>
                  </DialogHeader>
                  <RegulationWizard onSuccess={() => setOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <CustomPieChart
            data={categoryChartData}
            title="Regulations by Category"
            onSegmentClick={setCategoryFilter}
            activeFilter={categoryFilter}
          />

          <RegulationList 
            regulations={regulations || []} 
            deadlines={deadlines} 
            categoryFilter={categoryFilter} 
          />
        </div>
      </main>
    </div>
  );
}