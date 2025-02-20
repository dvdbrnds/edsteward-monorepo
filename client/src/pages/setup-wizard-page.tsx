import { useState } from "react";
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
import { Loader2, User, UserPlus, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";
import type { z } from "zod";

type FormValues = z.infer<typeof insertUserSchema>;

const SETUP_STEPS = [
  {
    id: "admin",
    title: "Create Admin Account",
    description: "Set up the initial administrator account",
    icon: User,
    required: true,
  },
  {
    id: "officers",
    title: "Assign Compliance Officers",
    description: "Assign officers to regulation categories",
    icon: UserPlus,
    required: false,
  },
  {
    id: "overrides",
    title: "Configure Notification Overrides",
    description: "Set up per-regulation notification overrides",
    icon: Settings,
    required: false,
  },
];

export default function SetupWizardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      role: "admin",
      department: "Administration",
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
        title: "Admin account created",
        description: "You can now proceed with the next steps.",
      });
      setCurrentStep((prev) => prev + 1);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const progress = ((currentStep + 1) / SETUP_STEPS.length) * 100;

  if (isComplete) {
    return <Redirect to="/admin/settings" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-2xl w-full px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#002147] mb-2">
            Moravian Compliance Portal Setup
          </h1>
          <p className="text-gray-600">
            Complete the following steps to set up your compliance portal
          </p>
        </div>

        <Progress value={progress} className="mb-8" />

        <div className="space-y-6">
          {SETUP_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isCurrent = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <Card
                key={step.id}
                className={`${
                  isCurrent ? "ring-2 ring-blue-500" : ""
                } ${
                  isCompleted ? "bg-gray-50" : ""
                }`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Icon className={`h-6 w-6 ${
                      isCompleted ? "text-green-500" : "text-blue-500"
                    }`} />
                    {step.title}
                    {step.required && (
                      <span className="text-sm text-red-500">*</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isCurrent && step.id === "admin" && (
                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit((data) =>
                          createAdminMutation.mutate(data)
                        )}
                        className="space-y-4"
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

                  {/* Placeholder for other steps - will be implemented next */}
                  {isCurrent && step.id === "officers" && (
                    <div className="text-center py-4">
                      <p>Officer assignment interface coming soon...</p>
                      <Button
                        onClick={() => setCurrentStep((prev) => prev + 1)}
                        className="mt-4"
                      >
                        Skip for Now
                      </Button>
                    </div>
                  )}

                  {isCurrent && step.id === "overrides" && (
                    <div className="text-center py-4">
                      <p>Override configuration interface coming soon...</p>
                      <Button
                        onClick={() => setIsComplete(true)}
                        className="mt-4"
                      >
                        Complete Setup
                      </Button>
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
