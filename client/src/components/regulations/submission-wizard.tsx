
import React, { useState } from 'react';
import { Button } from '../ui/button';

interface SubmissionWizardProps {
  regulation: any;
  onActionUpdate: (type: string) => void;
}

export const SubmissionWizard: React.FC<SubmissionWizardProps> = ({ regulation, onActionUpdate }) => {
  const [step, setStep] = useState(0);

  const steps = [
    { id: 'info', title: 'Basic Information' },
    { id: 'evidence', title: 'Evidence Upload' },
    { id: 'actions', title: 'Actions & Review' },
    { id: 'requirements', title: 'Requirements Review' },
    { id: 'review', title: 'Final Review' }
  ];

  const renderActionStep = () => {
    return (
      <div className="space-y-6">
        <div className="grid gap-4">
          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <input 
              type="checkbox" 
              checked={regulation.actions?.find(a => a.type === 'attestation')?.status === 'completed'}
              onChange={() => onActionUpdate('attestation')}
              className="mt-1" 
            />
            <div>
              <p className="font-medium">Attestation</p>
              <p className="text-sm text-gray-600">Confirm review of requirements</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <input 
              type="checkbox"
              checked={regulation.actions?.find(a => a.type === 'website_publish')?.status === 'completed'}
              onChange={() => onActionUpdate('website_publish')}
              className="mt-1"
            />
            <div>
              <p className="font-medium">Website Publication</p>
              <p className="text-sm text-gray-600">Public disclosure requirements</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <input 
              type="checkbox"
              checked={regulation.actions?.find(a => a.type === 'community_communication')?.status === 'completed'}
              onChange={() => onActionUpdate('community_communication')}
              className="mt-1"
            />
            <div>
              <p className="font-medium">Community Communication</p>
              <p className="text-sm text-gray-600">Required notifications</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <input 
              type="checkbox"
              checked={regulation.actions?.find(a => a.type === 'agency_submission')?.status === 'completed'}
              onChange={() => onActionUpdate('agency_submission')}
              className="mt-1"
            />
            <div>
              <p className="font-medium">Agency Submission</p>
              <p className="text-sm text-gray-600">Submit required documentation</p>
            </div>
          </div>

          <Button 
            onClick={handleSubmitEvidence}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Submit Evidence
          </Button>
        </div>
      </div>
    );
  };

  const handleSubmitEvidence = () => {
    // Handle evidence submission
    console.log('Submitting evidence...');
  };

  const renderContent = () => {
    switch (steps[step].id) {
      case 'actions':
        return renderActionStep();
      // Add other step renders as needed
      default:
        return <div>Content for {steps[step].id}</div>;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between mb-8">
        {steps.map((s, i) => (
          <div
            key={s.id}
            className={`flex items-center ${
              i === step ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <div className="flex-shrink-0">{s.title}</div>
            {i < steps.length - 1 && (
              <div className="mx-2 text-gray-300">→</div>
            )}
          </div>
        ))}
      </div>
      
      <div className="p-4 border rounded-lg">
        {renderContent()}
      </div>

      <div className="flex justify-between">
        <Button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          Previous
        </Button>
        <Button
          onClick={() => setStep(Math.min(steps.length - 1, step + 1))}
          disabled={step === steps.length - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
};
