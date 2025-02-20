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
    description: "Set up the initial administrator account for managing compliance",
    icon: User,
    required: true,
  },
  {
    id: "officers",
    title: "Assign Compliance Officers",
    description: "Designate officers responsible for each regulation category. You can modify these assignments later in the admin settings.",
    icon: UserPlus,
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
        title: "Admin Account Created",
        description: "You can now proceed with configuring compliance officers.",
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
            Complete the following steps to set up your compliance portal. Only admin account creation is required, other steps can be configured later.
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
                  isCurrent ? "ring-2 ring-[#00267A]" : ""
                } ${
                  isCompleted ? "bg-gray-50" : ""
                }`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Icon className={`h-6 w-6 ${
                      isCompleted ? "text-green-500" : "text-[#00267A]"
                    }`} />
                    {step.title}
                    {step.required && (
                      <span className="text-sm text-red-500 ml-2">Required</span>
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

                  {isCurrent && step.id === "officers" && (
                    <div className="space-y-4">
                      <p className="text-gray-600">
                        Assign compliance officers to specific regulation categories. This helps organize responsibility and ensures proper oversight.
                      </p>
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500 mb-4">
                          You can configure officer assignments now or do it later in the admin settings.
                        </p>
                        <Button
                          onClick={() => setIsComplete(true)}
                          className="mt-4"
                        >
                          Complete Setup
                        </Button>
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