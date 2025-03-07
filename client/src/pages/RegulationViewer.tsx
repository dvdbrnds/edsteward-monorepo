import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Download, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { RegulationDiffViewer } from "@/components/regulations/regulation-diff-viewer";

interface RegulationData {
  id: number;
  itemId: string;
  name: string;
  topic: string;
  statute: string;
  summary: string;
  requirements: string;
  category: string;
  jurisdiction: string;
  lastUpdated: string;
  versionNumber: number;
  previousVersionId: number | null;
  versionMetadata?: {
    changes: Array<{
      field: string;
      oldValue: string;
      newValue: string;
      type: 'addition' | 'deletion' | 'modification';
    }>;
  };
}

export function RegulationViewer() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Check for admin access
  if (!user || user.role !== "admin") {
    return <Redirect to="/" />;
  }

  // Fetch regulations
  const { data: regulations, isLoading } = useQuery<RegulationData[]>({
    queryKey: ['/api/regulations'],
  });

  // Export to CSV
  const exportToCSV = () => {
    if (!regulations) return;

    const headers = Object.keys(regulations[0]).join(',');
    const rows = regulations.map(reg => Object.values(reg).join(','));
    const csv = [headers, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `regulations-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: "Regulations data has been exported to CSV",
    });
  };

  const filteredRegulations = regulations?.filter(reg => {
    const matchesSearch = 
      reg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.itemId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || reg.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = regulations 
    ? [...new Set(regulations.map(reg => reg.category))]
    : [];

  // Helper function to determine cell color based on update time
  const getCellColor = (lastUpdated: string) => {
    const updateTime = new Date(lastUpdated).getTime();
    const now = new Date().getTime();
    const hoursSinceUpdate = (now - updateTime) / (1000 * 60 * 60);

    if (hoursSinceUpdate < 1) return "bg-green-100"; // Updated within last hour
    if (hoursSinceUpdate < 24) return "bg-yellow-50"; // Updated within last day
    return ""; // No special highlighting
  };

  if (isLoading) {
    return <div>Loading regulations data...</div>;
  }

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-4 items-center">
          <Input
            placeholder="Search regulations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowVersionHistory(!showVersionHistory)}>
            <History className="mr-2 h-4 w-4" />
            {showVersionHistory ? 'Hide History' : 'Show History'}
          </Button>
          <Button onClick={exportToCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export to CSV
          </Button>
        </div>
      </div>

      {showVersionHistory && filteredRegulations?.length === 1 && (
        <div className="mb-6">
          <RegulationDiffViewer currentRegulation={filteredRegulations[0]} />
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Item ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Jurisdiction</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRegulations?.map((regulation) => (
              <TableRow key={regulation.id}>
                <TableCell>{regulation.id}</TableCell>
                <TableCell>{regulation.itemId}</TableCell>
                <TableCell className={getCellColor(regulation.lastUpdated)}>
                  {regulation.name}
                </TableCell>
                <TableCell>{regulation.topic}</TableCell>
                <TableCell>{regulation.category}</TableCell>
                <TableCell>{regulation.jurisdiction}</TableCell>
                <TableCell>{regulation.versionNumber}</TableCell>
                <TableCell>{new Date(regulation.lastUpdated).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}