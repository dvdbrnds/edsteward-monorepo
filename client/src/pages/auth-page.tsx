import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { useBranding } from "@/hooks/use-branding";

// Import logos
import moravianLogo from "../assets/Moravian-Monogram-MoravianBlue.png";

export default function AuthPage() {
  const { user, loginMutation } = useAuth();
  const [, setLocation] = useLocation();
  const branding = useBranding();
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [loginCredentials, setLoginCredentials] = useState<{ username: string; password: string } | null>(null);

  const loginForm = useForm({
    resolver: zodResolver(insertUserSchema.pick({ username: true, password: true })),
    defaultValues: {
      username: "",
      password: ""
    }
  });

  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  if (user) {
    return null;
  }

  // Force light mode CSS variables for auth page
  const lightModeStyle = {
    backgroundColor: branding.loginScreenBackgroundColor,
    '--background': '0 0% 100%',
    '--foreground': '222.2 84% 4.9%',
    '--card': '0 0% 100%',
    '--card-foreground': '222.2 84% 4.9%',
    '--popover': '0 0% 100%',
    '--popover-foreground': '222.2 84% 4.9%',
    '--primary': '222.2 47.4% 11.2%',
    '--primary-foreground': '210 40% 98%',
    '--secondary': '210 40% 96.1%',
    '--secondary-foreground': '222.2 47.4% 11.2%',
    '--muted': '210 40% 96.1%',
    '--muted-foreground': '215.4 16.3% 46.9%',
    '--accent': '210 40% 96.1%',
    '--accent-foreground': '222.2 47.4% 11.2%',
    '--destructive': '0 84.2% 60.2%',
    '--destructive-foreground': '210 40% 98%',
    '--border': '214.3 31.8% 91.4%',
    '--input': '214.3 31.8% 91.4%',
    '--ring': '222.2 84% 4.9%',
  } as React.CSSProperties;

  return (
    <div 
      className="min-h-screen flex"
      style={lightModeStyle}
    >
      {/* Form Section */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          {/* Logo centered above the title */}
          <div className="flex items-center justify-center mb-8">
            <img 
              src={branding.logoUrl || moravianLogo}
              alt={`${branding.institutionName} Logo`}
              className="h-20 w-auto"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                console.warn('Auth page logo failed to load:', branding.logoUrl, 'Falling back to moravian logo');
                // Only fallback if we haven't already fallen back
                if (target.src !== moravianLogo) {
                  target.src = moravianLogo;
                }
              }}
              onLoad={() => {
                console.log('Auth page logo loaded successfully:', branding.logoUrl);
              }}
            />
          </div>

          <h1 className="text-3xl font-bold mb-8 text-center" style={{ color: branding.loginScreenTextColor }}>
            {branding.institutionName}
            <br />
            <span className="text-xl font-normal opacity-90">Compliance Portal</span>
          </h1>

          <Card>
            <CardHeader>
              <CardTitle>Sign in to your account</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit((data) => {
                  setLoginCredentials(data);
                  loginMutation.mutate(data, {
                    onSuccess: (response: any) => {
                      if (response.mfaRequired) {
                        setMfaRequired(true);
                      }
                    }
                  });
                })} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {!mfaRequired && (
                    <Button 
                      type="submit" 
                      className="w-full hover:opacity-90 transition-opacity" 
                      style={{ 
                        backgroundColor: branding.loginScreenAccentColor, 
                        borderColor: branding.loginScreenAccentColor 
                      }}
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign In
                    </Button>
                  )}
                </form>
              </Form>

              {/* MFA Code Input */}
              {mfaRequired && (
                <div className="mt-6 space-y-4">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold">Multi-Factor Authentication</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Enter the 6-digit code from your authenticator app
                    </p>
                  </div>
                  <div className="space-y-4">
                    <Input
                      type="text"
                      placeholder="000000"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="text-center text-lg tracking-widest"
                      maxLength={6}
                    />
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setMfaRequired(false);
                          setMfaCode("");
                          setLoginCredentials(null);
                        }}
                        className="flex-1"
                      >
                        Back
                      </Button>
                      <Button
                        onClick={() => {
                          if (loginCredentials && mfaCode.length === 6) {
                            loginMutation.mutate({
                              ...loginCredentials,
                              mfaCode
                            });
                          }
                        }}
                        disabled={mfaCode.length !== 6 || loginMutation.isPending}
                        className="flex-1"
                        style={{ 
                          backgroundColor: branding.loginScreenAccentColor, 
                          borderColor: branding.loginScreenAccentColor 
                        }}
                      >
                        {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Verify
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* SAML SSO Login - show for institutions that have SAML configured */}
              {branding.institutionName.toLowerCase().includes('moravian') && (
                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or continue with
                      </span>
                    </div>
                  </div>
                  <div className="mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        window.location.href = 'https://moravian.edsteward.ai/auth/saml';
                      }}
                    >
                      <img 
                        src="https://www.okta.com/sites/default/files/Okta_Logo_BrightBlue_Medium.png" 
                        alt="Okta" 
                        className="mr-2 h-4 w-4"
                      />
                      Sign in with Moravian University SSO
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hero Section */}
      <div className="hidden lg:block relative w-0 flex-1" style={{ backgroundColor: branding.loginScreenHeroColor }}>
        <div 
          className="absolute inset-0 bg-gradient-to-br opacity-90" 
          style={{ 
            background: `linear-gradient(to bottom right, ${branding.loginScreenHeroColor}, ${branding.loginScreenHeroColor}dd)` 
          }} 
        />
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="text-white max-w-2xl">
            <h2 className="text-4xl font-bold mb-6">
              Streamline Regulatory Compliance
            </h2>
            <ul className="space-y-4 text-lg">
              <li>✓ Centralized compliance tracking</li>
              <li>✓ Automated deadline notifications</li>
              <li>✓ Comprehensive reporting tools</li>
              <li>✓ Role-based access control</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}