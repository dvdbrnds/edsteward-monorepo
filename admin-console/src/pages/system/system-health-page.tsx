import React from 'react';

export function SystemHealthPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
        <p className="mt-2 text-sm text-gray-600">
          Monitor system status and performance metrics
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Coming Soon</h2>
        <p className="text-gray-600">
          System health monitoring features are under development. This will include:
        </p>
        <ul className="mt-2 list-disc list-inside text-gray-600 space-y-1">
          <li>Database connection monitoring</li>
          <li>Service health checks</li>
          <li>Performance metrics</li>
          <li>Error rate tracking</li>
          <li>System alerts and notifications</li>
        </ul>
      </div>
    </div>
  );
} 