import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Calendar as CalendarIcon, RefreshCw, Activity } from "lucide-react";
import { Switch } from "@/components/ui/switch";

// Map log levels to human-readable names and colors
const LOG_LEVELS = {
  0: { name: "Emergency", color: "text-red-600 font-bold" },
  1: { name: "Alert", color: "text-red-500 font-bold" },
  2: { name: "Critical", color: "text-red-500" },
  3: { name: "Error", color: "text-red-400" },
  4: { name: "Warning", color: "text-yellow-500" },
  5: { name: "Notice", color: "text-blue-500" },
  6: { name: "Info", color: "text-blue-400" },
  7: { name: "Debug", color: "text-gray-400" }
};

// Map facilities to human-readable names
const LOG_FACILITIES = {
  0: "KERNEL",
  1: "USER",
  2: "MAIL",
  3: "SYSTEM",
  4: "SECURITY",
  5: "INTERNAL",
  6: "PRINTER",
  7: "NETWORK",
  8: "UUCP",
  9: "CLOCK",
  10: "AUTHPRIV",
  11: "FTP",
  12: "NTP",
  13: "AUDIT",
  14: "ALERT",
  15: "CRON",
  16: "LOCAL0",
  17: "LOCAL1",
  18: "LOCAL2",
  19: "LOCAL3",
  20: "LOCAL4",
  21: "LOCAL5",
  22: "LOCAL6",
  23: "LOCAL7"
};

export default function LogsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<string>();
  const [facility, setFacility] = useState<string>();
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshInterval = 10000; // 10 seconds

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/admin/logs", { search, level, facility, startDate, endDate, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (level && level !== "all") params.append("level", level);
      if (facility && facility !== "all") params.append("facility", facility);
      if (startDate) params.append("startDate", startDate.toISOString());
      if (endDate) params.append("endDate", endDate.toISOString());
      params.append("page", String(page));

      const response = await fetch(`/api/admin/logs?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch logs");
      }
      return response.json();
    },
    enabled: user?.role === "admin"
  });

  useEffect(() => {
    if (autoRefresh) {
      const intervalId = setInterval(() => {
        refetch();
      }, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [autoRefresh, refetch]);

  if (user?.role !== "admin") {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            Only administrators can access the system logs.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>System Logs</CardTitle>
          <CardDescription>
            View and filter system logs. Use the filters below to narrow down the results.
          </CardDescription>
          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 border rounded-md p-2 bg-muted/20">
            <span>• Authentication events (login/logout)</span>
            <span>• Regulation access and updates</span>
            <span>• Compliance status changes</span>
            <span>• Report generation</span>
            <span>• System configuration changes</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4 flex-wrap items-center">
            <Button 
              variant="outline" 
              size="sm"
              className="ml-auto"
              onClick={() => {
                setSearch("");
                setLevel(undefined);
                setFacility(undefined);
                setStartDate(undefined);
                setEndDate(undefined);
                setPage(1);
              }}
            >
              Clear All Filters
            </Button>
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh}>
              Auto Refresh
            </Switch>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="flex space-x-2">
                <Input
                  placeholder="Search logs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Button 
                  variant="outline" 
                  onClick={() => setSearch("")}
                  title="Show all logs"
                  size="sm"
                >
                  All Logs
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Log Level</label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {Object.entries(LOG_LEVELS).map(([value, { name }]) => (
                    <SelectItem key={value} value={value}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Facility</label>
              <Select value={facility} onValueChange={setFacility}>
                <SelectTrigger>
                  <SelectValue placeholder="Select facility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Facilities</SelectItem>
                  {Object.entries(LOG_FACILITIES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end space-x-2">
              <Button
                onClick={() => {
                  setSearch(`username:${user?.username || 'dvdbrnds'}`);
                  setPage(1);
                }}
                variant="outline"
              >
                My Activity
              </Button>
            </div>
          </div>

          {/* Log Information Card - Properly positioned */}
          <Card className="mb-6 mt-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center">
                <Activity className="h-4 w-4 mr-2" />
                Log Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground mb-2">
                The system automatically logs all user activities, including:
              </p>
              <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1 mb-0">
                <li>Authentication events (login/logout)</li>
                <li>Regulation access and updates</li>
                <li>Compliance status changes</li>
                <li>Report generation</li>
                <li>System configuration changes</li>
              </ul>
            </CardContent>
          </Card>
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "MMM d, yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "MMM d, yyyy") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">Loading logs...</div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Failed to load logs. Please try again.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Facility</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>User Agent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.logs.map((log: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>
                          {format(new Date(log.timestamp), "MMM d, yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {log.username || 'system'}
                        </TableCell>
                        <TableCell className={LOG_LEVELS[log.severity as keyof typeof LOG_LEVELS]?.color || ""}>
                          {LOG_LEVELS[log.severity as keyof typeof LOG_LEVELS]?.name || log.level}
                        </TableCell>
                        <TableCell>{LOG_FACILITIES[log.facility as keyof typeof LOG_FACILITIES] || log.facility}</TableCell>
                        <TableCell className="font-mono text-sm whitespace-pre-wrap max-w-md">
                          {log.message}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {log.ip}
                        </TableCell>
                        <TableCell className="font-mono text-sm truncate max-w-xs" title={log.userAgent}>
                          {log.userAgent}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Showing {data?.logs.length} of {data?.total} logs
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => refetch()}
                    size="sm"
                    title="Refresh logs"
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={page === data?.totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>iv>
  );
}