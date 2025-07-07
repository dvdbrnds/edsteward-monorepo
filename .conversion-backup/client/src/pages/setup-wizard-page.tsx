import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { Progress } from "@/components/ui/progress";
import { Loader2, User, UserPlus, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { z } from "zod";

type FormValues = z.infer<typeof insertUserSchema>;

const REGULATION_CATEGORIES = [
  "Academic Programs",
  "Financial Aid",
  "Student Services",
  "Athletics",
  "Campus Safety",
  "Research",
] as const;

type RegulationCategory = typeof REGULATION_CATEGORIES[number];

const SUGGESTED_DISTRIBUTION_LISTS: Record<RegulationCategory, string> = {
  "Academic Programs": "academicaffairs@moravian.edu",
  "Financial Aid": "finaid@moravian.edu",
  "Student Services": "studentlife@moravian.edu",
  "Athletics": "athletics@moravian.edu",
  "Campus Safety": "police@moravian.edu",
  "Research": "research@moravian.edu",
} as const;

export default function SetupWizardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [officeStep, setOfficeStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [officeAssignments, setOfficeAssignments] = useState<Record<string, { email: string; name: string }>>({});
  const [redirectUri, setRedirectUri] = useState("");

  // Query for redirect URI
  const { data: redirectUriData } = useQuery({
    queryKey: ["/api/auth/redirect-uri"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth/redirect-uri");
      return response.json();
    },
  });

  useEffect(() => {
    if (redirectUriData?.redirectUri) {
      setRedirectUri(redirectUriData.redirectUri);
    }
  }, [redirectUriData]);

  const { data: hasAdmin, isLoading: checkingAdmin } = useQuery({
    queryKey: ["/api/setup/has-admin"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/setup/has-admin");
      return response.json();
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      role: "admin",
      department: "Administration",
    },
  });

  const officeForm = useForm({
    defaultValues: {
      name: "",
      email: "",
    },
  });

  const createAdminMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const response = await apiRequest("POST", "/api/setup/admin", data);
      if (!response.ok) {
        throw new Error("Failed to create admin account");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Admin Account Created",
        description: "You can now proceed with configuring compliance offices.",
      });
      setCurrentStep((prev) => prev + 1);
    },
    onError: (error) => {
      toast({
        title: "Setup Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (hasAdmin && currentStep === 0) {
      setCurrentStep(1);
    }
  }, [hasAdmin]);

  if (isComplete) {
    return <Redirect to="/admin/settings" />;
  }

  const handleOfficeSubmit = (data: { name: string; email: string }) => {
    const currentCategory = REGULATION_CATEGORIES[officeStep];
    setOfficeAssignments((prev) => ({
      ...prev,
      [currentCategory]: data,
    }));

    if (officeStep < REGULATION_CATEGORIES.length - 1) {
      setOfficeStep((prev) => prev + 1);
      officeForm.reset();
    } else {
      setIsComplete(true);
    }
  };

  if (checkingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  const setupSteps = hasAdmin
    ? [
        {
          id: "oauth2",
          title: "Configure OAuth2",
          description:
            "Set up OAuth2 credentials for Google Sheets integration across different environments. This can be configured later in admin settings.",
          icon: Key,
          required: false,
        },
        {
          id: "offices",
          title: "Assign Compliance Offices",
          description:
            "Designate offices responsible for each regulation category.",
          icon: UserPlus,
          required: false,
        },
      ]
    : [
        {
          id: "admin",
          title: "Create Admin Account",
          description: "Set up the initial administrator account for managing compliance",
          icon: User,
          required: true,
        },
        {
          id: "oauth2",
          title: "Configure OAuth2",
          description:
            "Set up OAuth2 credentials for Google Sheets integration across different environments. This can be configured later in admin settings.",
          icon: Key,
          required: false,
        },
        {
          id: "offices",
          title: "Assign Compliance Offices",
          description:
            "Designate offices responsible for each regulation category.",
          icon: UserPlus,
          required: false,
        },
      ];

  const progress = ((currentStep + 1) / setupSteps.length) * 100;
  const officeProgress = ((officeStep + 1) / REGULATION_CATEGORIES.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-2xl w-full px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#002147] mb-2">
            Moravian Compliance Portal Setup
          </h1>
          <p className="text-gray-600">
            Complete the following steps to set up your compliance portal.
          </p>
        </div>

        <Progress value={progress} className="mb-8" />

        <div className="space-y-6">
          {setupSteps.map((step, index) => {
            const Icon = step.icon;
            const isCurrent = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <Card
                key={step.id}
                className={`${isCurrent ? "ring-2 ring-[#00267A]" : ""} ${
                  isCompleted ? "bg-gray-50" : ""
                }`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Icon
                      className={`h-6 w-6 ${
                        isCompleted ? "text-green-500" : "text-[#00267A]"
                      }`}
                    />
                    {step.title}
                    {step.required && (
                      <span className="text-sm text-red-500 ml-2">Required</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isCurrent && step.id === "admin" && !hasAdmin && (
                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit((data) =>
                          createAdminMutation.mutate(data)
                        )}
                        className="space-y-6"
                      >
                        <FormField
                          control={form.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormDescription>
                                Choose a username for the administrator account
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input type="password" {...field} />
                              </FormControl>
                              <FormDescription>
                                Create a secure password for the administrator account
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit"
                          className="w-full"
                          disabled={createAdminMutation.isPending}
                        >
                          {createAdminMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating Account...
                            </>
                          ) : (
                            "Create Admin Account"
                          )}
                        </Button>
                      </form>
                    </Form>
                  )}

                  {isCurrent && step.id === "oauth2" && (
                    <div className="space-y-6">
                      <Tabs defaultValue="development" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="development">Development</TabsTrigger>
                          <TabsTrigger value="production">Production</TabsTrigger>
                        </TabsList>
                        <TabsContent value="development" className="space-y-4">
                          <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                            <h3 className="font-medium mb-2">Development Setup</h3>
                            <ol className="list-decimal list-inside space-y-2 text-sm">
                              <li>Go to Google Cloud Console</li>
                              <li>Create a new project or select existing one</li>
                              <li>Enable Google Sheets API</li>
                              <li>Create OAuth2 credentials:
                                <ul className="list-disc list-inside ml-4 mt-1">
                                  <li>Application type: Web application</li>
                                  <li>Redirect URI (Development):</li>
                                  <code className="block bg-slate-100 p-2 my-1 rounded text-xs break-all">
                                    {redirectUri}
                                  </code>
                                </ul>
                              </li>
                            </ol>
                          </div>
                        </TabsContent>
                        <TabsContent value="production" className="space-y-4">
                          <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                            <h3 className="font-medium mb-2">Production Setup</h3>
                            <ol className="list-decimal list-inside space-y-2 text-sm">
                              <li>Create new OAuth2 credentials for production</li>
                              <li>Use your production domain for redirect URI:
                                <code className="block bg-slate-100 p-2 my-1 rounded text-xs">
                                  https://compliance.moravian.edu/api/auth/google/callback
                                </code>
                              </li>
                              <li>Update environment variables in production:
                                <pre className="bg-slate-100 p-2 my-1 rounded text-xs">
                                  GOOGLE_CLIENT_ID=prod_client_id{"\n"}
                                  GOOGLE_CLIENT_SECRET=prod_client_secret{"\n"}
                                  GOOGLE_SHEETS_SHEET_ID=your_sheet_id
                                </pre>
                              </li>
                            </ol>
                          </div>
                        </TabsContent>
                      </Tabs>
                      <div className="flex justify-between pt-4">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setCurrentStep((prev) => prev + 1)}
                        >
                          Skip OAuth2 Setup
                        </Button>
                        <Button onClick={() => setCurrentStep((prev) => prev + 1)}>
                          Continue
                        </Button>
                      </div>
                    </div>
                  )}

                  {isCurrent && step.id === "offices" && (
                    <div className="space-y-6">
                      <div className="mb-6">
                        <Progress value={officeProgress} className="mb-2" />
                        <p className="text-sm text-gray-500 text-center">
                          Step {officeStep + 1} of {REGULATION_CATEGORIES.length}
                        </p>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">
                          Assign Office for {REGULATION_CATEGORIES[officeStep]}
                        </h3>
                        <p className="text-gray-600">
                          Assign a compliance office responsible for{" "}
                          {REGULATION_CATEGORIES[officeStep]} regulations.
                          We recommend using department distribution lists (e.g.,{" "}
                          {SUGGESTED_DISTRIBUTION_LISTS[REGULATION_CATEGORIES[officeStep]]}){" "}
                          to ensure notifications reach the entire team.
                        </p>

                        <Form {...officeForm}>
                          <form
                            onSubmit={officeForm.handleSubmit(handleOfficeSubmit)}
                            className="space-y-4"
                          >
                            <FormField
                              control={officeForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Office Name</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Enter office or department name"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={officeForm.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Office Email</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="email"
                                      placeholder={`e.g., ${SUGGESTED_DISTRIBUTION_LISTS[REGULATION_CATEGORIES[officeStep]]}`}
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Use department distribution lists to ensure the entire team receives notifications
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="flex justify-between pt-4">
                              {/* Temporarily removed Skip Setup button
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setIsComplete(true)}
                              >
                                Skip Setup
                              </Button>
                              */}
                              <Button type="submit">
                                {officeStep === REGULATION_CATEGORIES.length - 1
                                  ? "Complete Setup"
                                  : "Next Category"}
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </div>
                    </div>
                  )}

                  {!isCurrent && (
                    <p className="text-gray-600">{step.description}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}