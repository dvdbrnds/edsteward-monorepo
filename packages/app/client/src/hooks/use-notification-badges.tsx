import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

interface AlertsResponse {
  counts: { overdue: number; dueSoon: number };
}

interface BadgeCounts {
  overdueAlerts: number;
  pendingUpdates: number;
  totalUrgent: number;
}

export function useNotificationBadges(): BadgeCounts & { isLoading: boolean } {
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === "admin";
  const isCCO = user?.role?.toLowerCase() === "compliance_officer";

  const { data: alerts } = useQuery<AlertsResponse>({
    queryKey: ["/api/compliance-tasks/alerts"],
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  const { data: pendingUpdates } = useQuery<unknown[]>({
    queryKey: ["/api/regulation-updates/pending"],
    enabled: isAdmin || isCCO,
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  const overdueAlerts = alerts?.counts?.overdue ?? 0;
  const pendingCount = Array.isArray(pendingUpdates) ? pendingUpdates.length : 0;

  return {
    overdueAlerts,
    pendingUpdates: pendingCount,
    totalUrgent: overdueAlerts,
    isLoading: !alerts,
  };
}
