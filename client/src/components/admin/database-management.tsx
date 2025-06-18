import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  Download, 
  Database, 
  FileText, 
  AlertCircle, 
   
  Loader2,
  RefreshCw 
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/api";

interface DatabaseStats {
  users: number;
  regulations: number;
  notes: number;
  guides: number;
  deadlines: number;
  total_records: number;
}

export default function DatabaseManagement() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<string>('');
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Fetch database statistics
  const fetchDatabaseStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const response = await fetch('/api/db-stats', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setDbStats(data.stats);
      } else {
        throw new Error(data.error || 'Failed to fetch stats');
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to fetch database statistics",
        variant: "destructive",
      });
    } finally {
      setIsLoadingStats(false);
    }
  }, [toast]);

  // Export database
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await apiRequest('GET', '/api/admin/database/export');
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the blob data
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `database-export-${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: "Database exported successfully",
      });
    } catch {
      toast({
        title: "Export Failed",
        description: "Failed to export database",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Import database
  const handleImport = async (file: File) => {
    setIsImporting(true);
    setImportProgress(0);
    setImportStatus('Preparing import...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/db-import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }

      // Handle streaming response for progress updates
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
                if (data.progress !== undefined) {
                  setImportProgress(data.progress);
                }
                if (data.status) {
                  setImportStatus(data.status);
                }
                if (data.error) {
                  throw new Error(data.error);
                }
              } catch {
                // Ignore JSON parse errors for non-JSON lines
              }
            }
          }
        }
      }

      setImportStatus('Import completed successfully!');
      toast({
        title: "Import Successful",
        description: "Database imported successfully",
      });

      // Refresh stats after import
      await fetchDatabaseStats();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Import failed';
      setImportStatus(`Import failed: ${errorMessage}`);
      toast({
        title: "Import Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/sql' || file.name.endsWith('.sql')) {
        handleImport(file);
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please select a .sql file",
          variant: "destructive",
        });
      }
    }
  };

  // Load stats on component mount
  React.useEffect(() => {
    fetchDatabaseStats();
  }, [fetchDatabaseStats]);

  return (
    <div className="space-y-6">
      {/* Database Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Statistics
          </CardTitle>
          <CardDescription>
            Current database status and record counts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-muted-foreground">
              Last updated: {new Date().toLocaleString()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDatabaseStats}
              disabled={isLoadingStats}
            >
              {isLoadingStats ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>

          {dbStats ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{dbStats.users}</div>
                <div className="text-sm text-blue-800">Users</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{dbStats.regulations}</div>
                <div className="text-sm text-green-800">Regulations</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{dbStats.notes}</div>
                <div className="text-sm text-purple-800">Notes</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{dbStats.guides}</div>
                <div className="text-sm text-orange-800">Guides</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{dbStats.deadlines}</div>
                <div className="text-sm text-red-800">Deadlines</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{dbStats.total_records}</div>
                <div className="text-sm text-gray-800">Total Records</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {isLoadingStats ? "Loading statistics..." : "No statistics available"}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Database
          </CardTitle>
          <CardDescription>
            Download a complete backup of your database as a SQL file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Export Information</AlertTitle>
              <AlertDescription>
                This will create a complete backup including all tables, data, and indexes. 
                The export is safe to run while the application is running.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Database
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Database
          </CardTitle>
          <CardDescription>
            Upload and restore a database backup from a SQL file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Importing will replace existing data. Make sure to export a backup first.
                Only upload trusted SQL files from this application.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="sql-file">Select SQL File</Label>
              <Input
                id="sql-file"
                type="file"
                accept=".sql"
                ref={fileInputRef}
                onChange={handleFileSelect}
                disabled={isImporting}
              />
            </div>

            {isImporting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Import Progress</span>
                  <span>{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="w-full" />
                <div className="text-sm text-muted-foreground">
                  {importStatus}
                </div>
              </div>
            )}

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              variant="outline"
              className="w-full"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Select File to Import
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Migration Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Migration Tools
          </CardTitle>
          <CardDescription>
            Advanced database migration and synchronization tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" className="h-auto p-4 flex flex-col items-start">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4" />
                <span className="font-medium">Schema Migration</span>
              </div>
              <span className="text-sm text-muted-foreground text-left">
                Update database schema to latest version
              </span>
            </Button>

            <Button variant="outline" className="h-auto p-4 flex flex-col items-start">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-4 w-4" />
                <span className="font-medium">Data Sync</span>
              </div>
              <span className="text-sm text-muted-foreground text-left">
                Synchronize data with external sources
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 