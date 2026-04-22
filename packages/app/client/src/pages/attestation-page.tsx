/**
 * Attestation Landing Page
 * 
 * Public page for field compliance officers to:
 * - View task details
 * - Upload required evidence
 * - Submit attestation signature
 * 
 * Accessed via magic link token (no login required)
 */

import React, { useState, useCallback, useRef } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Upload, 
  Link as LinkIcon,
  XCircle,
  Loader2,
  Shield,
  Calendar,
  Building2,
  PenLine,
  CheckCheck,
  AlertCircle,
  FileUp,
  ChevronDown
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AttestationData {
  tokenValid: boolean;
  token: {
    email: string;
    recipientName: string | null;
    canUploadEvidence: boolean;
    canAttest: boolean;
    expiresAt: string;
    personalMessage: string | null;
  };
  task: {
    id: number;
    title: string;
    description: string | null;
    instructions: string | null;
    dueDate: string | null;
    status: string;
    priority: string;
    evidenceRequired: boolean;
    evidenceType: string;
    evidenceInstructions: string | null;
    isConfidential: boolean;
    confidentialDataTypes: string[] | null;
    externalSystemReference: string | null;
    assignedRole: string | null;
    responsibleOffice?: string | null;
    attestationStatus: string;
    regulation: {
      id: number;
      name: string;
      topic: string | null;
    } | null;
  };
  existingEvidence: Array<{
    id: number;
    fileName: string;
    fileType: string | null;
    uploadedAt: string | null;
    description: string | null;
  }>;
}

const AttestationPage: React.FC = () => {
  const [, params] = useRoute<{ token: string }>('/attest/:token');
  const token = params?.token;
  const queryClient = useQueryClient();

  // Form state
  const [signature, setSignature] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const [externalReference, setExternalReference] = useState('');
  const attestationCardRef = useRef<HTMLDivElement>(null);

  // Fetch attestation data
  const { data, isLoading, error, refetch } = useQuery<AttestationData>({
    queryKey: ['attestation', token],
    queryFn: async () => {
      const response = await fetch(`/api/compliance-tasks/attestation/${token}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify token');
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  // After evidence is added, collapse the card and scroll to attestation
  const collapseAndScrollToAttestation = useCallback(() => {
    setEvidenceOpen(false);
    // Small delay so the collapse animation starts before scrolling
    setTimeout(() => {
      attestationCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }, []);

  // Upload file mutation - for immediate file uploads
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('description', '');
      
      const response = await fetch(`/api/compliance-tasks/attestation/${token}/evidence`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      return response.json();
    },
    onSuccess: () => {
      setUploadSuccess(true);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      refetch();
      setTimeout(() => setUploadSuccess(false), 3000);
      collapseAndScrollToAttestation();
    },
  });

  // Add link mutation
  const addLinkMutation = useMutation({
    mutationFn: async () => {
      if (!linkUrl) throw new Error('Please enter a link URL');
      const response = await fetch(`/api/compliance-tasks/attestation/${token}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkUrl,
          linkTitle: linkTitle || linkUrl,
          description: evidenceDescription,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      return response.json();
    },
    onSuccess: () => {
      setUploadSuccess(true);
      setLinkUrl('');
      setLinkTitle('');
      setEvidenceDescription('');
      refetch();
      setTimeout(() => setUploadSuccess(false), 3000);
      collapseAndScrollToAttestation();
    },
  });

  // Save external system reference (for confidential tasks)
  const saveExternalReferenceMutation = useMutation({
    mutationFn: async () => {
      if (!externalReference.trim()) throw new Error('Please specify where this evidence is maintained');
      const response = await fetch(`/api/compliance-tasks/attestation/${token}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkUrl: `external-ref://${externalReference.trim()}`,
          linkTitle: `External System: ${externalReference.trim()}`,
          description: `Confidential evidence maintained in: ${externalReference.trim()}`,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save reference');
      }
      return response.json();
    },
    onSuccess: () => {
      setUploadSuccess(true);
      setExternalReference('');
      refetch();
      setTimeout(() => setUploadSuccess(false), 3000);
      collapseAndScrollToAttestation();
    },
  });

  // Delete evidence mutation
  const deleteEvidenceMutation = useMutation({
    mutationFn: async (evidenceId: number) => {
      const response = await fetch(`/api/compliance-tasks/attestation/${token}/evidence/${evidenceId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove evidence');
      }
      return response.json();
    },
    onSuccess: () => {
      refetch();
    },
  });

  // Submit attestation mutation
  const attestMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/compliance-tasks/attestation/${token}/attest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature, notes }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Attestation failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attestation', token] });
    },
  });

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      uploadFileMutation.mutate(file);
    }
  }, [uploadFileMutation]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      uploadFileMutation.mutate(file);
    }
  }, [uploadFileMutation]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Already attested - check this FIRST before error state
  // (because successful submission invalidates query which returns error)
  if (attestMutation.isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-green-200">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto p-4 bg-green-100 rounded-full w-fit mb-4">
              <CheckCheck className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-green-700 text-2xl">Attestation Complete</CardTitle>
            <CardDescription className="text-lg">Thank you for your attestation!</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-slate-600 mb-4">
              Your compliance attestation has been successfully recorded.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
              <p>A copy of this attestation has been saved for audit purposes.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-full">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-red-700">Invalid or Expired Link</CardTitle>
                <CardDescription>This attestation link is no longer valid.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 text-sm">
              {(error as Error)?.message || 'The link may have expired or been used already.'} 
              Please contact your compliance officer for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { task, token: tokenData, existingEvidence } = data;
  const canSubmitAttestation = !task.evidenceRequired || existingEvidence.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border mb-4">
            <Shield className="h-5 w-5 text-emerald-600" />
            <span className="font-semibold text-slate-700">EdSteward Compliance Attestation</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Task Attestation Required</h1>
          <p className="text-slate-600">
            Hello {tokenData.recipientName || tokenData.email}, please review and attest to the following compliance task.
          </p>
        </div>

        {/* Personal Message */}
        {tokenData.personalMessage && (
          <Alert className="mb-6 bg-blue-50 border-blue-200">
            <FileText className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-700">Message from Compliance Team</AlertTitle>
            <AlertDescription className="text-blue-600">{tokenData.personalMessage}</AlertDescription>
          </Alert>
        )}

        {/* Task Details Card */}
        <Card className="mb-6 shadow-lg border-slate-200">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="text-xl text-slate-900 mb-2">{task.title}</CardTitle>
                {task.regulation && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Building2 className="h-4 w-4" />
                    <span>{task.regulation.name}</span>
                  </div>
                )}
              </div>
              <Badge className={getPriorityColor(task.priority)}>
                {task.priority} priority
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {task.description && (
              <div>
                <h2 className="font-semibold text-slate-700 mb-1">Description</h2>
                <p className="text-slate-600">{task.description}</p>
              </div>
            )}

            {task.instructions && (
              <div>
                <h2 className="font-semibold text-slate-700 mb-1">Instructions</h2>
                <p className="text-slate-600 whitespace-pre-wrap">{task.instructions}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              {task.dueDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-600">
                    Due: {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              )}
              {((task as any).responsibleOffice || task.assignedRole) && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-600">
                    {(task as any).responsibleOffice
                      ? `${(task as any).responsibleOffice}${task.assignedRole ? ` — ${task.assignedRole}` : ''}`
                      : `Suggested: ${task.assignedRole}`}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Evidence Section - Collapsible */}
        {tokenData.canUploadEvidence && (
          <Collapsible open={evidenceOpen} onOpenChange={setEvidenceOpen}>
          <Card className="mb-6 shadow-lg border-slate-200 transition-all duration-300">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer select-none hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {existingEvidence.length > 0 && !evidenceOpen ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <FileUp className="h-5 w-5 text-amber-600" />
                    )}
                    {task.isConfidential ? 'Evidence Reference' : 'Evidence Upload'}
                    {task.isConfidential && (
                      <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-700 border-amber-200">Confidential</Badge>
                    )}
                    {task.evidenceRequired && existingEvidence.length === 0 && (
                      <Badge variant="destructive" className="ml-2">Required</Badge>
                    )}
                    {existingEvidence.length > 0 && (
                      <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700 border-green-200">
                        {existingEvidence.length} uploaded
                      </Badge>
                    )}
                  </CardTitle>
                  <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${evidenceOpen ? 'rotate-180' : ''}`} />
                </div>
                {evidenceOpen ? (
                  <CardDescription>
                    {task.evidenceInstructions || 'Upload documentation to support your attestation.'}
                  </CardDescription>
                ) : existingEvidence.length > 0 ? (
                  <p className="text-sm text-green-600 mt-1">
                    {existingEvidence.map(ev => ev.fileName).join(', ')}
                  </p>
                ) : (
                  <CardDescription>Click to expand and upload evidence.</CardDescription>
                )}
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            <CardContent className="space-y-4 pt-0">
              {/* Existing Evidence - with remove buttons */}
              {existingEvidence.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-700 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Evidence Uploaded ({existingEvidence.length})
                  </h4>
                  <ul className="space-y-2">
                    {existingEvidence.map((ev) => (
                      <li key={ev.id} className="flex items-center justify-between bg-white/60 rounded-md px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-sm text-slate-700 truncate">{ev.fileName}</span>
                          {ev.uploadedAt && (
                            <span className="text-slate-400 text-xs flex-shrink-0">
                              {new Date(ev.uploadedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0 h-7 w-7 p-0"
                          disabled={deleteEvidenceMutation.isPending}
                          onClick={() => deleteEvidenceMutation.mutate(ev.id)}
                        >
                          {deleteEvidenceMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {uploadSuccess && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">Evidence uploaded successfully!</AlertDescription>
                </Alert>
              )}

              {task.isConfidential ? (
                <>
                  {/* Confidential Evidence — External Reference Input */}
                  <Alert className="bg-amber-50 border-amber-200">
                    <Shield className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">Confidential Evidence</AlertTitle>
                    <AlertDescription className="text-amber-700">
                      This task involves protected data{task.confidentialDataTypes && task.confidentialDataTypes.length > 0
                        ? ` (${task.confidentialDataTypes.map(t => t.replace(/_/g, ' ')).join(', ')})`
                        : ''
                      }. Instead of uploading the actual documents, specify the system or location where this evidence is maintained.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="external-ref" className="text-sm font-medium text-slate-700">
                        Where is this evidence maintained?
                      </Label>
                      <Input
                        id="external-ref"
                        value={externalReference}
                        onChange={(e) => setExternalReference(e.target.value)}
                        placeholder='e.g., "See Maxient — Case #1234" or "Banner Student Records"'
                        className="mt-1"
                      />
                      <p className="mt-1 text-xs text-slate-400">
                        Name the system, office, or location where confidential records are stored
                      </p>
                    </div>
                    <Button
                      onClick={() => saveExternalReferenceMutation.mutate()}
                      disabled={!externalReference.trim() || saveExternalReferenceMutation.isPending}
                      size="sm"
                    >
                      {saveExternalReferenceMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4 mr-2" />
                          Save Reference
                        </>
                      )}
                    </Button>
                  </div>

                  {saveExternalReferenceMutation.error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{(saveExternalReferenceMutation.error as Error).message}</AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <>
                  {/* Standard File Upload Drop Zone */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => !uploadFileMutation.isPending && fileInputRef.current?.click()}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') !uploadFileMutation.isPending && fileInputRef.current?.click(); }}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`
                      relative rounded-lg border-2 border-dashed transition-all duration-200
                      ${uploadFileMutation.isPending
                        ? 'border-blue-300 bg-blue-50/50 cursor-wait'
                        : isDragging
                          ? 'border-blue-400 bg-blue-50 cursor-pointer'
                          : 'border-slate-300 bg-slate-50/50 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer'
                      }
                      p-6
                    `}
                  >
                    <input
                      ref={fileInputRef}
                      id="evidence-file"
                      type="file"
                      onChange={handleFileChange}
                      className="sr-only"
                      disabled={uploadFileMutation.isPending}
                    />
                    {uploadFileMutation.isPending ? (
                      <div className="text-center">
                        <Loader2 className="mx-auto h-8 w-8 text-blue-500 animate-spin" />
                        <p className="mt-2 text-sm font-medium text-blue-700">
                          Uploading {selectedFile?.name}...
                        </p>
                        <p className="mt-1 text-xs text-blue-400">
                          {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : ''}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className={`mx-auto h-8 w-8 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
                        <p className="mt-2 text-sm font-medium text-slate-700">
                          Click to choose a file{' '}
                          <span className="text-slate-400 font-normal">or drag and drop</span>
                        </p>
                        <p className="mt-1 text-xs text-slate-400">PDF, DOC, XLS, images up to 10MB</p>
                      </div>
                    )}
                  </div>

                  {uploadFileMutation.error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{(uploadFileMutation.error as Error).message}</AlertDescription>
                    </Alert>
                  )}

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-3 text-slate-400 uppercase tracking-wider">or add a link</span>
                    </div>
                  </div>

                  {/* Link Fields */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="link-url" className="text-xs text-slate-500">Link URL</Label>
                        <Input
                          id="link-url"
                          type="url"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          placeholder="https://..."
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="link-title" className="text-xs text-slate-500">Link Title</Label>
                        <Input
                          id="link-title"
                          value={linkTitle}
                          onChange={(e) => setLinkTitle(e.target.value)}
                          placeholder="Name of the document or resource"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="evidence-desc" className="text-xs text-slate-500">Description (optional)</Label>
                      <Input
                        id="evidence-desc"
                        value={evidenceDescription}
                        onChange={(e) => setEvidenceDescription(e.target.value)}
                        placeholder="Brief description of this evidence"
                        className="mt-1"
                      />
                    </div>
                    <Button
                      onClick={() => addLinkMutation.mutate()}
                      disabled={!linkUrl || addLinkMutation.isPending}
                      size="sm"
                    >
                      {addLinkMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <LinkIcon className="h-4 w-4 mr-2" />
                          Add Link
                        </>
                      )}
                    </Button>
                  </div>

                  {addLinkMutation.error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{(addLinkMutation.error as Error).message}</AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              {deleteEvidenceMutation.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{(deleteEvidenceMutation.error as Error).message}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            </CollapsibleContent>
          </Card>
          </Collapsible>
        )}

        {/* Attestation Form */}
        <Card ref={attestationCardRef} className="shadow-lg border-emerald-200">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 border-b border-emerald-100">
            <CardTitle className="flex items-center gap-2 text-emerald-700">
              <PenLine className="h-5 w-5" />
              Submit Attestation
            </CardTitle>
            <CardDescription>
              By signing below, you attest that you have completed or verified this compliance requirement.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {!canSubmitAttestation && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Evidence Required</AlertTitle>
                <AlertDescription>
                  Please upload the required evidence above before submitting your attestation.
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="signature" className="text-base font-semibold">
                Digital Signature <span className="text-red-500">*</span>
              </Label>
              <p className="text-sm text-slate-500 mb-2">
                Type your full legal name as your digital signature
              </p>
              <Input
                id="signature"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Full Legal Name"
                className="text-lg"
                disabled={!canSubmitAttestation}
              />
            </div>

            <div>
              <Label htmlFor="notes">Additional Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional comments or context..."
                rows={3}
                className="mt-1"
                disabled={!canSubmitAttestation}
              />
            </div>

            {attestMutation.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{(attestMutation.error as Error).message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="bg-slate-50 border-t flex items-center justify-between p-6">
            <p className="text-xs text-slate-500">
              Link expires: {new Date(tokenData.expiresAt).toLocaleDateString()}
            </p>
            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => attestMutation.mutate()}
              disabled={!signature.trim() || !canSubmitAttestation || attestMutation.isPending}
            >
              {attestMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Submit Attestation
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-slate-500">
          <p>EdSteward Compliance Management Platform</p>
          <p className="mt-1">Questions? Contact your compliance officer.</p>
        </div>
      </div>
    </div>
  );
};

export default AttestationPage;
