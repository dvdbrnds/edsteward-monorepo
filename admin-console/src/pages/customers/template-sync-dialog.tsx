import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';

interface SyncPreview {
  source: {
    name: string;
    url: string;
    counts: {
      regulations: number;
      complianceTasks: number;
      guides: number;
      deadlines: number;
    };
  };
  template: {
    name: string;
    url: string;
    counts: {
      regulations: number;
      complianceTasks: number;
      guides: number;
      deadlines: number;
    };
  };
}

interface SyncResult {
  success: boolean;
  startedAt: string;
  completedAt: string;
  syncedBy: string;
  tables: {
    [key: string]: {
      synced?: number;
      status: string;
      error?: string;
    };
  };
  errors: string[];
}

interface TemplateSyncDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
}

export default function TemplateSyncDialog({ isOpen, onClose, onSyncComplete }: TemplateSyncDialogProps) {
  const [step, setStep] = useState<'preview' | 'confirm' | 'syncing' | 'complete'>('preview');
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPreview();
    }
  }, [isOpen]);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<SyncPreview>('/api/sync/preview');
      setPreview(data);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!password) {
      setError('Please enter your admin password');
      return;
    }

    setStep('syncing');
    setError(null);

    try {
      const data = await apiPost<SyncResult>('/api/sync/dev-to-template', {
        adminPassword: password,
        confirmSync: true,
      });
      setResult(data);
      setStep('complete');
      if (data.success) {
        onSyncComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      setStep('confirm');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />
        
        <div className="relative inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                Update Template Baseline
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Set the starting regulation data for new tenants
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-4 text-gray-500">Loading preview...</p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && preview && !loading && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  <strong>How this works:</strong> New tenants receive this baseline data when provisioned. 
                  After that, the MCP Engine keeps them updated with regulatory changes.
                </p>
              </div>
              
              <p className="text-gray-600">
                Update the <strong>Template Baseline</strong> with current regulation data from your <strong>Development Environment</strong>.
                All future tenants will start with this data.
              </p>

              <div className="grid grid-cols-2 gap-6">
                {/* Source */}
                <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                  <h3 className="font-semibold text-green-800 mb-1">New Baseline</h3>
                  <p className="text-xs text-green-600 mb-3">From Dev Environment (MCP updates)</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Regulations:</span>
                      <span className="font-medium">{preview.source.counts.regulations}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Task Templates:</span>
                      <span className="font-medium">{preview.source.counts.complianceTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Guides:</span>
                      <span className="font-medium">{preview.source.counts.guides}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Deadlines:</span>
                      <span className="font-medium">{preview.source.counts.deadlines}</span>
                    </div>
                  </div>
                </div>

                {/* Template */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-1">Current Baseline</h3>
                  <p className="text-xs text-gray-500 mb-3">Template Tenant (will be replaced)</p>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Regulations:</span>
                      <span className="font-medium">{preview.template.counts.regulations}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Task Templates:</span>
                      <span className="font-medium">{preview.template.counts.complianceTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Guides:</span>
                      <span className="font-medium">{preview.template.counts.guides}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Deadlines:</span>
                      <span className="font-medium">{preview.template.counts.deadlines}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-800 text-sm">
                  <strong>Note:</strong> This only affects future tenants. Existing tenants continue receiving 
                  updates directly from the MCP Engine and are not affected by this change.
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Update Baseline
                </button>
              </div>
            </div>
          )}

          {/* Confirm Step */}
          {step === 'confirm' && (
            <div className="space-y-6">
              <p className="text-gray-600">
                Enter your admin password to confirm updating the template baseline.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setStep('preview')}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Back
                </button>
                <button
                  onClick={handleSync}
                  disabled={!password}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Update
                </button>
              </div>
            </div>
          )}

          {/* Syncing Step */}
          {step === 'syncing' && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto"></div>
              <p className="mt-6 text-lg text-gray-700">Updating template baseline...</p>
              <p className="mt-2 text-sm text-gray-500">This may take a few moments</p>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && result && (
            <div className="space-y-6">
              <div className={`text-center py-6 rounded-lg ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
                <span className="text-5xl">{result.success ? '✅' : '⚠️'}</span>
                <h3 className={`mt-4 text-xl font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                  {result.success ? 'Baseline Updated!' : 'Update Completed with Errors'}
                </h3>
                {result.success && (
                  <p className="mt-2 text-sm text-green-600">
                    New tenants will now receive this regulation data
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-gray-700">Sync Results:</h4>
                {Object.entries(result.tables).map(([table, info]) => (
                  <div key={table} className="flex items-center justify-between bg-gray-50 rounded px-4 py-2">
                    <span className="capitalize">{table.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className={`font-medium ${info.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                      {info.status === 'success' ? `${info.synced} synced` : info.error}
                    </span>
                  </div>
                ))}
              </div>

              {result.errors.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4">
                  <h4 className="font-medium text-red-800 mb-2">Errors:</h4>
                  <ul className="list-disc list-inside text-sm text-red-700">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end">
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
