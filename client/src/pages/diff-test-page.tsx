import React, { useState, useRef, useEffect } from 'react';
import Navigation from "@/components/layout/navigation";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { diffWords } from 'diff';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Download, Upload, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

const DiffTestPage = () => {
  const [originalText, setOriginalText] = useState<string>('');
  const [updatedText, setUpdatedText] = useState<string>('');
  const [diffResult, setDiffResult] = useState<any[]>([]);
  const [stats, setStats] = useState<{
    addedChars: number;
    removedChars: number;
    changedPercentage: number;
  } | null>(null);
  const [isLoadingOriginal, setIsLoadingOriginal] = useState(false);
  const [isLoadingUpdated, setIsLoadingUpdated] = useState(false);
  const [isLoadingExamples, setIsLoadingExamples] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  
  const { toast } = useToast();
  const originalFileRef = useRef<HTMLInputElement>(null);
  const updatedFileRef = useRef<HTMLInputElement>(null);
  
  // Maximum file size: 10MB
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  
  // Supported file types
  const SUPPORTED_TYPES = [
    '.txt', 
    '.md', 
    '.rtf', 
    '.csv',
    'text/plain',
    'text/markdown',
    'text/rtf',
    'text/csv',
    'application/rtf'
  ];

  const validateFile = (file: File): boolean => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: `File size must be less than ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB. Current file: ${Math.round(file.size / (1024 * 1024))}MB`,
        variant: "destructive"
      });
      return false;
    }

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const isValidType = SUPPORTED_TYPES.includes(fileExtension) || 
                       SUPPORTED_TYPES.includes(file.type) ||
                       file.type.startsWith('text/');
    
    if (!isValidType) {
      toast({
        title: "Invalid file type",
        description: `Please upload a text file (.txt, .md, .rtf, .csv). Current file type: ${file.type || 'unknown'}`,
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>, 
    setTextFn: (text: string) => void,
    setLoadingFn: (loading: boolean) => void
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!validateFile(file)) {
      // Reset the input if validation fails
      event.target.value = '';
      return;
    }
    
    setLoadingFn(true);
    setUploadProgress(0);
    
    try {
      const reader = new FileReader();
      
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      };
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          
          if (!content || content.trim().length === 0) {
            toast({
              title: "Empty file",
              description: "The uploaded file appears to be empty. Please check the file and try again.",
              variant: "destructive"
            });
            return;
          }
          
          setTextFn(content);
          setUploadProgress(100);
          
          toast({
            title: "File uploaded successfully",
            description: `Loaded ${Math.round(content.length / 1024)}KB of text content`,
            variant: "default"
          });
        } catch (error) {
          console.error('Error processing file content:', error);
          toast({
            title: "Error processing file",
            description: "Failed to process the file content. Please ensure it's a valid text file.",
            variant: "destructive"
          });
        } finally {
          setLoadingFn(false);
          setUploadProgress(0);
        }
      };
      
      reader.onerror = () => {
        console.error('Error reading file:', reader.error);
        toast({
          title: "Error reading file",
          description: "Failed to read the file. Please try again or use a different file.",
          variant: "destructive"
        });
        setLoadingFn(false);
        setUploadProgress(0);
      };
      
      reader.readAsText(file, 'UTF-8');
    } catch (error) {
      console.error('Unexpected error during file upload:', error);
      toast({
        title: "Upload failed",
        description: "An unexpected error occurred during file upload. Please try again.",
        variant: "destructive"
      });
      setLoadingFn(false);
      setUploadProgress(0);
    }
  };
  
  const calculateDiff = () => {
    if (!originalText || !updatedText) {
      toast({
        title: "Missing content",
        description: "Please upload both original and updated text files before comparing.",
        variant: "destructive"
      });
      return;
    }
    
    if (originalText.trim().length === 0 || updatedText.trim().length === 0) {
      toast({
        title: "Empty content",
        description: "Both files must contain text content to perform comparison.",
        variant: "destructive"
      });
      return;
    }
    
    try {
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
      
      toast({
        title: "Comparison complete",
        description: `Found ${changedPercentage}% changes (${addedChars} added, ${removedChars} removed characters)`,
        variant: "default"
      });
    } catch (error) {
      console.error('Error calculating diff:', error);
      toast({
        title: "Comparison failed",
        description: "Failed to compare the texts. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const resetForm = () => {
    setOriginalText('');
    setUpdatedText('');
    setDiffResult([]);
    setStats(null);
    setUploadProgress(0);
    
    // Reset file inputs
    if (originalFileRef.current) originalFileRef.current.value = '';
    if (updatedFileRef.current) updatedFileRef.current.value = '';
    
    toast({
      title: "Form reset",
      description: "All content has been cleared. You can now upload new files.",
      variant: "default"
    });
  };
  
  const fetchExampleFiles = async () => {
    setIsLoadingExamples(true);
    
    try {
      // Fetch the original Title IX text
      const originalResponse = await fetch('/downloads/title-ix-original.txt');
      if (!originalResponse.ok) {
        throw new Error(`Failed to fetch original file: ${originalResponse.status} ${originalResponse.statusText}`);
      }
      const originalContent = await originalResponse.text();
      
      if (!originalContent || originalContent.trim().length === 0) {
        throw new Error('Original example file is empty');
      }
      
      setOriginalText(originalContent);
      
      // Fetch the updated Title IX text
      const updatedResponse = await fetch('/downloads/title-ix-updated.txt');
      if (!updatedResponse.ok) {
        throw new Error(`Failed to fetch updated file: ${updatedResponse.status} ${updatedResponse.statusText}`);
      }
      const updatedContent = await updatedResponse.text();
      
      if (!updatedContent || updatedContent.trim().length === 0) {
        throw new Error('Updated example file is empty');
      }
      
      setUpdatedText(updatedContent);
      
      toast({
        title: "Example files loaded",
        description: "Title IX original and updated texts have been loaded successfully.",
        variant: "default"
      });
    } catch (error) {
      console.error('Error fetching example files:', error);
      toast({
        title: "Failed to load example files",
        description: error instanceof Error ? error.message : "Please try uploading your own files instead.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingExamples(false);
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
                Upload original and updated regulation files to see the differences. Supports text files (.txt, .md, .rtf, .csv) up to 10MB.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Example Files Available</AlertTitle>
                <AlertDescription>
                  You can use our example Title IX regulation files to test the differential view feature.
                  <div className="mt-4 flex gap-4">
                    <Button variant="outline" size="sm" onClick={fetchExampleFiles} disabled={isLoadingExamples}>
                      {isLoadingExamples ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Load Example Files
                        </>
                      )}
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
                  <p className="text-sm text-muted-foreground mb-2">
                    Upload a text file (.txt, .md, .rtf, .csv) - max 10MB
                  </p>
                  <Input 
                    id="original-file" 
                    type="file" 
                    accept=".txt,.md,.rtf,.csv,text/plain,text/markdown,text/rtf,text/csv,application/rtf" 
                    ref={originalFileRef}
                    onChange={(e) => handleFileUpload(e, setOriginalText, setIsLoadingOriginal)} 
                    className="mt-2" 
                    disabled={isLoadingOriginal}
                  />
                                     {isLoadingOriginal ? (
                     <div className="mt-4 space-y-3">
                       <div className="flex items-center justify-center">
                         <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                         <span className="ml-2">Uploading original file...</span>
                       </div>
                       {uploadProgress > 0 && (
                         <Progress value={uploadProgress} className="w-full" />
                       )}
                     </div>
                   ) : originalText && (
                    <div className="mt-4 p-4 border rounded-md bg-gray-50 max-h-64 overflow-y-auto">
                      <pre className="text-sm">{originalText.substring(0, 500)}...</pre>
                    </div>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="updated-file">Updated Regulation Text</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Upload a text file (.txt, .md, .rtf, .csv) - max 10MB
                  </p>
                  <Input 
                    id="updated-file" 
                    type="file" 
                    accept=".txt,.md,.rtf,.csv,text/plain,text/markdown,text/rtf,text/csv,application/rtf" 
                    ref={updatedFileRef}
                    onChange={(e) => handleFileUpload(e, setUpdatedText, setIsLoadingUpdated)} 
                    className="mt-2" 
                    disabled={isLoadingUpdated}
                  />
                                     {isLoadingUpdated ? (
                     <div className="mt-4 space-y-3">
                       <div className="flex items-center justify-center">
                         <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                         <span className="ml-2">Uploading updated file...</span>
                       </div>
                       {uploadProgress > 0 && (
                         <Progress value={uploadProgress} className="w-full" />
                       )}
                     </div>
                   ) : updatedText && (
                    <div className="mt-4 p-4 border rounded-md bg-gray-50 max-h-64 overflow-y-auto">
                      <pre className="text-sm">{updatedText.substring(0, 500)}...</pre>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={resetForm}
                disabled={isLoadingOriginal || isLoadingUpdated || isLoadingExamples}
              >
                Reset
              </Button>
              <Button 
                onClick={calculateDiff}
                disabled={!originalText || !updatedText || isLoadingOriginal || isLoadingUpdated || isLoadingExamples}
              >
                <FileText className="mr-2 h-4 w-4" />
                Compare Texts
              </Button>
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