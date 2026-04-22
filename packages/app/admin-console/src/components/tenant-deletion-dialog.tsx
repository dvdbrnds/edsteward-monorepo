import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';

interface TenantDeletionDialogProps {
  tenantId: string;
  tenantName: string;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

interface CanDeleteResponse {
  canDelete: boolean;
  reason: string;
  protectionLevel: 'protected' | 'high' | 'normal';
  requiredConfirmations: string[];
}

interface DeletionResult {
  success: boolean;
  deletionType: 'soft' | 'hard';
  steps: Array<{
    step: string;
    status: 'completed' | 'failed' | 'skipped';
    message?: string;
  }>;
  recoveryInfo?: {
    canRecover: boolean;
    databasePreserved: boolean;
    recoveryDeadline?: string;
  };
  error?: string;
}

export function TenantDeletionDialog({
  tenantId,
  tenantName,
  isOpen,
  onClose,
  onDeleted,
}: TenantDeletionDialogProps) {
  const [step, setStep] = useState<'check' | 'confirm' | 'deleting' | 'result'>('check');
  const [deletionType, setDeletionType] = useState<'soft' | 'hard'>('soft');
  const [canDeleteInfo, setCanDeleteInfo] = useState<CanDeleteResponse | null>(null);
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [reason, setReason] = useState('');
  const [acknowledgeDataLoss, setAcknowledgeDataLoss] = useState(false);
  const [result, setResult] = useState<DeletionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const expectedPhrase = `DELETE ${tenantId}`.toUpperCase();

  useEffect(() => {
    if (isOpen) {
      checkCanDelete();
    } else {
      // Reset state when dialog closes
      setStep('check');
      setConfirmationPhrase('');
      setAdminPassword('');
      setReason('');
      setAcknowledgeDataLoss(false);
      setResult(null);
      setError(null);
      setDeletionType('soft');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tenantId]);

  const checkCanDelete = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiGet<CanDeleteResponse>(`/api/tenants/${tenantId}/can-delete`);
      setCanDeleteInfo(response);
      if (response.canDelete) {
        setStep('confirm');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check deletion status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (confirmationPhrase.toUpperCase() !== expectedPhrase) {
      setError(`Please type "${expectedPhrase}" exactly to confirm`);
      return;
    }

    if (!acknowledgeDataLoss) {
      setError('You must acknowledge the data loss warning');
      return;
    }

    if (!reason || reason.length < 10) {
      setError('Please provide a detailed reason (at least 10 characters)');
      return;
    }

    if (!adminPassword) {
      setError('Please enter your admin password');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep('deleting');

    try {
      const endpoint = deletionType === 'soft' 
        ? `/api/tenants/${tenantId}/soft-delete`
        : `/api/tenants/${tenantId}/hard-delete`;

      const response = await apiPost<DeletionResult>(endpoint, {
        confirmationPhrase,
        adminPassword,
        reason,
        acknowledgeDataLoss,
        ...(deletionType === 'hard' && canDeleteInfo?.protectionLevel === 'high' 
          ? { secondConfirmation: 'I UNDERSTAND THIS IS PERMANENT' } 
          : {}),
      });

      setResult(response);
      setStep('result');

      if (response.success) {
        onDeleted();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deletion failed');
      setStep('confirm');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/50 transition-opacity" 
          role="button"
          tabIndex={0}
          onClick={onClose}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
        />

        {/* Dialog */}
        <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🗑️</span>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Delete Tenant</h2>
                <p className="text-sm text-gray-500">{tenantName} ({tenantId})</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-light"
            >
              ×
            </button>
          </div>

          {/* Loading State */}
          {isLoading && step === 'check' && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Checking deletion permissions...</span>
            </div>
          )}

          {/* Protected Tenant Warning */}
          {canDeleteInfo && !canDeleteInfo.canDelete && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔒</span>
                <div>
                  <h3 className="font-semibold text-red-800">Protected Tenant</h3>
                  <p className="text-sm text-red-700 mt-1">{canDeleteInfo.reason}</p>
                  <p className="text-sm text-red-600 mt-3 font-medium">
                    This tenant cannot be deleted through the admin console.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Form */}
          {step === 'confirm' && canDeleteInfo?.canDelete && (
            <div className="space-y-5">
              {/* Protection Level Warning */}
              {canDeleteInfo.protectionLevel === 'high' && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <h3 className="font-semibold text-orange-800">High-Protection Tenant</h3>
                      <p className="text-sm text-orange-700 mt-1">
                        This tenant requires additional confirmation for deletion.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Deletion Type Selection */}
              <div className="space-y-3">
                <span className="block text-sm font-medium text-gray-700">Deletion Type</span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setDeletionType('soft')}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      deletionType === 'soft'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">Soft Delete</div>
                    <div className="text-xs text-gray-500 mt-1">
                      ✅ Recoverable for 30 days<br/>
                      ✅ Database preserved<br/>
                      ✅ Recommended
                    </div>
                  </button>
                  <button
                    onClick={() => setDeletionType('hard')}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      deletionType === 'hard'
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">Hard Delete</div>
                    <div className="text-xs text-gray-500 mt-1">
                      ⚠️ Removes from system<br/>
                      ✅ Database still preserved<br/>
                      ⚠️ Use with caution
                    </div>
                  </button>
                </div>
              </div>

              {/* Confirmation Phrase */}
              <div>
                <label htmlFor="confirmation-phrase" className="block text-sm font-medium text-gray-700 mb-1">
                  Type <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{expectedPhrase}</span> to confirm
                </label>
                <input
                  id="confirmation-phrase"
                  type="text"
                  value={confirmationPhrase}
                  onChange={(e) => setConfirmationPhrase(e.target.value)}
                  placeholder={expectedPhrase}
                  className={`w-full px-4 py-2 border rounded-lg font-mono ${
                    confirmationPhrase.toUpperCase() === expectedPhrase
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300'
                  }`}
                />
              </div>

              {/* Reason */}
              <div>
                <label htmlFor="deletion-reason" className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for deletion <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="deletion-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please explain why this tenant is being deleted..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {reason.length}/10 minimum characters
                </p>
              </div>

              {/* Admin Password */}
              <div>
                <label htmlFor="admin-password-confirm" className="block text-sm font-medium text-gray-700 mb-1">
                  Re-enter your admin password <span className="text-red-500">*</span>
                </label>
                <input
                  id="admin-password-confirm"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* Acknowledgment */}
              <label htmlFor="acknowledge-data-loss" aria-label="I understand the consequences" className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer">
                <input
                  id="acknowledge-data-loss"
                  type="checkbox"
                  checked={acknowledgeDataLoss}
                  onChange={(e) => setAcknowledgeDataLoss(e.target.checked)}
                  className="mt-1 h-5 w-5 text-yellow-600 rounded"
                />
                <div>
                  <div className="font-medium text-yellow-800">I understand the consequences</div>
                  <div className="text-sm text-yellow-700 mt-1">
                    {deletionType === 'soft' 
                      ? 'This will mark the tenant as deleted. The database will be preserved and can be restored within 30 days.'
                      : 'This will remove the tenant from the system. The Neon database will be preserved for emergency recovery (minimal cost when inactive).'}
                  </div>
                </div>
              </label>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={
                    confirmationPhrase.toUpperCase() !== expectedPhrase ||
                    !acknowledgeDataLoss ||
                    reason.length < 10 ||
                    !adminPassword
                  }
                  className={`px-6 py-2 rounded-lg font-medium ${
                    deletionType === 'soft'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-300'
                      : 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300'
                  } disabled:cursor-not-allowed`}
                >
                  {deletionType === 'soft' ? 'Soft Delete' : 'Hard Delete'}
                </button>
              </div>
            </div>
          )}

          {/* Deleting Progress */}
          {step === 'deleting' && (
            <div className="py-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">
                {deletionType === 'soft' ? 'Soft deleting' : 'Hard deleting'} tenant...
              </p>
              <p className="text-sm text-gray-500 mt-1">Please do not close this window</p>
            </div>
          )}

          {/* Result */}
          {step === 'result' && result && (
            <div className="space-y-4">
              {result.success ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <h3 className="font-semibold text-green-800">
                        Tenant {result.deletionType === 'soft' ? 'Soft' : 'Hard'} Deleted
                      </h3>
                      <p className="text-sm text-green-700 mt-1">
                        {result.deletionType === 'soft'
                          ? 'The tenant has been marked as deleted and can be restored within 30 days.'
                          : 'The tenant has been removed from the system.'}
                      </p>
                      {result.recoveryInfo?.databasePreserved && (
                        <p className="text-sm text-green-600 mt-2 font-medium">
                          ✅ Database preserved for emergency recovery
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">❌</span>
                    <div>
                      <h3 className="font-semibold text-red-800">Deletion Failed</h3>
                      <p className="text-sm text-red-700 mt-1">{result.error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Steps */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-3">Deletion Steps</h4>
                <div className="space-y-2">
                  {result.steps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <span>
                        {step.status === 'completed' ? '✅' : step.status === 'skipped' ? '⏭️' : '❌'}
                      </span>
                      <span className={
                        step.status === 'completed' ? 'text-green-700' :
                        step.status === 'skipped' ? 'text-gray-500' :
                        'text-red-700'
                      }>
                        {step.step}
                      </span>
                      {step.message && (
                        <span className="text-gray-400 text-xs">({step.message})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
