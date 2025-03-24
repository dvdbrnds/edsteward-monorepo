import React from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Regulation } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

// Notification override schema for admin settings
const notificationOverrideSchema = z.object({
  email: z.string().email("Invalid email").optional().nullable(),
  phone: z.string().regex(/^\+?[\d\s-()]+$/, "Invalid phone number").optional().nullable(),
  notificationSchedule: z.object({
    initialReminder: z.number().min(1).max(365).optional(),
    weeklyReminder: z.number().min(1).max(90).optional(),
    dailyReminder: z.number().min(1).max(30).optional(),
    finalDayReminders: z.boolean().optional()
  }).optional().nullable()
});

export type NotificationOverride = z.infer<typeof notificationOverrideSchema>;

interface NotificationSettingsFormProps {
  regulation: Regulation;
  regulationId: number;
}

export function NotificationSettingsForm({ regulation, regulationId }: NotificationSettingsFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form for notification override settings
  const form = useForm<NotificationOverride>({
    resolver: zodResolver(notificationOverrideSchema),
    defaultValues: {
      email: regulation?.notificationOverride?.email || null,
      phone: regulation?.notificationOverride?.phone || null,
      notificationSchedule: regulation?.notificationSchedule || {
        initialReminder: 90,
        weeklyReminder: 30,
        dailyReminder: 7,
        finalDayReminders: true
      }
    },
  });

  // Notification override mutation for admin settings
  const overrideMutation = useMutation({
    mutationFn: async (data: NotificationOverride) => {
      const response = await fetch(
        `/api/regulations/${regulationId}/notification-override`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to update notification override");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Notification Settings Updated",
        description: "The notification settings have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/regulations", regulationId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: NotificationOverride) => {
    overrideMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Override</FormLabel>
              <FormControl>
                <Input placeholder="email@example.com" {...field} value={field.value || ''} />
              </FormControl>
              <FormDescription>
                Email address for this regulation's notifications (optional)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Override</FormLabel>
              <FormControl>
                <Input placeholder="(123) 456-7890" {...field} value={field.value || ''} />
              </FormControl>
              <FormDescription>
                Phone number for SMS notifications (optional)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <h4 className="font-medium">Notification Schedule</h4>
          <FormField
            control={form.control}
            name="notificationSchedule.initialReminder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Initial Reminder (days before)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    {...field}
                    onChange={e => field.onChange(Number(e.target.value))}
                    value={field.value || 90}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notificationSchedule.weeklyReminder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weekly Reminders Start (days before)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    {...field}
                    onChange={e => field.onChange(Number(e.target.value))}
                    value={field.value || 30}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notificationSchedule.dailyReminder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Daily Reminders Start (days before)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    {...field}
                    onChange={e => field.onChange(Number(e.target.value))}
                    value={field.value || 7}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notificationSchedule.finalDayReminders"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value || false}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>
                    Send Hourly Reminders on Final Day
                  </FormLabel>
                  <FormDescription>
                    On the due date, send hourly reminders for urgent action
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </div>

        <Button 
          type="submit" 
          className="w-full"
          disabled={overrideMutation.isPending}
        >
          {overrideMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Save Notification Settings
        </Button>
      </form>
    </Form>
  );
}