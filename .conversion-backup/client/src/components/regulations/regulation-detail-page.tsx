// Previous imports remain the same...

function ActionButton({ action, regulationId, regulation, isAdmin, onRequiredChange, onStatusChange }: ActionButtonProps) {
  const [showWebPublishDialog, setShowWebPublishDialog] = useState(false);
  // ... other state declarations

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
        {/* ... previous ActionButton content ... */}
      </div>

      {action.type === 'website_publish' && (
        <WebPublishDialog
          regulation={regulation}
          open={showWebPublishDialog}
          onOpenChange={setShowWebPublishDialog}
          onComplete={() => onStatusChange?.('completed')}
        />
      )}

      {/* ... other dialogs remain the same ... */}
    </>
  );
}

// Rest of the file remains the same...
