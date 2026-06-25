import { useQuery } from "@tanstack/react-query";
import type { Regulation } from "@shared/schema";
import { useInstitutionFilter } from "@/hooks/use-institution-filter";
import { FileText, ListChecks, Shield, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface TaskCounts {
  rootCount: number;
  rootCompleted: number;
  subtaskCount: number;
  total: number;
}

interface DashboardAnalytics {
  overview: { complianceScore: number };
  regulations: { complianceRate: number };
  deadlines: { upcoming: number };
}

interface RegulationContextStripProps {
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
}

function progressColor(pct: number): string {
  if (pct >= 85) return "#10b981";
  if (pct >= 70) return "#eab308";
  if (pct >= 50) return "#f97316";
  return "#ef4444";
}

export default function RegulationContextStrip({
  selectedCategory,
  setSelectedCategory,
}: RegulationContextStripProps) {
  const { regulationsQueryKey } = useInstitutionFilter();

  const { data: regulations } = useQuery<Regulation[]>({
    queryKey: regulationsQueryKey,
  });

  const { data: analytics } = useQuery<DashboardAnalytics>({
    queryKey: ["/api/dashboard-analytics"],
  });

  const allRegs = useMemo(
    () => (Array.isArray(regulations) ? regulations : []),
    [regulations],
  );

  const regulationIds = useMemo(
    () => allRegs.map((r) => r.id).sort().join(","),
    [allRegs],
  );

  const { data: taskCounts } = useQuery<TaskCounts>({
    queryKey: ["/api/dashboard-analytics/task-counts", regulationIds],
    queryFn: async () => {
      const url = regulationIds
        ? `/api/dashboard-analytics/task-counts?regulationIds=${regulationIds}`
        : "/api/dashboard-analytics/task-counts";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch task counts");
      return res.json();
    },
    enabled: allRegs.length > 0,
  });

  const filteredCount = selectedCategory
    ? allRegs.filter((r) => r.category === selectedCategory).length
    : allRegs.length;
  const totalCount = allRegs.length;

  const categories = allRegs.reduce<Record<string, number>>((acc, reg) => {
    acc[reg.category] = (acc[reg.category] || 0) + 1;
    return acc;
  }, {});
  const sortedCategories = Object.entries(categories).sort(
    (a, b) => b[1] - a[1],
  );

  const rootCount = taskCounts?.rootCount ?? 0;
  const rootCompleted = taskCounts?.rootCompleted ?? 0;
  const subtaskCount = taskCounts?.subtaskCount ?? 0;
  const taskCompletionPct = rootCount > 0 ? Math.round((rootCompleted / rootCount) * 100) : 0;

  const complianceScore = analytics?.overview?.complianceScore ?? 0;
  const regComplianceRate = analytics?.regulations?.complianceRate ?? 0;
  const upcomingDeadlines = analytics?.deadlines?.upcoming ?? 0;

  return (
    <div className="space-y-4">
      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<FileText className="h-4 w-4 text-blue-600" />}
          label="Regulations"
          value={
            selectedCategory
              ? `${filteredCount} / ${totalCount}`
              : String(totalCount)
          }
          progress={regComplianceRate}
        />
        <MetricCard
          icon={<ListChecks className="h-4 w-4 text-emerald-600" />}
          label="Tasks"
          value={String(rootCount)}
          subtitle={subtaskCount > 0 ? `${subtaskCount} subtasks` : undefined}
          progress={taskCompletionPct}
        />
        <MetricCard
          icon={<Shield className="h-4 w-4 text-blue-600" />}
          label="Compliance Score"
          value={`${complianceScore}%`}
          progress={complianceScore}
        />
        <MetricCard
          icon={<Clock className="h-4 w-4 text-yellow-600" />}
          label="Upcoming Deadlines"
          value={String(upcomingDeadlines)}
        />
      </div>

      {/* Category filter chips */}
      {sortedCategories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <Badge
            variant={selectedCategory === null ? "default" : "outline"}
            className={cn(
              "cursor-pointer whitespace-nowrap transition-colors",
              selectedCategory === null && "bg-primary text-primary-foreground",
            )}
            onClick={() => setSelectedCategory(null)}
          >
            All ({totalCount})
          </Badge>
          {sortedCategories.map(([cat, count]) => (
            <Badge
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              className={cn(
                "cursor-pointer whitespace-nowrap transition-colors",
                selectedCategory === cat &&
                  "bg-primary text-primary-foreground",
              )}
              onClick={() =>
                setSelectedCategory(selectedCategory === cat ? null : cat)
              }
            >
              {cat} ({count})
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  subtitle,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  progress?: number;
}) {
  const hasProgress = progress !== undefined;
  const barColor = hasProgress ? progressColor(progress) : undefined;

  return (
    <div className="relative overflow-hidden rounded-lg border bg-card">
      {/* Progress bar background fill */}
      {hasProgress && (
        <div
          className="absolute inset-0 opacity-[0.08] transition-all duration-700 ease-out"
          style={{
            width: `${Math.max(progress, 2)}%`,
            background: `linear-gradient(90deg, ${barColor}, ${barColor})`,
          }}
        />
      )}
      <div className="relative flex items-center gap-3 p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted/80">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-semibold leading-tight">{value}</p>
            {subtitle && (
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            )}
            {hasProgress && (
              <span
                className="text-xs font-medium"
                style={{ color: barColor }}
              >
                {progress}%
              </span>
            )}
          </div>
        </div>
      </div>
      {/* Bottom progress line */}
      {hasProgress && (
        <div className="h-1 w-full bg-muted/50">
          <div
            className="h-full transition-all duration-700 ease-out rounded-r-full"
            style={{
              width: `${progress}%`,
              backgroundColor: barColor,
            }}
          />
        </div>
      )}
    </div>
  );
}
