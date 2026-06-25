import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import { TenantDeletionDialog } from '@/components/tenant-deletion-dialog';
import { DeployDialog } from '@/components/deploy-dialog';
import SSOConfiguration from './sso-configuration';
import TemplateSyncDialog from './template-sync-dialog';

interface Customer {
  id: string;
  name: string;
  subdomain: string;
  status: 'active' | 'inactive' | 'pending' | 'unhealthy';
  plan: string;
  deploymentType: string;
  contactEmail: string;
  userCount: number;
  regulationCount: number;
  lastActivity: string | null;
  healthCheckUrl?: string;
  createdAt: string;
  health: {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    database: { status: string; connected: boolean; error?: string };
    application: { status: string; responding: boolean; error?: string };
  };
  error?: string;
  ssoEnabled?: boolean;
  ssoProvider?: string;
  currentImageTag?: string;
  lastDeployedAt?: string;
  lastDeployedBy?: string;
}

export function CustomerManagementPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<{ id: string; name: string } | null>(null);
  const [configuringSSO, setConfiguringSSO] = useState<{ id: string; name: string; subdomain: string } | null>(null);
  const [deployingTenant, setDeployingTenant] = useState<{ id: string; name: string; subdomain: string } | null>(null);
  const [showSyncDialog, setShowSyncDialog] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const data = await apiGet<Customer[]>('/api/customers');
      setCustomers(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to admin API');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'unhealthy': return 'bg-red-100 text-red-800';
      case 'suspended': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'bg-green-100 text-green-800';
      case 'degraded': return 'bg-yellow-100 text-yellow-800';
      case 'unhealthy': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatLastActivity = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffHours < 168) return `${Math.floor(diffHours / 24)} days ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Loading customer data...
          </p>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your EdSteward customer accounts and tenant configurations
          </p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => setShowSyncDialog(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 flex items-center gap-2"
            title="Update the baseline regulation data for new tenants"
          >
            Update Template Baseline
          </button>
          
          <Link
            to="/customers/new"
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 font-semibold flex items-center gap-2"
          >
            <span className="text-lg">+</span>
            Create New Tenant
          </Link>
          
          <button
            onClick={fetchCustomers}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-400">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error Loading Customer Data
              </h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {customers.length === 0 && !error && !isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500">No customers found.</p>
        </div>
      )}

      {customers.length > 0 && (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {customers.map((customer) => (
              <li key={customer.id}>
                <div className="px-4 py-6 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <span className="text-2xl">🏢</span>
                      </div>
                      <div className="ml-4 min-w-0 flex-1">
                        <div className="flex items-center space-x-3">
                          <p className="text-lg font-medium text-gray-900 truncate">
                            {customer.name}
                          </p>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(customer.status)}`}
                          >
                            {customer.status}
                          </span>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getHealthColor(customer.health.overall)}`}
                          >
                            {customer.health.overall === 'healthy' ? '✓' : customer.health.overall === 'degraded' ? '⚠' : '✗'} {customer.health.overall}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {customer.plan}
                          </span>
                          {customer.ssoEnabled && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              SSO: {customer.ssoProvider?.toUpperCase() || 'Enabled'}
                            </span>
                          )}
                          {customer.currentImageTag && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 font-mono">
                              {customer.currentImageTag}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center text-sm text-gray-500 space-x-6">
                          <span>{customer.subdomain}.edsteward.ai</span>
                          <span>{customer.userCount} users</span>
                          <span>{customer.regulationCount} regulations</span>
                          <span>{formatLastActivity(customer.lastActivity)}</span>
                          {customer.lastDeployedAt && (
                            <span title={`Deployed by ${customer.lastDeployedBy || 'unknown'}`}>
                              Deployed {formatLastActivity(customer.lastDeployedAt)}
                            </span>
                          )}
                        </div>
                        {customer.error && (
                          <div className="mt-2 text-sm text-red-600">
                            Error: {customer.error}
                          </div>
                        )}
                        <details className="mt-2">
                          <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-800">
                            View Health Details
                          </summary>
                          <div className="mt-2 p-3 bg-gray-50 rounded text-xs">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-semibold text-gray-900 mb-1">Database</h4>
                                <p>Status: {customer.health.database.status}</p>
                                <p>Connected: {customer.health.database.connected ? 'Yes' : 'No'}</p>
                                {customer.health.database.error && (
                                  <p className="text-red-600">Error: {customer.health.database.error}</p>
                                )}
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900 mb-1">Application</h4>
                                <p>Status: {customer.health.application.status}</p>
                                <p>Responding: {customer.health.application.responding ? 'Yes' : 'No'}</p>
                                {customer.health.application.error && (
                                  <p className="text-red-600">Error: {customer.health.application.error}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </details>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/customers/${customer.id}/credentials`}
                        className="inline-flex items-center px-3 py-2 border border-indigo-300 shadow-sm text-sm leading-4 font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        title="Manage admin credentials"
                      >
                        Credentials
                      </Link>
                      <button
                        onClick={() => setDeployingTenant({
                          id: customer.id,
                          name: customer.name,
                          subdomain: customer.subdomain,
                        })}
                        className="inline-flex items-center px-3 py-2 border border-orange-300 shadow-sm text-sm leading-4 font-medium rounded-md text-orange-700 bg-white hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                        title="Deploy a version to this tenant"
                      >
                        Deploy
                      </button>
                      <button
                        onClick={() => setConfiguringSSO({ 
                          id: customer.id, 
                          name: customer.name,
                          subdomain: customer.subdomain 
                        })}
                        className={`inline-flex items-center px-3 py-2 border shadow-sm text-sm leading-4 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                          customer.ssoEnabled 
                            ? 'border-purple-300 text-purple-700 bg-white hover:bg-purple-50'
                            : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                        }`}
                        title="Configure SSO"
                      >
                        SSO
                      </button>
                      {customer.healthCheckUrl && (
                        <a
                          href={customer.healthCheckUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Health Check
                        </a>
                      )}
                      <a
                        href={`https://${customer.subdomain}.edsteward.ai`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Visit Site
                      </a>
                      <button
                        onClick={() => setDeletingTenant({ id: customer.id, name: customer.name })}
                        className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        title="Delete tenant"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Deploy Dialog */}
      {deployingTenant && (
        <DeployDialog
          tenantId={deployingTenant.id}
          tenantName={deployingTenant.name}
          subdomain={deployingTenant.subdomain}
          isOpen={true}
          onClose={() => setDeployingTenant(null)}
          onDeployed={() => {
            setDeployingTenant(null);
            fetchCustomers();
          }}
        />
      )}

      {/* Tenant Deletion Dialog */}
      {deletingTenant && (
        <TenantDeletionDialog
          tenantId={deletingTenant.id}
          tenantName={deletingTenant.name}
          isOpen={true}
          onClose={() => setDeletingTenant(null)}
          onDeleted={() => {
            setDeletingTenant(null);
            fetchCustomers(); // Refresh the list
          }}
        />
      )}

      {/* SSO Configuration Dialog */}
      {configuringSSO && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div 
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              role="button"
              tabIndex={0}
              onClick={() => setConfiguringSSO(null)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setConfiguringSSO(null); }}
            />
            <div className="relative inline-block w-full max-w-4xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-gray-100 shadow-xl rounded-lg">
              <SSOConfiguration
                tenantId={configuringSSO.id}
                tenantName={configuringSSO.name}
                subdomain={configuringSSO.subdomain}
                onClose={() => setConfiguringSSO(null)}
                onSave={() => {
                  fetchCustomers(); // Refresh the list to show updated SSO status
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Template Sync Dialog */}
      {showSyncDialog && (
        <TemplateSyncDialog
          isOpen={showSyncDialog}
          onClose={() => setShowSyncDialog(false)}
          onSyncComplete={() => {
            setShowSyncDialog(false);
            fetchCustomers();
          }}
        />
      )}
    </div>
  );
} 