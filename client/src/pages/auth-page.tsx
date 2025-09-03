import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useBranding } from "@/hooks/use-branding";

// Import logos
import moravianLogo from "../assets/Moravian-Monogram-MoravianBlue.png";
import genericLogo from "../assets/generic-logo.svg";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [_, setLocation] = useLocation();
  const branding = useBranding();

  const loginForm = useForm({
    resolver: zodResolver(insertUserSchema.pick({ username: true, password: true })),
    defaultValues: {
      username: "",
      password: ""
    }
  });

  const registerForm = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      firstName: "",
      lastName: "",
      role: "user" as const,
      department: ""
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

  return (
    <div 
      className="min-h-screen flex"
      style={{ backgroundColor: branding.loginScreenBackgroundColor }}
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

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>Login to your account</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
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
                        Login
                      </Button>
                    </form>
                  </Form>
                  
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
                            window.location.href = '/auth/saml/login/moravian';
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
            </TabsContent>

            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>Create new account</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit((data) => registerMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={registerForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
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
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
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
                      <FormField
                        control={registerForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <FormControl>
                              <select {...field} className="w-full p-2 border rounded">
                                <option value="user">User</option>
                                <option value="compliance_officer">Compliance Officer</option>
                                <option value="admin">Admin</option>
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="department"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Department</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full bg-[#002147] hover:bg-[#003166]" disabled={registerMutation.isPending}>
                        {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Register
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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