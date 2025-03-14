const steps = [
  { id: 'actions', title: 'Actions & Review' },
  { id: 'evidence', title: 'Evidence Upload' },
  { id: 'info', title: 'Basic Information' },
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
      </div>
    </div>
  );
};

const currentStep = step;