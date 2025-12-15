/**
 * Email Attestation Confirmation Page
 * 
 * This page is accessed via a secure link sent to field compliance officers.
 * No login is required - the token in the URL provides authentication.
 * 
 * The page shows:
 * 1. What regulation they're attesting to
 * 2. The specific attestation statement
 * 3. Legal disclaimers
 * 4. A confirm button
 */

import { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FileText, 
  Shield,
  XCircle,
  Loader2
} from 'lucide-react';

interface AttestationData {
  valid: boolean;
  attestation: {
    regulationName: string;
    regulationId: number;
    statute?: string;
    attestationType: string;
    attestationStatement: string;
    attestationPeriod?: string;
    expiresAt: string;
    user: {
      email: string;
      name: string;
    };
  };
}

interface ConfirmResult {
  success: boolean;
  completedAt: string;
  regulation: {
    id: number;
    name: string;
  };
  attestedBy: string;
}

export default function AttestationPage() {
  const params = useParams();
  const token = params.token as string;
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);

  // Verify the token
  const { data, isLoading, error } = useQuery<AttestationData>({
    queryKey: ['attestation', token],
    queryFn: async () => {
      const response = await fetch(`/api/attestation/verify/${token}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify attestation');
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  // Confirm attestation mutation
  const confirmMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/attestation/confirm/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to confirm attestation');
      }
      return response.json();
    },
    onSuccess: (result: ConfirmResult) => {
      setConfirmed(true);
      setConfirmResult(result);
    },
  });

  // Handle confirm
  const handleConfirm = () => {
    if (acknowledged) {
      confirmMutation.mutate();
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-muted-foreground">Verifying attestation link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isExpired = errorMessage.includes('expired');
    const isUsed = errorMessage.includes('already been completed');
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
              isUsed ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {isUsed ? (
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              ) : isExpired ? (
                <Clock className="h-8 w-8 text-amber-600" />
              ) : (
                <XCircle className="h-8 w-8 text-red-600" />
              )}
            </div>
            <CardTitle className={isUsed ? 'text-green-700' : 'text-red-700'}>
              {isUsed ? 'Attestation Already Completed' : isExpired ? 'Link Expired' : 'Invalid Link'}
            </CardTitle>
            <CardDescription className="mt-2">
              {errorMessage}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            {!isUsed && (
              <p className="text-sm text-muted-foreground">
                If you need a new attestation link, please contact your Chief Compliance Officer.
              </p>
            )}
            {isUsed && (
              <p className="text-sm text-muted-foreground">
                Your attestation was recorded successfully. No further action is needed.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success confirmation screen
  if (confirmed && confirmResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-green-200">
          <CardHeader className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-green-700 text-2xl">Attestation Complete</CardTitle>
            <CardDescription className="mt-2 text-base">
              Your compliance attestation has been recorded successfully.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-green-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Regulation:</span>
                <span className="font-medium">{confirmResult.regulation.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Attested by:</span>
                <span className="font-medium">{confirmResult.attestedBy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium">
                  {new Date(confirmResult.completedAt).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
            
            <Alert className="mt-6 bg-blue-50 border-blue-200">
              <Shield className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">Record Created</AlertTitle>
              <AlertDescription className="text-blue-700">
                This attestation has been logged in the compliance system and will be retained for audit purposes.
              </AlertDescription>
            </Alert>
            
            <p className="text-sm text-center text-muted-foreground mt-6">
              You may close this window. No further action is required.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main attestation form
  const attestation = data?.attestation;
  if (!attestation) {
    return null;
  }

  const expiresAt = new Date(attestation.expiresAt);
  const daysRemaining = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800">Compliance Attestation</h1>
          <p className="text-muted-foreground mt-1">EdSteward Compliance Management System</p>
        </div>

        {/* Main Card */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">{attestation.regulationName}</CardTitle>
                {attestation.statute && (
                  <CardDescription className="text-blue-100 mt-1">
                    {attestation.statute}
                  </CardDescription>
                )}
              </div>
              <Badge variant="secondary" className="bg-blue-500 text-white border-0">
                {attestation.attestationType}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="pt-6 space-y-6">
            {/* DRI Signature Block - Prominent display of who is attesting */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-5 border-2 border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Directly Responsible Individual</p>
                  <p className="text-xl font-bold text-slate-800">{attestation.user.name}</p>
                  <p className="text-sm text-muted-foreground">{attestation.user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm pt-2 border-t border-blue-200">
                <div>
                  <span className="text-muted-foreground">Period:</span>
                  <span className="font-medium ml-1">{attestation.attestationPeriod || 'Current Period'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium ml-1">{attestation.attestationType}</span>
                </div>
              </div>
            </div>

            {/* Attestation Statement */}
            <div className="bg-slate-50 rounded-lg p-4 border">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold">Attestation Statement</h3>
              </div>
              <p className="text-slate-700 whitespace-pre-wrap">
                {attestation.attestationStatement}
              </p>
            </div>

            {/* Legal Notice */}
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Important Notice</AlertTitle>
              <AlertDescription className="text-amber-700 text-sm space-y-2">
                <p>By confirming this attestation, you acknowledge that:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>You have reviewed the compliance requirements for this regulation</li>
                  <li>The institution is in compliance with all applicable requirements</li>
                  <li>You are authorized as the DRI to make this attestation on behalf of the institution</li>
                  <li>This attestation will be recorded and may be subject to audit</li>
                  <li>False attestation may result in disciplinary action</li>
                </ul>
              </AlertDescription>
            </Alert>

            {/* Acknowledgment Checkbox */}
            <div className="flex items-start space-x-3 p-4 bg-slate-50 rounded-lg border">
              <Checkbox 
                id="acknowledge" 
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
                className="mt-1"
              />
              <label 
                htmlFor="acknowledge" 
                className="text-sm cursor-pointer"
              >
                I have read and understand the attestation statement above. I confirm that the 
                information is accurate to the best of my knowledge and that I am authorized to 
                make this attestation.
              </label>
            </div>

            {/* Expiration Warning */}
            {daysRemaining <= 3 && (
              <Alert variant="destructive" className="bg-red-50 border-red-200">
                <Clock className="h-4 w-4" />
                <AlertTitle>Link Expiring Soon</AlertTitle>
                <AlertDescription>
                  This attestation link will expire in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}.
                  Please complete your attestation before {expiresAt.toLocaleDateString()}.
                </AlertDescription>
              </Alert>
            )}

            {/* Confirm Button */}
            <div className="pt-4">
              <Button 
                onClick={handleConfirm}
                disabled={!acknowledged || confirmMutation.isPending}
                className="w-full h-12 text-lg bg-green-600 hover:bg-green-700"
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Confirm Compliance Attestation
                  </>
                )}
              </Button>
              
              {confirmMutation.isError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {confirmMutation.error instanceof Error 
                      ? confirmMutation.error.message 
                      : 'Failed to confirm attestation. Please try again.'}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          This is a secure link generated by EdSteward Compliance Management System.
          <br />
          If you have questions, contact your Chief Compliance Officer.
        </p>
      </div>
    </div>
  );
}


