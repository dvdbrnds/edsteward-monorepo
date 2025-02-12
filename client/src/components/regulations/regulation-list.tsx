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
import { Search } from "lucide-react";

export default function RegulationList() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const { data: regulations, isLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const filteredRegulations = regulations?.filter((reg) => {
    const matchesSearch = 
      reg.topic.toLowerCase().includes(search.toLowerCase()) ||
      reg.statute.toLowerCase().includes(search.toLowerCase()) ||
      reg.itemId.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = !categoryFilter || reg.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

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
                <TableHead>ID</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Statute</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Requirements</TableHead>
                <TableHead>Deadlines</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRegulations?.map((regulation) => (
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
