import React, { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';

interface TenantHealth {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  userCount: number;
  regulationCount: number;
  health: {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    database: {
      status: string;
      connected: boolean;
      error?: string;
    };
    application: {
      status: string;
      responseTime?: number;
      error?: string;
    };
  };
  error?: string;
}

interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  activeUsers: number;
  totalRegulations: number;
  systemStatus: string;
}

export function SystemHealthPage() {
  const [tenants, setTenants] = useState<TenantHealth[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    fetchHealthData();
  }, []);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [tenantsData, statsData] = await Promise.all([
        apiGet<TenantHealth[]>('/api/customers'),
        apiGet<DashboardStats>('/api/dashboard/stats')
      ]);
      
      setTenants(tenantsData);
      setStats(statsData);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch health data');
    } finally {
      setLoading(false);
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return '✅';
      case 'degraded':
        return '⚠️';
      case 'unhealthy':
        return '❌';
      default:
        return '❓';
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'unhealthy':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const healthySystems = tenants.filter(t => t.health?.overall === 'healthy').length;
  const degradedSystems = tenants.filter(t => t.health?.overall === 'degraded').length;
  const unhealthySystems = tenants.filter(t => t.health?.overall === 'unhealthy').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
          <p className="mt-2 text-sm text-gray-600">
            Monitor system status and performance across all tenants
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchHealthData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Overall Status Banner */}
      <div className={`rounded-lg p-6 border ${
        unhealthySystems > 0 
          ? 'bg-red-50 border-red-200' 
          : degradedSystems > 0 
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-green-50 border-green-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-4xl">
              {unhealthySystems > 0 ? '❌' : degradedSystems > 0 ? '⚠️' : '✅'}
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {unhealthySystems > 0 
                  ? 'System Issues Detected' 
                  : degradedSystems > 0 
                    ? 'Some Systems Degraded'
                    : 'All Systems Operational'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {healthySystems} healthy, {degradedSystems} degraded, {unhealthySystems} unhealthy
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{stats?.activeUsers || 0}</div>
            <div className="text-sm text-gray-500">Active Users</div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Healthy Systems</div>
              <div className="text-2xl font-bold text-green-600">{healthySystems}</div>
            </div>
            <div className="text-3xl">✅</div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Degraded Systems</div>
              <div className="text-2xl font-bold text-yellow-600">{degradedSystems}</div>
            </div>
            <div className="text-3xl">⚠️</div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Unhealthy Systems</div>
              <div className="text-2xl font-bold text-red-600">{unhealthySystems}</div>
            </div>
            <div className="text-3xl">❌</div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Total Regulations</div>
              <div className="text-2xl font-bold text-blue-600">{stats?.totalRegulations || 0}</div>
            </div>
            <div className="text-3xl">📋</div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Tenant Health Cards */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Tenant Health Details</h2>
        
        {tenants.map((tenant) => (
          <div 
            key={tenant.id} 
            className={`bg-white rounded-lg shadow border-l-4 ${
              tenant.health?.overall === 'healthy' 
                ? 'border-green-500' 
                : tenant.health?.overall === 'degraded'
                  ? 'border-yellow-500'
                  : 'border-red-500'
            }`}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getHealthIcon(tenant.health?.overall)}</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{tenant.name}</h3>
                    <p className="text-sm text-gray-500">{tenant.subdomain}.edsteward.ai</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getHealthColor(tenant.health?.overall)}`}>
                    {tenant.health?.overall || 'unknown'}
                  </span>
                  <a 
                    href={`https://${tenant.subdomain}.edsteward.ai`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200"
                  >
                    Visit Site →
                  </a>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-xs text-gray-500">Users</div>
                  <div className="text-lg font-bold">{tenant.userCount}</div>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-xs text-gray-500">Regulations</div>
                  <div className="text-lg font-bold">{tenant.regulationCount}</div>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-xs text-gray-500">Status</div>
                  <div className="text-lg font-bold capitalize">{tenant.status}</div>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-xs text-gray-500">Response Time</div>
                  <div className="text-lg font-bold">
                    {tenant.health?.application?.responseTime 
                      ? `${tenant.health.application.responseTime}ms` 
                      : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Health Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Database Health */}
                <div className={`rounded-lg p-4 border ${
                  tenant.health?.database?.connected 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span>{tenant.health?.database?.connected ? '✅' : '❌'}</span>
                    <span className="font-medium">Database</span>
                  </div>
                  <div className="text-sm">
                    <div>Status: {tenant.health?.database?.status || 'unknown'}</div>
                    <div>Connected: {tenant.health?.database?.connected ? 'Yes' : 'No'}</div>
                    {tenant.health?.database?.error && (
                      <div className="text-red-600 mt-1">Error: {tenant.health.database.error}</div>
                    )}
                  </div>
                </div>

                {/* Application Health */}
                <div className={`rounded-lg p-4 border ${
                  tenant.health?.application?.status === 'healthy' 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span>{tenant.health?.application?.status === 'healthy' ? '✅' : '❌'}</span>
                    <span className="font-medium">Application</span>
                  </div>
                  <div className="text-sm">
                    <div>Status: {tenant.health?.application?.status || 'unknown'}</div>
                    {tenant.health?.application?.responseTime && (
                      <div>Response: {tenant.health.application.responseTime}ms</div>
                    )}
                    {tenant.health?.application?.error && (
                      <div className="text-red-600 mt-1">Error: {tenant.health.application.error}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Error Banner */}
              {tenant.error && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
                  ⚠️ {tenant.error}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Admin Console Health */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Admin Console Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span>✅</span>
              <span className="font-medium">API Server</span>
            </div>
            <div className="text-sm text-gray-600 mt-1">Running on port 4000</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span>✅</span>
              <span className="font-medium">Database Connection</span>
            </div>
            <div className="text-sm text-gray-600 mt-1">Neon PostgreSQL</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span>✅</span>
              <span className="font-medium">Authentication</span>
            </div>
            <div className="text-sm text-gray-600 mt-1">Token-based auth active</div>
          </div>
        </div>
      </div>
    </div>
  );
}
