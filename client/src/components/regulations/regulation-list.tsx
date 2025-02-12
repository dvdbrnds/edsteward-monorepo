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
import { Search, ExternalLink } from "lucide-react";

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

  const getColumnStyle = (key: keyof Regulation) => {
    if (!sortConfig || sortConfig.key !== key) {
      return "cursor-pointer hover:bg-gray-50";
    }
    return "cursor-pointer hover:bg-gray-50 font-bold";
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

  if (isLoading) {
    return <div>Loading...</div>;
  }

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
                  className={getColumnStyle('itemId')}
                  onClick={() => requestSort('itemId')}
                >
                  ID
                </TableHead>
                <TableHead
                  className={getColumnStyle('topic')}
                  onClick={() => requestSort('topic')}
                >
                  Topic
                </TableHead>
                <TableHead
                  className={getColumnStyle('statute')}
                  onClick={() => requestSort('statute')}
                >
                  Statute
                </TableHead>
                <TableHead
                  className={getColumnStyle('category')}
                  onClick={() => requestSort('category')}
                >
                  Category
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
                      <div className="max-w-xs">
                        {regulation.requirements}
                        {(regulation.requirementsUrl || regulation.regulationUrl) && (
                          <div className="mt-2 space-x-2">
                            {regulation.requirementsUrl && (
                              <a
                                href={regulation.requirementsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                              >
                                Source <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            )}
                            {regulation.regulationUrl && (
                              <a
                                href={regulation.regulationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                              >
                                Regulation <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            )}
                          </div>
                        )}
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