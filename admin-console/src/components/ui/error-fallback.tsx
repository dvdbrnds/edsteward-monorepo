import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorFallbackProps {
    error: Error;
    resetErrorBoundary: () => void;
}

export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-center mb-4">
                    <div className="bg-red-100 rounded-full p-3">
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                    </div>
                </div>

                <div className="text-center">
                    <h1 className="text-xl font-semibold text-gray-900 mb-2">
                        Something went wrong
                    </h1>

                    <p className="text-gray-600 mb-6">
                        The admin console encountered an unexpected error. This has been logged for review.
                    </p>

                    <div className="bg-gray-50 rounded-lg p-3 mb-6">
                        <details className="text-left">
                            <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                                Error Details
                            </summary>
                            <div className="mt-2 text-xs text-gray-600 font-mono whitespace-pre-wrap">
                                {error.message}
                                {error.stack && (
                                    <div className="mt-2 border-t border-gray-200 pt-2">
                                        {error.stack}
                                    </div>
                                )}
                            </div>
                        </details>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={resetErrorBoundary}
                            className="flex-1 flex items-center justify-center px-4 py-2 bg-admin-500 hover:bg-admin-600 text-white rounded-lg transition-colors"
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Try Again
                        </button>

                        <button
                            onClick={() => window.location.href = '/dashboard'}
                            className="flex-1 flex items-center justify-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                        >
                            <Home className="h-4 w-4 mr-2" />
                            Go Home
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
} 