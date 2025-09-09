import React, { lazy, Suspense, ComponentType, LazyExoticComponent } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

/**
 * Enhanced lazy loading wrapper with error boundaries and loading states
 */
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  const LazyComponent = lazy(importFn);
  
  return LazyComponent;
}

/**
 * Loading fallback components for different scenarios
 */
export const LoadingFallbacks = {
  // Generic loading skeleton
  Default: () => (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-32 w-full" />
    </div>
  ),
  
  // Admin page loading
  AdminPage: () => (
    <div className="p-8 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-1/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-1/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  ),
  
  // Regulation list loading
  RegulationsList: () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-10 w-32" />
      </div>
      
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
  
  // Dashboard loading
  Dashboard: () => (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/* Stats cards */}
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </div>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32 mt-2" />
          </CardContent>
        </Card>
      ))}
      
      {/* Charts area */}
      <div className="md:col-span-2 lg:col-span-4 space-y-6">
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-6 w-1/4 mb-4" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
};

/**
 * Error fallback component for lazy loading failures
 */
export function LazyErrorFallback({ 
  error, 
  resetErrorBoundary,
  componentName = 'Component'
}: { 
  error: Error; 
  resetErrorBoundary: () => void;
  componentName?: string;
}) {
  return (
    <Card className="border-destructive">
      <CardContent className="p-6 text-center space-y-4">
        <div className="text-destructive">
          <h3 className="text-lg font-semibold">Failed to load {componentName}</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {error.message || 'An unexpected error occurred while loading this component.'}
          </p>
        </div>
        
        <div className="space-y-2">
          <button
            onClick={resetErrorBoundary}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
          
          <div className="text-xs text-muted-foreground">
            If this problem persists, please refresh the page or contact support.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Wrapper component that combines lazy loading with error boundaries and loading states
 */
export function LazyComponentWrapper({
  children,
  fallback = LoadingFallbacks.Default,
  errorFallback,
  componentName = 'Component'
}: {
  children: React.ReactNode;
  fallback?: ComponentType;
  errorFallback?: ComponentType<{ error: Error; resetErrorBoundary: () => void }>;
  componentName?: string;
}) {
  const FallbackComponent = fallback;
  const ErrorComponent = errorFallback || LazyErrorFallback;
  
  return (
    <ErrorBoundary
      FallbackComponent={(props) => (
        <ErrorComponent {...props} componentName={componentName} />
      )}
      onError={(error) => {
        console.error(`[LAZY-LOADING] Error in ${componentName}:`, error);
        
        // In production, send to error tracking service
        if (process.env.NODE_ENV === 'production') {
          // Example: Sentry.captureException(error, { tags: { component: componentName } });
        }
      }}
    >
      <Suspense fallback={<FallbackComponent />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * Pre-defined lazy components for common pages
 * These will be code-split automatically by Vite
 */

// Admin components
export const LazyAdminConsolePage = createLazyComponent(
  () => import('../../pages/admin-console-page')
);

export const LazyAdminFeatureManagementPage = createLazyComponent(
  () => import('../../pages/admin-feature-management-page')
);

export const LazyTenantFeatureManager = createLazyComponent(
  () => import('../admin/tenant-feature-manager')
);

// Regulation components
export const LazyRegulationsPage = createLazyComponent(
  () => import('../../pages/regulations-page')
);

export const LazyRegulationDetailPage = createLazyComponent(
  () => import('../../pages/RegulationDetailPage')
);

// Note: Uncomment these once components have proper default exports
// export const LazyRegulationViewer = createLazyComponent(
//   () => import('../../pages/RegulationViewer')
// );

// Dashboard components
export const LazyDashboardPage = createLazyComponent(
  () => import('../../pages/trustees-dashboard')
);

// Note: Uncomment these once components have proper default exports
// export const LazyComplianceOverview = createLazyComponent(
//   () => import('../dashboard/compliance-overview')
// );

// Analytics components
export const LazyReportsPage = createLazyComponent(
  () => import('../../pages/reports-page')
);

// Note: Uncomment once component has proper default export
// export const LazyComplianceAnalyticsDashboard = createLazyComponent(
//   () => import('../analytics/compliance-analytics-dashboard')
// );

// Utility components  
export const LazyDebugToolsPage = createLazyComponent(
  () => import('../../pages/admin/debug-tools-page')
);

export const LazyLogsPage = createLazyComponent(
  () => import('../../pages/admin/logs-page')
);

/**
 * Higher-order component for adding performance monitoring to lazy components
 */
export function withPerformanceMonitoring<P extends object>(
  WrappedComponent: ComponentType<P>,
  componentName: string
) {
  return function PerformanceMonitoredComponent(props: P) {
    const startTime = React.useMemo(() => performance.now(), []);
    
    React.useEffect(() => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      console.log(`[PERFORMANCE] ${componentName} rendered in ${renderTime.toFixed(2)}ms`);
      
      // Track slow renders
      if (renderTime > 100) {
        console.warn(`[PERFORMANCE] Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`);
      }
      
      // In production, send metrics to monitoring service
      if (process.env.NODE_ENV === 'production') {
        // Example: analytics.track('component_render', { component: componentName, time: renderTime });
      }
    }, [startTime, componentName]);
    
    return <WrappedComponent {...props} />;
  };
}

/**
 * Hook for preloading components on user interaction
 */
export function usePreloadComponent(importFn: () => Promise<unknown>) {
  const [isPreloaded, setIsPreloaded] = React.useState(false);
  
  const preload = React.useCallback(() => {
    if (!isPreloaded) {
      importFn().then(() => {
        setIsPreloaded(true);
        console.log('[PRELOAD] Component preloaded successfully');
      }).catch((error) => {
        console.warn('[PRELOAD] Failed to preload component:', error);
      });
    }
  }, [importFn, isPreloaded]);
  
  return { preload, isPreloaded };
} 