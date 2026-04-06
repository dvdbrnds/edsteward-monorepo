import { useQuery } from "@tanstack/react-query";

export interface CanonicalCategory {
  id: number;
  name: string;
  description: string;
  color: string;
  icon: string;
}

export function useCanonicalCategories() {
  const { data: categories = [], isLoading } = useQuery<CanonicalCategory[]>({
    queryKey: ["/api/regulations/categories"],
    staleTime: 10 * 60 * 1000, // 10 min — these rarely change
  });

  const categoryNames = categories.map((c) => c.name);

  return { categories, categoryNames, isLoading };
}
