/**
 * @module AccountSettingsPage
 * @description User account settings page with MFA configuration
 */

import { useAuth } from "@/hooks/use-auth";
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Shield, Mail, Calendar, Building } from "lucide-react";
import MFASetup from "@/components/features/mfa/mfa-setup";

/**
 * @component AccountSettingsPage
 * @description Complete account settings page with user info and MFA setup
 */
export default function AccountSettingsPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please log in to access account settings.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Account Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account security and preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* User Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>
              Your basic account details and role information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Username</label>
                  <p className="text-lg font-semibold">{user.username}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    Email
                  </label>
                  <p className="text-lg">{user.email || "Not provided"}</p>
                </div>

                {user.firstName && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">First Name</label>
                    <p className="text-lg">{user.firstName}</p>
                  </div>
                )}

                {user.lastName && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                    <p className="text-lg">{user.lastName}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Role</label>
                  <div className="flex items-center gap-2">
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                    {user.role === 'admin' && (
                      <span className="text-sm text-muted-foreground">Full system access</span>
                    )}
                  </div>
                </div>

                {user.department && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Building className="h-4 w-4" />
                      Department
                    </label>
                    <p className="text-lg">{user.department}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Account Type</label>
                  <div className="flex items-center gap-2">
                    {user.identityProvider === 'saml' ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        SAML/SSO Account
                      </Badge>
                    ) : user.identityProvider === 'local_emergency' ? (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        Emergency Admin
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-background text-foreground border-border">
                        Local Account
                      </Badge>
                    )}
                  </div>
                </div>

                {user.lastLogin && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Last Login
                    </label>
                    <p className="text-lg">{new Date(user.lastLogin).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* MFA Settings - Only show for local accounts */}
        {user.identityProvider !== 'saml' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Multi-Factor Authentication
              </CardTitle>
              <CardDescription>
                Enhance your account security with Google Authenticator (HECVAT 4.0 requirement)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MFASetup />
            </CardContent>
          </Card>
        )}

        {/* SAML Account Notice */}
        {user.identityProvider === 'saml' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Multi-Factor Authentication
              </CardTitle>
              <CardDescription>
                Your account security is managed by your organization's SSO system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-900">SSO Protected Account</span>
                </div>
                <p className="text-blue-800 text-sm">
                  Your account is authenticated through your organization's Single Sign-On (SSO) system. 
                  Multi-factor authentication and other security settings are managed by your IT administrator.
                </p>
                <p className="text-blue-700 text-xs mt-2">
                  ✅ HECVAT 4.0 Compliant: SSO accounts meet university security requirements
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
}







