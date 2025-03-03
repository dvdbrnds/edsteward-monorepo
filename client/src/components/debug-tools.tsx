
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

export function NoteDebugger() {
  const [regulationId, setRegulationId] = useState('3869');
  const [title, setTitle] = useState('Debug Test Note');
  const [content, setContent] = useState('This is a test note created through the debug tool');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          onClick={createNote}
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create Note'}
        </Button>
        <Button
          variant="outline"
          onClick={getNotes}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Get Notes'}
        </Button>
      </CardFooter>
    </Card>
  );
}
