import Navigation from "@/components/layout/navigation";
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
import { useLocation } from "wouter";

export default function RegulationsPage() {
  const [search, setSearch] = useState("");
  const [_, navigate] = useLocation();

  const { data: regulations, isLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            Loading...
          </div>
        </main>
      </div>
    );
  }

  const filteredRegulations = regulations?.filter((reg) =>
    reg.topic.toLowerCase().includes(search.toLowerCase()) ||
    reg.statute.toLowerCase().includes(search.toLowerCase()) ||
    reg.itemId.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Regulations
          </h1>

          <Card>
            <CardContent className="p-6">
              <div className="relative mb-6">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search regulations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Topic</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegulations.map((regulation) => (
                      <TableRow
                        key={regulation.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => navigate(`/regulation/${regulation.id}`)}
                      >
                        <TableCell>{regulation.itemId}</TableCell>
                        <TableCell>{regulation.topic}</TableCell>
                        <TableCell>{regulation.category}</TableCell>
                        <TableCell>Active</TableCell>
                      </TableRow>
                    ))}
                    {filteredRegulations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-4">
                          No regulations found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}