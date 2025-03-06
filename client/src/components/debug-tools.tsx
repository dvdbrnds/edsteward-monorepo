import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Download, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function NoteDebugger() {
  const [regulationId, setRegulationId] = useState('3869');
  const [title, setTitle] = useState('Debug Test Note');
  const [content, setContent] = useState('This is a test note created through the debug tool');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaInfo, setSchemaInfo] = useState<any>(null); 
  const [reqResponse, setReqResponse] = useState<any>(null); 

  const createNote = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('DEBUG TOOL: Creating note with data:', {
        regulationId: parseInt(regulationId),
        title,
        content,
      });

      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          regulationId: parseInt(regulationId),
          title,
          content,
          category: 'general',
          status: 'active',
          isPrivate: false,
        }),
        credentials: 'include',
      });

      console.log('DEBUG TOOL: Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DEBUG TOOL: Error response:', errorText);
        setError(`Error: ${response.status} - ${errorText}`);
        toast({
          title: 'Error',
          description: `Failed to create note: ${response.status}`,
          variant: 'destructive',
        });
        return;
      }

      const data = await response.json();
      console.log('DEBUG TOOL: Success response:', data);
      setResult(data);
      toast({
        title: 'Success',
        description: 'Note created successfully',
      });
    } catch (error) {
      console.error('DEBUG TOOL: Exception:', error);
      setError(error instanceof Error ? error.message : String(error));
      toast({
        title: 'Error',
        description: 'An exception occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getNotes = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('DEBUG TOOL: Getting notes for regulation:', regulationId);

      const response = await fetch(`/api/notes/regulation/${regulationId}`, {
        credentials: 'include',
      });

      console.log('DEBUG TOOL: Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DEBUG TOOL: Error response:', errorText);
        setError(`Error: ${response.status} - ${errorText}`);
        toast({
          title: 'Error',
          description: `Failed to get notes: ${response.status}`,
          variant: 'destructive',
        });
        return;
      }

      const data = await response.json();
      console.log('DEBUG TOOL: Success response:', data);
      setResult(data);
      toast({
        title: 'Success',
        description: `Found ${data.length} notes`,
      });
    } catch (error) {
      console.error('DEBUG TOOL: Exception:', error);
      setError(error instanceof Error ? error.message : String(error));
      toast({
        title: 'Error',
        description: 'An exception occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-[600px] mx-auto my-8">
      <CardHeader>
        <CardTitle>Note API Debugger</CardTitle>
        <CardDescription>Test note creation and retrieval</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Regulation ID</label>
          <Input
            value={regulationId}
            onChange={(e) => setRegulationId(e.target.value)}
            placeholder="Regulation ID"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Content</label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Note content"
            rows={3}
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
            <h4 className="font-medium text-sm mb-1">Result:</h4>
            <pre className="text-xs overflow-auto max-h-40">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
        {schemaInfo && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
            <h4 className="font-medium text-sm mb-1">Schema Info:</h4>
            <pre className="text-xs overflow-auto max-h-40">
              {JSON.stringify(schemaInfo, null, 2)}
            </pre>
          </div>
        )}
        {reqResponse && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
            <h4 className="font-medium text-sm mb-1">Request Response:</h4>
            <pre className="text-xs overflow-auto max-h-40">
              {JSON.stringify(reqResponse, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={getNotes}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Get Notes'}
        </Button>
        <Button 
          variant="outline" 
          onClick={async () => {
            setLoading(true);
            try {
              const response = await fetch('/api/debug/note-schemas');
              const data = await response.json();
              setSchemaInfo(data);
              setError(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            } finally {
              setLoading(false);
            }
          }}
        >
          Test Schema
        </Button>
        <Button onClick={createNote} disabled={loading}>
          {loading ? 'Creating...' : 'Create Note'}
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            setLoading(true);
            try {
              const response = await fetch('/api/notes', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  regulationId: parseInt(regulationId),
                  title,
                  content,
                  isPrivate: false,
                }),
              });

              setReqResponse({
                status: response.status,
                headers: {
                  contentType: response.headers.get('content-type'),
                }
              });

              const data = await response.json();
              setResult(data);
              setError(null);

              if (!response.ok) {
                setError(`API Error: ${response.status} - ${data.error || 'Unknown error'}`);
              } else {
                toast({
                  title: "Success",
                  description: "Note created successfully",
                });
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            } finally {
              setLoading(false);
            }
          }}
        >
          Create (Full Debug)
        </Button>
      </CardFooter>
    </Card>
  );
}

export function RegulationImportDebugger() {
  const [regulationIds, setRegulationIds] = useState<string[]>([]);
  const [importStatus, setImportStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [openAiStatus, setOpenAiStatus] = useState<'unchecked' | 'ready' | 'error'>('unchecked');
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const checkOpenAiStatus = async () => {
    try {
      setOpenAiStatus('checking');
      const timestamp = new Date().toISOString();
      setLogs(prev => [...prev, `${timestamp} - Checking OpenAI API status...`]);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      try {
        const response = await fetch('/api/regulations/check-openai', {
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        clearTimeout(timeoutId);
        const data = await response.json();

        console.log('OpenAI API check response:', {
          status: response.status,
          statusText: response.statusText,
          data
        });
        
        // More comprehensive error handling
        if (response.status !== 200) {
          console.error('OpenAI API check error details:', data);
          // Reset status to show error state
          setOpenAiStatus('error');
          // Clear previous logs related to this check
          setLogs(prev => prev.filter(log => !log.includes('OpenAI API Status')));
          setLogs(prev => [
            ...prev, 
            `${timestamp} - OpenAI API Status: error`,
            `${timestamp} - Message: ${data.message || data.error || 'Unknown error'}`,
            data.details ? `${timestamp} - Details: ${data.details}` : '',
            `${timestamp} - HTTP Status: ${response.status} ${response.statusText}`
          ].filter(Boolean));
          return;
        }

        if (response.ok && data.status === 'ok') {
          setOpenAiStatus('ready');
          setLogs(prev => [
            ...prev, 
            `${timestamp} - OpenAI API Status: ok`,
            `${timestamp} - Message: ${data.message || 'Connection successful'}`,
            data.details ? `${timestamp} - Details: ${data.details}` : ''
          ].filter(Boolean));
        } else {
          console.error('OpenAI API check error:', { 
            status: response.status, 
            statusText: response.statusText, 
            data 
          });
          
          setOpenAiStatus('error');
          setLogs(prev => [
            ...prev, 
            `${timestamp} - OpenAI API Status: error`,
            `${timestamp} - Message: ${data.message || data.error || 'Unknown error'}`,
            data.details ? `${timestamp} - Details: ${data.details}` : '',
            `${timestamp} - HTTP Status: ${response.status} ${response.statusText}`
          ].filter(Boolean));
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      console.error('OpenAI API check error:', error);
      setOpenAiStatus('error');

      const errorMessage = error instanceof Error ? error.message : String(error);
      const timestamp = new Date().toISOString();

      setLogs(prev => [
        ...prev, 
        `${timestamp} - OpenAI API Status: error`,
        `${timestamp} - Error: ${errorMessage}`,
        error instanceof Error && error.name === 'AbortError' 
          ? `${timestamp} - Details: Request timed out after 15 seconds` 
          : `${timestamp} - Details: Connection failed, please check your network and API configuration`
      ]);
    }
  };

  const startAnalysis = async () => {
    setLoading(true);
    setImportStatus('running');
    try {
      setLogs(prev => [...prev, `${new Date().toISOString()} - Starting AI analysis for regulation IDs: ${regulationIds.join(', ')}`]);

      const response = await fetch('/api/regulations/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ regulationIds }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAnalysisResult(data);

      setLogs(prev => [
        ...prev,
        `${new Date().toISOString()} - AI analysis started successfully`,
        `${new Date().toISOString()} - Processing ${regulationIds.length} regulations`,
        `${new Date().toISOString()} - Analysis details: ${JSON.stringify(data.summary, null, 2)}`
      ]);

      setImportStatus('completed');
      toast({
        title: 'Success',
        description: 'Regulation analysis process started successfully',
      });
    } catch (error) {
      console.error('Analysis error:', error);
      setImportStatus('error');
      setLogs(prev => [...prev, `${new Date().toISOString()} - Error: ${error instanceof Error ? error.message : String(error)}`]);
      toast({
        title: 'Error',
        description: 'Failed to start regulation analysis',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const analyzeAllRegulations = async () => {
    try {
      setLoading(true);
      setLogs(prev => [...prev, `${new Date().toISOString()} - Fetching all regulation IDs...`]);

      const response = await fetch('/api/regulations/ids');
      if (!response.ok) {
        throw new Error(`Failed to fetch regulation IDs: ${response.status}`);
      }

      const data = await response.json();
      setRegulationIds(data.ids);
      setLogs(prev => [...prev, `${new Date().toISOString()} - Found ${data.count} regulations to analyze`]);

      await startAnalysis();
    } catch (error) {
      console.error('Error analyzing all regulations:', error);
      setImportStatus('error');
      setLogs(prev => [...prev, `${new Date().toISOString()} - Error: ${error instanceof Error ? error.message : String(error)}`]);
      toast({
        title: 'Error',
        description: 'Failed to analyze all regulations',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const downloadLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `regulation-import-logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-[800px] mx-auto my-8">
      <CardHeader>
        <CardTitle>AI Regulation Analysis Console</CardTitle>
        <CardDescription>
          Monitor and control the AI-powered regulation analysis process.
          <div className="mt-2 text-sm text-muted-foreground">
            <p>Instructions:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>First check the OpenAI API status</li>
              <li>Enter regulation IDs separated by commas (e.g., "REG1001, REG1002") or use "Analyze All" button</li>
              <li>Click "Start Analysis" to begin the AI-powered analysis</li>
              <li>Monitor the analysis progress and results below</li>
              <li>Use "Download Logs" to save the analysis history</li>
            </ul>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Badge
              variant={
                openAiStatus === 'ready' ? 'default' :
                openAiStatus === 'error' ? 'destructive' :
                'outline'
              }
            >
              OpenAI API: {openAiStatus.toUpperCase()}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={checkOpenAiStatus}
              disabled={loading}
            >
              Check API Status
            </Button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={analyzeAllRegulations}
            disabled={loading || openAiStatus !== 'ready'}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing All...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Analyze All
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Regulation IDs</label>
            <Input
              value={regulationIds.join(', ')}
              onChange={(e) => setRegulationIds(e.target.value.split(',').map(id => id.trim()))}
              placeholder="Enter regulation IDs (e.g., REG1001, REG1002)"
              disabled={loading}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              onClick={startAnalysis}
              disabled={loading || !regulationIds.length || openAiStatus !== 'ready'}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Start Analysis'
              )}
            </Button>
          </div>
        </div>

        {analysisResult && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Analysis Results</AlertTitle>
            <AlertDescription>
              <pre className="mt-2 whitespace-pre-wrap text-sm">
                {JSON.stringify(analysisResult, null, 2)}
              </pre>
            </AlertDescription>
          </Alert>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Analysis Status</label>
            <Badge
              variant={
                importStatus === 'completed' ? 'default' :
                importStatus === 'error' ? 'destructive' :
                importStatus === 'running' ? 'secondary' : 'outline'
              }
            >
              {importStatus.toUpperCase()}
            </Badge>
          </div>
          <div className="border rounded-md p-4 bg-muted/10 min-h-[300px] max-h-[300px] overflow-auto font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-muted-foreground text-center py-8">
                No logs available. Start an analysis to see logs here.
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="py-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={clearLogs}
          disabled={!logs.length}
        >
          Clear Logs
        </Button>
        <Button
          variant="outline"
          onClick={downloadLogs}
          disabled={!logs.length}
        >
          <Download className="mr-2 h-4 w-4" />
          Download Logs
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function DebugTools() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Debug Tools</h1>
      <Tabs defaultValue="notes">
        <TabsList className="mb-8">
          <TabsTrigger value="notes">Note API Debug</TabsTrigger>
          <TabsTrigger value="regulations">Regulation Import Debug</TabsTrigger>
        </TabsList>
        <TabsContent value="notes">
          <NoteDebugger />
        </TabsContent>
        <TabsContent value="regulations">
          <RegulationImportDebugger />
        </TabsContent>
      </Tabs>
    </div>
  );
}