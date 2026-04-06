import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Settings, Users, Shield, BookOpen, CheckCircle2 } from "lucide-react";
import { Redirect, useLocation } from "wouter";

const SETUP_STEPS = [
  {
    id: "welcome",
    title: "Welcome",
    description: "Get oriented with your compliance portal",
    icon: BookOpen,
  },
  {
    id: "settings",
    title: "System Settings",
    description: "Configure your institution profile, branding, and notification preferences",
    icon: Settings,
  },
  {
    id: "users",
    title: "Add Users",
    description: "Create accounts for your compliance team and assign roles",
    icon: Users,
  },
  {
    id: "sso",
    title: "Single Sign-On",
    description: "Connect your institution's identity provider for seamless login",
    icon: Shield,
  },
];

export default function SetupWizardPage() {
  const { user } = useAuth();
  const branding = useBranding();
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);

  const institutionName = branding?.institutionName || "Your Institution";
  const progress = ((currentStep + 1) / SETUP_STEPS.length) * 100;

  if (!user) {
    return <Redirect to="/auth" />;
  }

  const renderWelcome = () => (
    <div className="space-y-4">
      <p className="text-gray-600">
        Welcome to the {institutionName} Compliance Portal. This quick guide will help you
        get your institution set up. You can complete these steps now or come back to them later
        from <strong>System Settings</strong>.
      </p>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">What's already set up:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Your database and regulations are loaded</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Your admin account is active</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Institution branding is configured</li>
        </ul>
      </div>
      <Button onClick={() => setCurrentStep(1)} className="w-full">
        Let's Get Started
      </Button>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-4">
      <p className="text-gray-600">
        Review your institution profile, branding colors, and notification preferences.
        These were set during provisioning but can be fine-tuned here.
      </p>
      <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
        <div><strong>Institution Type:</strong> Configured during setup (editable in Settings &gt; Institution)</div>
        <div><strong>Branding:</strong> Colors and logo (editable in Settings &gt; Branding)</div>
        <div><strong>Notifications:</strong> Email delivery settings (Settings &gt; Notifications)</div>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => navigate("/admin/settings")} className="flex-1">
          Open System Settings
        </Button>
        <Button onClick={() => setCurrentStep(2)} className="flex-1">
          Next: Add Users
        </Button>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-4">
      <p className="text-gray-600">
        Add your compliance team members. You can create local accounts now, or set up
        SSO in the next step so users authenticate through your institution's identity provider.
      </p>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h4 className="font-medium text-amber-900 mb-2">Recommended roles:</h4>
        <ul className="text-sm text-amber-800 space-y-1">
          <li><strong>Admin</strong> — Full access to settings, users, and all features</li>
          <li><strong>Compliance Officer</strong> — Manage regulations, tasks, and attestations</li>
          <li><strong>User</strong> — View regulations and complete assigned tasks</li>
        </ul>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => navigate("/admin/settings")} className="flex-1">
          Manage Users in Settings
        </Button>
        <Button onClick={() => setCurrentStep(3)} className="flex-1">
          Next: SSO Setup
        </Button>
      </div>
    </div>
  );

  const renderSSO = () => (
    <div className="space-y-4">
      <p className="text-gray-600">
        Single Sign-On allows your users to log in with their institutional credentials
        (Okta, Azure AD, Shibboleth, etc.). Your EdSteward administrator will configure
        this with your IT department.
      </p>
      <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
        <div><strong>SP Entity ID:</strong> <code className="bg-white px-1 rounded">urn:edsteward:sp:{user?.username?.split('@')[1]?.split('.')[0] || 'your-institution'}</code></div>
        <div><strong>Callback URL:</strong> <code className="bg-white px-1 rounded">https://{window.location.hostname}/auth/saml/callback</code></div>
        <p className="text-gray-500 mt-2">
          Share these details with your IT department when setting up the SAML integration.
          SSO can be configured at any time — it doesn't need to happen now.
        </p>
      </div>
      <Button onClick={() => navigate("/admin/settings")} className="w-full">
        Complete Setup — Go to Settings
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-2xl w-full px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {institutionName} Compliance Portal Setup
          </h1>
          <p className="text-muted-foreground">
            Complete the following steps to get your compliance portal ready.
          </p>
        </div>

        <Progress value={progress} className="mb-8" />

        <div className="space-y-4">
          {SETUP_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isCurrent = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <Card
                key={step.id}
                className={`transition-all ${isCurrent ? "ring-2 ring-primary" : ""} ${
                  isCompleted ? "opacity-60" : ""
                }`}
              >
                <CardHeader className="cursor-pointer" onClick={() => index <= currentStep && setCurrentStep(index)}>
                  <CardTitle className="flex items-center gap-3 text-base">
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Icon className="h-5 w-5 text-primary" />
                    )}
                    {step.title}
                  </CardTitle>
                </CardHeader>
                {isCurrent && (
                  <CardContent>
                    {step.id === "welcome" && renderWelcome()}
                    {step.id === "settings" && renderSettings()}
                    {step.id === "users" && renderUsers()}
                    {step.id === "sso" && renderSSO()}
                  </CardContent>
                )}
                {!isCurrent && !isCompleted && (
                  <CardContent>
                    <p className="text-muted-foreground text-sm">{step.description}</p>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
