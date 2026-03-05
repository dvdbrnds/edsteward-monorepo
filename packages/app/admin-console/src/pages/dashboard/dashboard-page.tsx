import React, { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

interface SystemStats {
  totalCustomers: number;
  activeCustomers: number;
  totalUsers: number;
  totalRegulations: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  databaseStatus: 'connected' | 'disconnected';
  lastUpdated: string;
}

export function DashboardPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemStats();
  }, []);

  const fetchSystemStats = async () => {
    try {
      const data = await apiGet<any>('/api/dashboard/stats');
      
      setStats({
        totalCustomers: data.totalCustomers,
        activeCustomers: data.activeCustomers,
        totalUsers: data.activeUsers,
        totalRegulations: data.totalRegulations,
        systemHealth: data.systemStatus as 'healthy' | 'warning' | 'critical',
        databaseStatus: 'connected',
        lastUpdated: new Date().toISOString(),
      });
      setError(null);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      setStats({
        totalCustomers: 0,
        activeCustomers: 0,
        totalUsers: 0,
        totalRegulations: 0,
        systemHealth: 'critical',
        databaseStatus: 'disconnected',
        lastUpdated: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Overview of your EdSteward platform
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">🏢</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Customers
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats?.totalCustomers || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">👥</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Users
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats?.totalUsers || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">📋</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Regulations
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats?.totalRegulations || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">🔧</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    System Health
                  </dt>
                  <dd className={`text-sm font-medium px-2 py-1 rounded-full inline-block ${getHealthColor(stats?.systemHealth || 'unknown')}`}>
                    {stats?.systemHealth || 'Unknown'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Status</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Database Connection</span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                stats?.databaseStatus === 'connected' 
                  ? 'text-green-800 bg-green-100' 
                  : 'text-red-800 bg-red-100'
              }`}>
                {stats?.databaseStatus || 'Unknown'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Last Updated</span>
              <span className="text-sm text-gray-900">
                {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'Never'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <button className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-3 rounded-lg text-left transition-colors">
              <div className="font-medium">Manage Customers</div>
              <div className="text-sm text-blue-600">View and manage customer accounts</div>
            </button>
            <button className="bg-green-50 hover:bg-green-100 text-green-700 px-4 py-3 rounded-lg text-left transition-colors">
              <div className="font-medium">View Users</div>
              <div className="text-sm text-green-600">Browse all platform users</div>
            </button>
            <button className="bg-purple-50 hover:bg-purple-100 text-purple-700 px-4 py-3 rounded-lg text-left transition-colors">
              <div className="font-medium">System Health</div>
              <div className="text-sm text-purple-600">Check detailed system status</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 