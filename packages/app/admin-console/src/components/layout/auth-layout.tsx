import React, { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-extrabold text-gray-900 mb-2">
            EdSteward Admin
          </h1>
          <p className="text-center text-sm text-gray-600">
            Administrative Control Panel
          </p>
        </div>
        {children}
      </div>
    </div>
  );
} 