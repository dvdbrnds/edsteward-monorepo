import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiQuery } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, Database, Server } from 'lucide-react';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  server: string;
  database: {
    connected: boolean;
    monitoring: boolean;
    consecutiveFailures: number;
    maxFailures: number;
  };
}

interface HealthMonitorProps {
  interval?: number; // in milliseconds, default 30 seconds
  compact?: boolean;
}

export const HealthMonitor: React.FC<HealthMonitorProps> = ({ 
  interval = 30000, 
  compact = false 
}) => {
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Health check query with automatic refetching
  const { data, isError, error, isLoading } = useQuery({
    queryKey: ['/api/health'],
    queryFn: () => apiQuery('/api/health'),
    refetchInterval: interval,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Cast data to HealthStatus type
  const healthData = data as HealthStatus | undefined;

  // Update last check time when query succeeds
  useEffect(() => {
    if (healthData && !isError) {
      setLastCheck(new Date());
    }
  }, [healthData, isError]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'down':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4" />;
      case 'degraded':
        return <AlertCircle className="h-4 w-4" />;
      case 'down':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        {!isOnline && (
          <Badge variant="destructive" className="flex items-center space-x-1">
            <AlertCircle className="h-3 w-3" />
            <span>Offline</span>
          </Badge>
        )}
        {isError ? (
          <Badge variant="destructive" className="flex items-center space-x-1">
            <AlertCircle className="h-3 w-3" />
            <span>Server Error</span>
          </Badge>
        ) : healthData ? (
          <Badge className={`flex items-center space-x-1 ${getStatusColor(healthData.status)}`}>
            {getStatusIcon(healthData.status)}
            <span className="capitalize">{healthData.status}</span>
          </Badge>
        ) : (
          <Badge variant="outline" className="flex items-center space-x-1">
            <Clock className="h-3 w-3" />
            <span>Checking...</span>
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <Server className="h-5 w-5" />
            <span>System Health</span>
          </span>
          <div className="text-sm text-muted-foreground">
            Last check: {lastCheck.toLocaleTimeString()}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Network Status */}
        <div className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <span>Network Connection</span>
          </span>
          <Badge className={isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
        </div>

        {/* Server Status */}
        <div className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span>Server Status</span>
          </span>
          {isLoading ? (
            <Badge variant="outline">Checking...</Badge>
          ) : isError ? (
            <Badge variant="destructive" className="flex items-center space-x-1">
              <AlertCircle className="h-3 w-3" />
              <span>Error</span>
            </Badge>
          ) : healthData ? (
            <Badge className={`flex items-center space-x-1 ${getStatusColor(healthData.status)}`}>
              {getStatusIcon(healthData.status)}
              <span className="capitalize">{healthData.status}</span>
            </Badge>
          ) : (
            <Badge variant="outline">Unknown</Badge>
          )}
        </div>

        {/* Database Status */}
        {healthData?.database && (
          <div className="flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span>Database</span>
            </span>
            <Badge className={healthData.database.connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
              {healthData.database.connected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
        )}

        {/* Error Details */}
        {isError && error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center space-x-2 text-red-800">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Connection Error</span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              {error instanceof Error ? error.message : 'Failed to connect to server'}
            </p>
          </div>
        )}

        {/* Health Check Info */}
        {healthData && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            <div>Monitoring every {interval / 1000}s</div>
            <div>Server time: {new Date(healthData.timestamp).toLocaleString()}</div>
            {healthData.database.consecutiveFailures > 0 && (
              <div className="text-yellow-600">
                DB failures: {healthData.database.consecutiveFailures}/{healthData.database.maxFailures}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HealthMonitor; 