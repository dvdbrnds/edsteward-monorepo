/**
 * @module MFASetup
 * @description Multi-Factor Authentication setup component for HECVAT 4.0 compliance
 */

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, Smartphone, Key, Copy, CheckCircle, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MFASetupData {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

interface MFAStatus {
  enabled: boolean;
  setupAt?: string;
}

/**
 * @component MFASetup
 * @description Complete MFA setup wizard with QR code generation and backup codes
 */
export default function MFASetup() {
  const [verificationCode, setVerificationCode] = useState("");
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const { toast } = useToast();

  // Check current MFA status
  const { data: mfaStatus, refetch: refetchStatus } = useQuery<MFAStatus>({
    queryKey: ["mfa-status"],
    queryFn: () => apiRequest("GET", "/api/mfa/status"),
  });

  // Generate MFA setup data
  const { data: setupData, mutate: generateSetup, isPending: isGenerating } = useMutation<MFASetupData>({
    mutationFn: () => apiRequest("POST", "/api/mfa/setup/generate"),
    onError: (error: any) => {
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to generate MFA setup",
        variant: "destructive",
      });
    },
  });

  // Verify and enable MFA
  const { mutate: verifyAndEnable, isPending: isVerifying } = useMutation({
    mutationFn: (code: string) =>
      apiRequest("POST", "/api/mfa/setup/verify", { code }),
    onSuccess: () => {
      toast({
        title: "MFA Enabled Successfully",
        description: "Your account is now protected with multi-factor authentication",
      });
      setShowBackupCodes(true);
      refetchStatus();
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid verification code",
        variant: "destructive",
      });
    },
  });

  // Generate backup codes
  const { data: backupCodes, mutate: generateBackupCodes, isPending: isGeneratingCodes } = useMutation<{ codes: string[] }>({
    mutationFn: () => apiRequest("POST", "/api/mfa/backup-codes/generate"),
    onError: (error: any) => {
      toast({
        title: "Backup Code Generation Failed",
        description: error.message || "Failed to generate backup codes",
        variant: "destructive",
      });
    },
  });

  const handleVerifyCode = () => {
    if (!verificationCode.trim()) {
      toast({
        title: "Verification Required",
        description: "Please enter the 6-digit code from your authenticator app",
        variant: "destructive",
      });
      return;
    }
    verifyAndEnable(verificationCode);
  };

  const copyBackupCodes = () => {
    const codes = setupData?.backupCodes || backupCodes?.codes || [];
    const codeText = codes.join("\n");
    navigator.clipboard.writeText(codeText);
    setCopiedCodes(true);
    toast({
      title: "Backup Codes Copied",
      description: "Save these codes in a secure location",
    });
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  if (mfaStatus?.enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Multi-Factor Authentication
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Enabled
            </Badge>
          </CardTitle>
          <CardDescription>
            Your account is protected with MFA. Set up on {new Date(mfaStatus.setupAt!).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              ✅ HECVAT 4.0 Compliant: Your account meets university security requirements
            </AlertDescription>
          </Alert>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => generateBackupCodes()}
              disabled={isGeneratingCodes}
            >
              {isGeneratingCodes && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate New Backup Codes
            </Button>
          </div>

          {backupCodes && (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  New Backup Codes Generated
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {backupCodes.codes.map((code, index) => (
                    <div key={index} className="bg-white p-2 rounded border">
                      {code}
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyBackupCodes}
                  className="mt-3"
                >
                  {copiedCodes ? <CheckCircle className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copiedCodes ? "Copied!" : "Copy All Codes"}
                </Button>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Set Up Multi-Factor Authentication
          </CardTitle>
          <CardDescription>
            Enhance your account security with Google Authenticator (HECVAT 4.0 requirement)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>HECVAT 4.0 Compliance:</strong> MFA is required for local accounts to meet university security standards.
            </AlertDescription>
          </Alert>

          {!setupData ? (
            <Button onClick={() => generateSetup()} disabled={isGenerating}>
              {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Smartphone className="mr-2 h-4 w-4" />
              Start MFA Setup
            </Button>
          ) : (
            <div className="space-y-6">
              {/* Step 1: QR Code */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Step 1: Scan QR Code</h3>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-shrink-0">
                    <div className="bg-white p-4 rounded-lg border inline-block">
                      <img
                        src={setupData.qrCode}
                        alt="MFA QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        1. Install Google Authenticator on your phone
                      </p>
                      <p className="text-sm text-gray-600">
                        2. Tap "+" to add a new account
                      </p>
                      <p className="text-sm text-gray-600">
                        3. Scan this QR code with your camera
                      </p>
                      <p className="text-sm text-gray-600">
                        4. Enter the 6-digit code below to verify
                      </p>
                    </div>
                    <div className="mt-4 p-3 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500 mb-1">Manual entry key:</p>
                      <code className="text-sm font-mono break-all">{setupData.secret}</code>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Verification */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Step 2: Verify Setup</h3>
                <div className="flex gap-3 max-w-md">
                  <div className="flex-1">
                    <Label htmlFor="verification-code">6-digit code from app</Label>
                    <Input
                      id="verification-code"
                      type="text"
                      placeholder="123456"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      maxLength={6}
                      className="text-center text-lg font-mono"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleVerifyCode}
                      disabled={isVerifying || verificationCode.length !== 6}
                    >
                      {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Verify & Enable
                    </Button>
                  </div>
                </div>
              </div>

              {/* Backup Codes Preview */}
              {showBackupCodes && setupData.backupCodes && (
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Backup Recovery Codes
                    </CardTitle>
                    <CardDescription>
                      Save these codes in a secure location. Each can only be used once.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                      {setupData.backupCodes.map((code, index) => (
                        <div key={index} className="bg-white p-2 rounded border">
                          {code}
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyBackupCodes}
                      className="mt-3"
                    >
                      {copiedCodes ? <CheckCircle className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                      {copiedCodes ? "Copied!" : "Copy All Codes"}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
