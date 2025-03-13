/**
 * @module RegulationDetailPage
 * @description Displays detailed information about a specific regulation and provides administrative controls
 * @compliance ISO/IEC/IEEE 26514 4.3.2 - User Interface Documentation
 * 
 * @securityControl Access Control
 * - Implements role-based access control for admin features
 * - Restricts notification settings to admin users
 * - Validates user authentication status
 * 
 * @component
 * @example
 * ```tsx
 * <RegulationDetailPage />
 * ```
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type { Regulation, Deadline, Guide, RegulationAction } from "@shared/schema";
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Check, Globe, Mail, FileText, CheckCircle2, Clock4 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ActionButtonProps {
  action: RegulationAction;
  regulationId: number;
  isAdmin: boolean;
  onRequiredChange?: (required: boolean) => void;
  onStatusChange?: (status: RegulationAction['status']) => void;
}

function ActionButton({ action, regulationId, isAdmin, onRequiredChange, onStatusChange }: ActionButtonProps) {
  const getIcon = () => {
    switch (action.type) {
      case 'attestation':
        return <Check className="h-5 w-5" />;
      case 'website_publish':
        return <Globe className="h-5 w-5" />;
      case 'community_communication':
        return <Mail className="h-5 w-5" />;
      case 'agency_submission':
        return <FileText className="h-5 w-5" />;
    }
  };

  const getActionLabel = () => {
    return action.type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="flex flex-col space-y-4 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${action.status === 'completed' ? 'bg-green-50' : 'bg-blue-50'}`}>
            {getIcon()}
          </div>
          <span className="font-medium">{getActionLabel()}</span>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Switch
              checked={action.required}
              onCheckedChange={onRequiredChange}
              aria-label="Toggle required"
            />
            <span className="text-sm text-gray-500">Required</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant={action.status === 'pending' ? 'default' : 'outline'}
          size="sm"
          className="flex-1"
          onClick={() => onStatusChange?.('pending')}
        >
          <Clock4 className="h-4 w-4 mr-2" />
          Pending
        </Button>
        <Button
          variant={action.status === 'in_progress' ? 'default' : 'outline'}
          size="sm"
          className="flex-1"
          onClick={() => onStatusChange?.('in_progress')}
        >
          <Clock4 className="h-4 w-4 mr-2" />
          In Progress
        </Button>
        <Button
          variant={action.status === 'completed' ? 'default' : 'outline'}
          size="sm"
          className="flex-1"
          onClick={() => onStatusChange?.('completed')}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Complete
        </Button>
      </div>
    </div>
  );
}


// ... other imports and code ...

const RegulationDetailPage = () => {
  const [regulationId, setRegulationId] = useState<number | null>(null);
  const [user, setUser] = useState<{ role: string } | null>(null); // Assuming user data is available

  const { data: regulation, isLoading } = useQuery({
    queryKey: ['regulation', regulationId],
    queryFn: () => getRegulation(regulationId!), // Assuming getRegulation is defined elsewhere
    enabled: !!regulationId,
  });

  const queryClient = useQueryClient();
  const toast = useToast();

  const updateActionMutation = useMutation({
    mutationFn: (data: { regulationId: number; action: RegulationAction }) =>
      updateRegulationAction(data.regulationId, data.action), // Assuming updateRegulationAction is defined elsewhere
    onSuccess: () => {
      queryClient.invalidateQueries(['regulation', regulationId]);
      toast({
        title: 'Action updated',
        description: 'The regulation action has been successfully updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error updating action',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // ... other code ...


  return (
    <div>
      <Navigation />
      <div className="container mx-auto p-4">
        {/* ... other content ... */}

        {regulation && (
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Required actions and their current status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {regulation?.actions?.map((action) => (
                  <ActionButton
                    key={action.type}
                    action={action}
                    regulationId={regulation.id}
                    isAdmin={user?.role === "admin"}
                    onRequiredChange={(required) => {
                      updateActionMutation.mutate({
                        regulationId: regulation.id,
                        action: { ...action, required }
                      });
                    }}
                    onStatusChange={(status) => {
                      updateActionMutation.mutate({
                        regulationId: regulation.id,
                        action: { ...action, status }
                      });
                    }}
                  />
                ))}
                {(!regulation?.actions || regulation.actions.length === 0) && (
                  <p className="text-gray-500 italic">No actions configured</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        {/* ... other content ... */}
      </div>
    </div>
  );
};

export default RegulationDetailPage;