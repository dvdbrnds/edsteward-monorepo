import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Shield, Users, ChartBar, Settings } from "lucide-react";
import { useEffect } from "react";

export default function AdminAuthPage() {
  const { user, loginMutation } = useAuth();
  const [_, setLocation] = useLocation();

  const loginForm = useForm({
    resolver: zodResolver(insertUserSchema.pick({ username: true, password: true })),
    defaultValues: {
      username: "",
      password: ""
    }
  });

  useEffect(() => {
    if (user) {
      // Redirect to admin dashboard if user is already logged in
      if (user.role?.toLowerCase() === 'admin') {
        setLocation("/admin/settings");
      } else {
        setLocation("/");
      }
    }
  }, [user, setLocation]);

  if (user && user.role?.toLowerCase() === 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="flex min-h-screen">
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-12 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 left-20 w-32 h-32 border border-white rounded-full"></div>
            <div className="absolute bottom-32 right-16 w-24 h-24 border border-white rounded-full"></div>
            <div className="absolute top-1/2 left-1/3 w-16 h-16 border border-white rounded-full"></div>
          </div>
          
          <div className="relative z-10 max-w-lg">
            {/* EdSteward Logo */}
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur rounded-xl mb-6">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-2">EdSteward</h1>
              <p className="text-xl text-blue-100 font-light">Administrative Console</p>
            </div>
            
            {/* Features */}
            <div className="space-y-6 text-white">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-medium">Multi-Tenant Management</h3>
                  <p className="text-blue-100 text-sm">Manage multiple university instances from a single dashboard</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <ChartBar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-medium">Analytics & Reporting</h3>
                  <p className="text-blue-100 text-sm">Comprehensive insights across all compliance activities</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-medium">System Configuration</h3>
                  <p className="text-blue-100 text-sm">Advanced settings and customization options</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24 max-w-md lg:max-w-none mx-auto lg:mx-0">
          <div className="w-full max-w-sm mx-auto">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">EdSteward Admin</h1>
            </div>

            <div className="text-center mb-8 lg:text-left">
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
                Welcome back
              </h2>
              <p className="text-gray-600">
                Sign in to access the administrative console
              </p>
            </div>

            <Card className="border-0 shadow-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg text-center">Administrator Login</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-6">
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Username</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                              placeholder="Enter your username"
                            />
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
                          <FormLabel className="text-sm font-medium text-gray-700">Password</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              {...field} 
                              className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                              placeholder="Enter your password"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg transition-all duration-200 hover:shadow-xl" 
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {loginMutation.isPending ? 'Signing in...' : 'Sign in to Admin Console'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <div className="mt-8 text-center">
              <p className="text-xs text-gray-500">
                This is a secure administrative area. Unauthorized access is prohibited.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 