import React, { useState, useRef, useEffect } from 'react';
import Navigation from "@/components/layout/navigation";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { diffWords } from 'diff';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Download } from 'lucide-react';

const DiffTestPage = () => {
  const [originalText, setOriginalText] = useState<string>('');
  const [updatedText, setUpdatedText] = useState<string>('');
  const [diffResult, setDiffResult] = useState<any[]>([]);
  const [stats, setStats] = useState<{
    addedChars: number;
    removedChars: number;
    changedPercentage: number;
  } | null>(null);
  
  const originalFileRef = useRef<HTMLInputElement>(null);
  const updatedFileRef = useRef<HTMLInputElement>(null);
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, setTextFn: (text: string) => void) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setTextFn(content);
    };
    reader.readAsText(file);
  };
  
  const calculateDiff = () => {
    if (!originalText || !updatedText) {
      alert('Please upload both original and updated text files');
      return;
    }
    
    const differences = diffWords(originalText, updatedText);
    setDiffResult(differences);
    
    // Calculate statistics
    let addedChars = 0;
    let removedChars = 0;
    
    differences.forEach(part => {
      if (part.added) {
        addedChars += part.value.length;
      } else if (part.removed) {
        removedChars += part.value.length;
      }
    });
    
    const originalLength = originalText.length;
    const changedChars = addedChars + removedChars;
    const changedPercentage = originalLength === 0 
      ? 100 
      : Math.round((changedChars / Math.max(originalLength, 1)) * 100);
    
    setStats({
      addedChars,
      removedChars,
      changedPercentage
    });
  };
  
  const resetForm = () => {
    setOriginalText('');
    setUpdatedText('');
    setDiffResult([]);
    setStats(null);
    
    // Reset file inputs
    if (originalFileRef.current) originalFileRef.current.value = '';
    if (updatedFileRef.current) updatedFileRef.current.value = '';
  };
  
  const fetchExampleFiles = async () => {
    try {
      // Fetch the original Title IX text
      const originalResponse = await fetch('/downloads/title-ix-original.txt');
      const originalContent = await originalResponse.text();
      setOriginalText(originalContent);
      
      // Fetch the updated Title IX text
      const updatedResponse = await fetch('/downloads/title-ix-updated.txt');
      const updatedContent = await updatedResponse.text();
      setUpdatedText(updatedContent);
    } catch (error) {
      console.error('Error fetching example files:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Regulation Differential View Test</CardTitle>
              <CardDescription>
                Upload original and updated regulation text files to see the differences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Example Files Available</AlertTitle>
                <AlertDescription>
                  You can use our example Title IX regulation files to test the differential view feature.
                  <div className="mt-4 flex gap-4">
                    <Button variant="outline" size="sm" onClick={fetchExampleFiles}>
                      <Download className="mr-2 h-4 w-4" />
                      Load Example Files
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href="/downloads/title-ix-original.txt" target="_blank" download>
                        Download Original
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href="/downloads/title-ix-updated.txt" target="_blank" download>
                        Download Updated
                      </a>
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="original-file">Original Regulation Text</Label>
                  <Input 
                    id="original-file" 
                    type="file" 
                    accept=".txt" 
                    ref={originalFileRef}
                    onChange={(e) => handleFileUpload(e, setOriginalText)} 
                    className="mt-2" 
                  />
                  {originalText && (
                    <div className="mt-4 p-4 border rounded-md bg-gray-50 max-h-64 overflow-y-auto">
                      <pre className="text-sm">{originalText.substring(0, 500)}...</pre>
                    </div>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="updated-file">Updated Regulation Text</Label>
                  <Input 
                    id="updated-file" 
                    type="file" 
                    accept=".txt" 
                    ref={updatedFileRef}
                    onChange={(e) => handleFileUpload(e, setUpdatedText)} 
                    className="mt-2" 
                  />
                  {updatedText && (
                    <div className="mt-4 p-4 border rounded-md bg-gray-50 max-h-64 overflow-y-auto">
                      <pre className="text-sm">{updatedText.substring(0, 500)}...</pre>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={resetForm}>Reset</Button>
              <Button onClick={calculateDiff}>Compare Texts</Button>
            </CardFooter>
          </Card>
          
          {diffResult.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Differential View</CardTitle>
                {stats && (
                  <CardDescription>
                    {stats.changedPercentage}% of content changed ({stats.addedChars} characters added, {stats.removedChars} characters removed)
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="p-4 border rounded-md bg-white max-h-[600px] overflow-y-auto">
                  {diffResult.map((part, index) => (
                    <span 
                      key={index}
                      className={
                        part.added 
                          ? 'bg-green-100 text-green-800' 
                          : part.removed 
                            ? 'bg-red-100 text-red-800 line-through' 
                            : ''
                      }
                    >
                      {part.value}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default DiffTestPage;