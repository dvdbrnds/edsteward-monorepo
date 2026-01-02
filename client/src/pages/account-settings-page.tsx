/**
 * @module AccountSettingsPage
 * @description User account settings page with MFA configuration
 */

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Shield, Mail, Calendar, Building, Bell, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MFASetup from "@/components/features/mfa/mfa-setup";

interface NotificationPreferences {
  emailEnabled: boolean;
  emailFrequency: 'instant' | 'daily' | 'weekly';
  deadlineReminders: boolean;
  updateNotifications: boolean;
  attestationReminders: boolean;
}

/**
 * @component AccountSettingsPage
 * @description Complete account settings page with user info and MFA setup
 */
export default function AccountSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailEnabled: true,
    emailFrequency: 'instant',
    deadlineReminders: true,
    updateNotifications: true,
    attestationReminders: true,
  });

  // Load preferences from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('notificationPreferences');
    if (saved) {
      try {
        setPreferences(JSON.parse(saved));
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }, []);

  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage (can be upgraded to API call later)
      localStorage.setItem('notificationPreferences', JSON.stringify(preferences));
      
      // Also try to save to server if available
      try {
        await fetch('/api/user/notification-preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(preferences),
        });
      } catch {
        // Server endpoint not available yet, localStorage is fine
      }
      
      toast({
        title: 'Preferences Saved',
        description: 'Your notification preferences have been updated.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save preferences. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

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

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Control how and when you receive compliance notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email Notifications Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-enabled">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive compliance updates via email
                </p>
              </div>
              <Switch
                id="email-enabled"
                checked={preferences.emailEnabled}
                onCheckedChange={(checked) => 
                  setPreferences(prev => ({ ...prev, emailEnabled: checked }))
                }
              />
            </div>

            {/* Email Frequency */}
            {preferences.emailEnabled && (
              <div className="space-y-2">
                <Label>Email Digest Frequency</Label>
                <Select
                  value={preferences.emailFrequency}
                  onValueChange={(value: 'instant' | 'daily' | 'weekly') =>
                    setPreferences(prev => ({ ...prev, emailFrequency: value }))
                  }
                >
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">
                      <span className="font-medium">Instant</span>
                      <span className="text-muted-foreground ml-2">- As they happen</span>
                    </SelectItem>
                    <SelectItem value="daily">
                      <span className="font-medium">Daily Digest</span>
                      <span className="text-muted-foreground ml-2">- Once per day</span>
                    </SelectItem>
                    <SelectItem value="weekly">
                      <span className="font-medium">Weekly Digest</span>
                      <span className="text-muted-foreground ml-2">- Once per week</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {preferences.emailFrequency === 'instant' && 
                    'You\'ll receive emails immediately when important events occur.'}
                  {preferences.emailFrequency === 'daily' && 
                    'You\'ll receive a summary email each morning with updates from the past 24 hours.'}
                  {preferences.emailFrequency === 'weekly' && 
                    'You\'ll receive a summary email each Monday with updates from the past week.'}
                </p>
              </div>
            )}

            {/* Notification Types */}
            <div className="space-y-4 pt-4 border-t">
              <Label className="text-base">Notification Types</Label>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="deadline-reminders" className="font-normal">Deadline Reminders</Label>
                  <p className="text-xs text-muted-foreground">
                    Get notified about upcoming compliance deadlines
                  </p>
                </div>
                <Switch
                  id="deadline-reminders"
                  checked={preferences.deadlineReminders}
                  onCheckedChange={(checked) => 
                    setPreferences(prev => ({ ...prev, deadlineReminders: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="update-notifications" className="font-normal">Regulation Updates</Label>
                  <p className="text-xs text-muted-foreground">
                    Be informed when regulations are updated
                  </p>
                </div>
                <Switch
                  id="update-notifications"
                  checked={preferences.updateNotifications}
                  onCheckedChange={(checked) => 
                    setPreferences(prev => ({ ...prev, updateNotifications: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="attestation-reminders" className="font-normal">Attestation Reminders</Label>
                  <p className="text-xs text-muted-foreground">
                    Reminders for pending attestation requests
                  </p>
                </div>
                <Switch
                  id="attestation-reminders"
                  checked={preferences.attestationReminders}
                  onCheckedChange={(checked) => 
                    setPreferences(prev => ({ ...prev, attestationReminders: checked }))
                  }
                />
              </div>
            </div>

            <div className="pt-4">
              <Button onClick={handleSavePreferences} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Preferences'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

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







