import { useQuery } from "@tanstack/react-query";
import type { Regulation } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import { Search, ChevronUp, ChevronDown } from "lucide-react";

type SortConfig = {
  key: keyof Regulation;
  direction: 'asc' | 'desc';
} | null;

export default function RegulationList() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const { data: regulations, isLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const sortData = (data: Regulation[]) => {
    if (!sortConfig || !data) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // Handle null values
      if (!aValue && !bValue) return 0;
      if (!aValue) return 1;
      if (!bValue) return -1;

      // Special handling for itemId (numeric string comparison)
      if (sortConfig.key === 'itemId') {
        const numA = parseInt(aValue as string, 10);
        const numB = parseInt(bValue as string, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
        }
      }

      // Default string comparison
      const comparison = String(aValue).localeCompare(String(bValue));
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  };

  const requestSort = (key: keyof Regulation) => {
    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };

  const getSortIcon = (key: keyof Regulation) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ChevronUp className="h-4 w-4 text-gray-400" />;
    }
    return sortConfig.direction === 'asc'
      ? <ChevronUp className="h-4 w-4" />
      : <ChevronDown className="h-4 w-4" />;
  };

  const filteredRegulations = regulations?.filter((reg) => {
    const matchesSearch = 
      reg.topic.toLowerCase().includes(search.toLowerCase()) ||
      reg.statute.toLowerCase().includes(search.toLowerCase()) ||
      reg.itemId.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = !categoryFilter || reg.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const sortedRegulations = sortData(filteredRegulations || []);

  const categories = Array.from(
    new Set(regulations?.map((reg) => reg.category))
  ).sort();

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search regulations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="p-2 border rounded-md"
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => requestSort('itemId')}
                >
                  <div className="flex items-center gap-2">
                    ID {getSortIcon('itemId')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => requestSort('topic')}
                >
                  <div className="flex items-center gap-2">
                    Topic {getSortIcon('topic')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => requestSort('statute')}
                >
                  <div className="flex items-center gap-2">
                    Statute {getSortIcon('statute')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => requestSort('category')}
                >
                  <div className="flex items-center gap-2">
                    Category {getSortIcon('category')}
                  </div>
                </TableHead>
                <TableHead>Requirements</TableHead>
                <TableHead>Deadlines</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRegulations.map((regulation) => (
                <TableRow key={regulation.id}>
                  <TableCell className="font-medium">{regulation.itemId}</TableCell>
                  <TableCell>{regulation.topic}</TableCell>
                  <TableCell>{regulation.statute}</TableCell>
                  <TableCell>{regulation.category}</TableCell>
                  <TableCell>
                    {regulation.requirements ? (
                      <div className="max-w-xs truncate">
                        {regulation.requirements}
                      </div>
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                  <TableCell>
                    {regulation.deadlines || "No deadlines"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}