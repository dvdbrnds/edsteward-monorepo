import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';

interface DeployDialogProps {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  isOpen: boolean;
  onClose: () => void;
  onDeployed: () => void;
}

interface EcrImage {
  tag: string;
  pushedAt: string;
  sizeBytes: number;
}

interface DeploymentStatus {
  success: boolean;
  status?: string;
  runningCount?: number;
  desiredCount?: number;
  currentImageTag?: string;
  taskDefinitionRevision?: number;
  lastDeployment?: string;
  config: {
    cluster: string;
    service: string;
    taskFamily: string;
    hasOwnInfra: boolean;
  };
  dbTracking: {
    currentImageTag?: string;
    lastDeployedAt?: string;
    lastDeployedBy?: string;
  };
  error?: string;
}

type DialogStep = 'loading' | 'select' | 'confirm' | 'deploying' | 'result';

export function DeployDialog({
  tenantId,
  tenantName,
  subdomain,
  isOpen,
  onClose,
  onDeployed,
}: DeployDialogProps) {
  const [step, setStep] = useState<DialogStep>('loading');
  const [images, setImages] = useState<EcrImage[]>([]);
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    } else {
      setStep('loading');
      setSelectedTag('');
      setError(null);
      setDeployResult(null);
    }
  }, [isOpen]);

  const loadData = async () => {
    setStep('loading');
    setError(null);
    try {
      const [imagesRes, statusRes] = await Promise.all([
        apiGet<{ success: boolean; images: EcrImage[] }>('/api/ecr/images'),
        apiGet<DeploymentStatus>(`/api/customers/${tenantId}/deployment`),
      ]);
      setImages(imagesRes.images || []);
      setDeploymentStatus(statusRes);
      setStep('select');
    } catch (err: any) {
      setError(err.message || 'Failed to load deployment data');
      setStep('select');
    }
  };

  const handleDeploy = async () => {
    if (!selectedTag) return;
    setStep('deploying');
    setError(null);
    try {
      const result = await apiPost<any>(`/api/customers/${tenantId}/deploy`, {
        imageTag: selectedTag,
      });
      setDeployResult(result);
      setStep('result');
    } catch (err: any) {
      setError(err.message || 'Deployment failed');
      setStep('select');
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Unknown';
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  const currentTag = deploymentStatus?.currentImageTag || deploymentStatus?.dbTracking?.currentImageTag;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          role="button"
          tabIndex={0}
          onClick={onClose}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        />
        <div className="relative inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                Deploy to {tenantName}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {subdomain}.edsteward.ai
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              &times;
            </button>
          </div>

          {/* Loading State */}
          {step === 'loading' && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600">Loading deployment info...</span>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Select Version Step */}
          {step === 'select' && (
            <>
              {/* Current Deployment Info */}
              {deploymentStatus && (
                <div className="mb-6 bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Current Deployment</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Running Version:</span>{' '}
                      <span className="font-mono font-medium text-gray-900">
                        {currentTag || 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>{' '}
                      <span className={`font-medium ${deploymentStatus.status === 'ACTIVE' ? 'text-green-600' : 'text-yellow-600'}`}>
                        {deploymentStatus.status || 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Running Tasks:</span>{' '}
                      <span className="font-medium text-gray-900">
                        {deploymentStatus.runningCount ?? '?'}/{deploymentStatus.desiredCount ?? '?'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Task Def Revision:</span>{' '}
                      <span className="font-mono text-gray-900">
                        {deploymentStatus.taskDefinitionRevision ?? 'N/A'}
                      </span>
                    </div>
                    {deploymentStatus.dbTracking?.lastDeployedAt && (
                      <div className="col-span-2">
                        <span className="text-gray-500">Last Deployed:</span>{' '}
                        <span className="text-gray-900">
                          {formatDate(deploymentStatus.dbTracking.lastDeployedAt)}
                          {deploymentStatus.dbTracking.lastDeployedBy && (
                            <> by <span className="font-medium">{deploymentStatus.dbTracking.lastDeployedBy}</span></>
                          )}
                        </span>
                      </div>
                    )}
                    {!deploymentStatus.config.hasOwnInfra && (
                      <div className="col-span-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Shared Infrastructure -- using default ECS service
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Version Selector */}
              <div className="mb-6">
                <label htmlFor="image-tag" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Version to Deploy
                </label>
                {images.length === 0 ? (
                  <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded">
                    No images found in ECR. Push an image first using the deploy scripts.
                  </div>
                ) : (
                  <select
                    id="image-tag"
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border"
                  >
                    <option value="">-- Select a version --</option>
                    {images.map((img) => (
                      <option key={img.tag} value={img.tag}>
                        {img.tag}
                        {img.tag === currentTag ? ' (current)' : ''}
                        {img.pushedAt ? ` -- pushed ${formatDate(img.pushedAt)}` : ''}
                        {img.sizeBytes ? ` (${formatSize(img.sizeBytes)})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Infrastructure Config Info */}
              {deploymentStatus?.config && (
                <details className="mb-6">
                  <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-800">
                    ECS Infrastructure Details
                  </summary>
                  <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono space-y-1">
                    <div>Cluster: {deploymentStatus.config.cluster}</div>
                    <div>Service: {deploymentStatus.config.service}</div>
                    <div>Task Family: {deploymentStatus.config.taskFamily}</div>
                  </div>
                </details>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={!selectedTag || selectedTag === currentTag}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Review Deploy
                </button>
              </div>
            </>
          )}

          {/* Confirmation Step */}
          {step === 'confirm' && (
            <>
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-amber-800 mb-3">Confirm Deployment</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tenant:</span>
                    <span className="font-semibold text-gray-900">{tenantName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Current Version:</span>
                    <span className="font-mono text-gray-900">{currentTag || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">New Version:</span>
                    <span className="font-mono font-semibold text-blue-700">{selectedTag}</span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-amber-700">
                  This will update the ECS task definition and trigger a rolling deployment.
                  New tasks will start within 2-3 minutes. The old version will be drained gracefully.
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setStep('select')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleDeploy}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-md hover:bg-orange-700"
                >
                  Deploy {selectedTag}
                </button>
              </div>
            </>
          )}

          {/* Deploying Step */}
          {step === 'deploying' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mb-4"></div>
              <p className="text-gray-700 font-medium">Deploying {selectedTag}...</p>
              <p className="text-sm text-gray-500 mt-1">Updating task definition and triggering rollout</p>
            </div>
          )}

          {/* Result Step */}
          {step === 'result' && deployResult && (
            <>
              <div className={`mb-6 rounded-lg p-4 ${deployResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <h4 className={`text-sm font-semibold mb-2 ${deployResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {deployResult.success ? 'Deployment Initiated' : 'Deployment Failed'}
                </h4>
                <p className="text-sm text-gray-700">{deployResult.message}</p>
                {deployResult.deployment && (
                  <div className="mt-3 space-y-1 text-xs text-gray-600">
                    <div>Version: <span className="font-mono">{deployResult.deployment.imageTag}</span></div>
                    <div>Task Definition Revision: {deployResult.revision}</div>
                    <div>Deployed at: {formatDate(deployResult.deployment.deployedAt)}</div>
                  </div>
                )}
                {deployResult.success && (
                  <p className="mt-3 text-xs text-green-700">
                    New tasks will be running within 2-3 minutes. Monitor the health check to verify.
                  </p>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    onDeployed();
                    onClose();
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
