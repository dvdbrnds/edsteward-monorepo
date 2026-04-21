import { useState } from "react";
import type { Regulation, RegulationAction } from "@shared/schema";

interface ActionButtonProps {
  action: RegulationAction;
  regulationId: number;
  regulation: Regulation;
  isAdmin?: boolean;
  onRequiredChange?: (required: boolean) => void;
  onStatusChange?: (status: string) => void;
}

function ActionButton({ action, regulationId, regulation, isAdmin, onRequiredChange, onStatusChange }: ActionButtonProps) {
  const [showWebPublishDialog, setShowWebPublishDialog] = useState(false);
  const [showCommunicationDialog, setShowCommunicationDialog] = useState(false);
  const [showSubmissionWizard, setShowSubmissionWizard] = useState(false);

  const handleActionClick = () => {
    if (action.type === 'website_publish') {
      setShowWebPublishDialog(true);
      onStatusChange?.('in_progress');
    } else if (action.type === 'community_communication') {
      setShowCommunicationDialog(true);
      onStatusChange?.('in_progress');
    } else if (action.type === 'agency_submission') {
      setShowSubmissionWizard(true);
      onStatusChange?.('in_progress');
    }
  };

  return (
    <>
      <div className={`flex flex-col space-y-4 p-4 border rounded-lg ${action.required ? 'border-red-200' : ''}`}>
        <button onClick={handleActionClick}>
          {action.type.replace('_', ' ')}
        </button>
      </div>
    </>
  );
}

export { ActionButton };
export type { ActionButtonProps };
