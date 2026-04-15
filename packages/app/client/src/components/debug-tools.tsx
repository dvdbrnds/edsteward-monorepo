import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// import { useAuth } from '@/hooks/use-auth'; // Temporarily disabled

interface DebugToolsProps {
  className?: string;
}

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

declare global {
  interface Performance {
    memory?: PerformanceMemory;
  }
}

const DebugTools: React.FC<DebugToolsProps> = ({ className }) => {
  // Temporarily disabled due to circular dependency fix
  const connectionState = 'disconnected';
  const useMCPEngine = false;
  const clientId = null;
  const subscribedRegulations: string[] = [];
  const reconnectCount = 0;
  const connect = () => console.log('WebSocket connect disabled');
  const disconnect = () => console.log('WebSocket disconnect disabled');
  const subscribeToRegulations = () => false;

  const handleClearCache = () => {
    localStorage.clear();
    sessionStorage.clear();
    console.log('Browser cache cleared');
  };

  const handleExportLogs = () => {
    const logs = {
      timestamp: new Date().toISOString(),
      localStorage: { ...localStorage },
      sessionStorage: { ...sessionStorage },
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const environmentInfo = {
    'Node Environment': process.env.NODE_ENV || 'development',
    'Build Time': process.env.VITE_BUILD_TIME || 'unknown',
    'Version': process.env.VITE_APP_VERSION || '1.0.0',
    'User Agent': navigator.userAgent,
    'Screen Resolution': `${screen.width}x${screen.height}`,
    'Window Size': `${window.innerWidth}x${window.innerHeight}`,
    'Time Zone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    'Language': navigator.language
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔧 Debug Tools
            <Badge variant="secondary">Development</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Environment Information</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(environmentInfo).map(([key, value]) => (
                <div key={key} className="flex justify-between p-2 bg-muted rounded">
                  <span className="font-medium">{key}:</span>
                  <span className="text-muted-foreground truncate ml-2">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Actions</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCache}
              >
                Clear Cache
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportLogs}
              >
                Export Logs
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">WebSocket Status (EdSteward Integration)</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span className="font-medium">Connection:</span>
                  <Badge variant={connectionState === 'connected' ? 'default' : 'secondary'}>
                    {connectionState}
                  </Badge>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span className="font-medium">EdSteward:</span>
                  <Badge variant={useMCPEngine ? 'default' : 'secondary'}>
                    {useMCPEngine ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span className="font-medium">Client ID:</span>
                  <span className="text-muted-foreground truncate ml-2">
                    {clientId || 'Not connected'}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span className="font-medium">Subscriptions:</span>
                  <span className="text-muted-foreground">
                    {subscribedRegulations.length > 0 ? subscribedRegulations.join(', ') : 'None'}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span className="font-medium">Reconnect Count:</span>
                  <span className="text-muted-foreground">{reconnectCount}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span className="font-medium">WebSocket URL:</span>
                  <span className="text-muted-foreground text-xs">
                    {useMCPEngine ? 'ws://localhost:3003/regulation-updates' : 'Internal WebSocket'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => connect()}
                  disabled={connectionState === 'connected' || connectionState === 'connecting'}
                >
                  Connect
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnect()}
                  disabled={connectionState === 'disconnected'}
                >
                  Disconnect
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => subscribeToRegulations(['REG-66'])}
                  disabled={connectionState !== 'connected'}
                >
                  Subscribe REG-66
                </Button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Performance</h3>
            <div className="text-xs text-muted-foreground">
              {typeof performance !== 'undefined' && performance.memory && (
                <div className="space-y-1">
                  <div>Used JS Heap: {Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)}MB</div>
                  <div>Total JS Heap: {Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)}MB</div>
                  <div>JS Heap Limit: {Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)}MB</div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DebugTools; 