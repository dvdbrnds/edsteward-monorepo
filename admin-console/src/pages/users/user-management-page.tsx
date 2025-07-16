import React from 'react';

export function UserManagementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        <p className="mt-2 text-sm text-gray-600">
          View and manage all platform users across tenants
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Coming Soon</h2>
        <p className="text-gray-600">
          User management features are under development. This will include:
        </p>
        <ul className="mt-2 list-disc list-inside text-gray-600 space-y-1">
          <li>View all users across tenants</li>
          <li>User activity monitoring</li>
          <li>Account status management</li>
          <li>Bulk user operations</li>
        </ul>
      </div>
    </div>
  );
} 