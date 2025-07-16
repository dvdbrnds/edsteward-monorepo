import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Customer {
  id: string;
  name: string;
  subdomain: string;
  status: 'active' | 'inactive' | 'unhealthy';
  userCount: number;
  regulationCount: number;
  lastActivity: string;
  databaseHealth: boolean;
  applicationHealth: boolean | null;
  serverStatus: string | null;
  healthCheckUrl?: string;
  healthDetails?: {
    database: any;
    application: any;
    overall: any;
  };
  error?: string;
}

export function CustomerManagementPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      console.log('🔑 Fetching customers with token:', token ? `${token.substring(0, 20)}...` : 'No token');
      
      const response = await fetch('http://localhost:4000/api/customers', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Real customer data received:', data);
        setCustomers(data);
        setError(null);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch customers:', response.status, errorText);
        setError(`Failed to fetch customers: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      console.error('❌ Error fetching customers:', err);
      setError('Failed to connect to admin API');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'unhealthy': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatLastActivity = (timestamp: string) => {
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
                          {customer.databaseHealth && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              💾 DB Healthy
                            </span>
                          )}
                          {!customer.databaseHealth && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              💾 DB Error
                            </span>
                          )}
                          {customer.applicationHealth === true && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              🌐 App Healthy
                            </span>
                          )}
                          {customer.applicationHealth === false && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              🌐 App Error
                            </span>
                          )}
                          {customer.applicationHealth === null && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              🌐 App N/A
                            </span>
                          )}
                          {customer.serverStatus && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              🖥️ {customer.serverStatus}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center text-sm text-gray-500 space-x-6">
                          <span>🌐 {customer.subdomain}.edsteward.ai</span>
                          <span>👥 {customer.userCount} users</span>
                          <span>📋 {customer.regulationCount} regulations</span>
                          <span>🕒 {formatLastActivity(customer.lastActivity)}</span>
                        </div>
                        {customer.error && (
                          <div className="mt-2 text-sm text-red-600">
                            Error: {customer.error}
                          </div>
                        )}
                        {customer.healthDetails && (
                          <details className="mt-2">
                            <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-800">
                              View Health Details
                            </summary>
                            <div className="mt-2 p-3 bg-gray-50 rounded text-xs">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-1">Database Health</h4>
                                  <p>Status: {customer.healthDetails.database.status}</p>
                                  <p>Connected: {customer.healthDetails.database.database ? 'Yes' : 'No'}</p>
                                  {customer.healthDetails.database.error && (
                                    <p className="text-red-600">Error: {customer.healthDetails.database.error}</p>
                                  )}
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-1">Application Health</h4>
                                  {customer.healthDetails.application ? (
                                    <>
                                      <p>Status: {customer.healthDetails.application.status}</p>
                                      <p>Server: {customer.healthDetails.application.serverStatus}</p>
                                      <p>App Response: {customer.healthDetails.application.applicationHealth ? 'Yes' : 'No'}</p>
                                      {customer.healthDetails.application.error && (
                                        <p className="text-red-600">Error: {customer.healthDetails.application.error}</p>
                                      )}
                                    </>
                                  ) : (
                                    <p className="text-gray-500">No health check URL configured</p>
                                  )}
                                </div>
                              </div>
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <h4 className="font-semibold text-gray-900 mb-1">Overall Status</h4>
                                <p>Healthy: {customer.healthDetails.overall.healthy ? 'Yes' : 'No'}</p>
                                <p>Database Connected: {customer.healthDetails.overall.databaseConnected ? 'Yes' : 'No'}</p>
                                <p>Application Responding: {customer.healthDetails.overall.applicationResponding ? 'Yes' : 'No'}</p>
                                <p>Has Errors: {customer.healthDetails.overall.hasErrors ? 'Yes' : 'No'}</p>
                              </div>
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
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
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 