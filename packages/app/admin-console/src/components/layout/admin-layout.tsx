import React, { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AdminUser } from '@/types/auth';
import { useAuth } from '@/hooks/use-auth';

interface AdminLayoutProps {
  children: ReactNode;
  user: AdminUser;
}

const navigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Customers', href: '/customers', icon: '🏢' },
  { name: 'Assessment', href: '/assessment', icon: '🎯' },
  { name: 'Users', href: '/users', icon: '👥' },
  { name: 'System Health', href: '/system', icon: '🔧' },
];

export function AdminLayout({ children, user }: AdminLayoutProps) {
  const location = useLocation();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-center border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">EdSteward Admin</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    group flex items-center px-2 py-2 text-sm font-medium rounded-md
                    ${isActive
                      ? 'bg-blue-100 text-blue-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">{user.name}</p>
                <p className="text-xs text-gray-500">{user.role}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="mt-3 w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
} 