import React, { useState, useEffect } from 'react';
import { Shield, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { useTUF } from '@/services/tuf-client';

interface TUFStatusProps {
  className?: string;
}

type TUFConnectionStatus = 'unknown' | 'healthy' | 'warning' | 'error';

export function TUFStatus({ className = '' }: TUFStatusProps) {
  const [status, setStatus] = useState<TUFConnectionStatus>('unknown');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [regulationCount, setRegulationCount] = useState<number>(0);
  const { getHealth, getAvailableRegulations } = useTUF();

  useEffect(() => {
    const checkTUFStatus = async () => {
      try {
        // Check if TUF service is available first
        const healthResponse = await fetch('/api/tuf/health');
        
        if (!healthResponse.ok) {
          // TUF service is not available/disabled - don't show error
          setStatus('unknown');
          return;
        }
        
        // Check TUF repository health
        const health = await getHealth();
        
        // Get available regulations count
        const regulations = await getAvailableRegulations();
        setRegulationCount(regulations.length);
        
        // Determine status based on health check
        if (health.status === 'ok' || health.status === 'healthy') {
          setStatus('healthy');
        } else {
          setStatus('warning');
        }
        
        setLastCheck(new Date());
        
      } catch {
        // TUF is likely disabled - don't show as error
        console.log('TUF service not available (disabled)');
        setStatus('unknown');
        setLastCheck(new Date());
      }
    };

    // Initial check
    checkTUFStatus();
    
    // Check every 30 seconds
    const interval = setInterval(checkTUFStatus, 30000);
    
    return () => clearInterval(interval);
  }, [getHealth, getAvailableRegulations]);

  const getStatusIcon = () => {
    switch (status) {
      case 'healthy':
        return <ShieldCheck className="w-4 h-4" />;
      case 'warning':
        return <ShieldAlert className="w-4 h-4" />;
      case 'error':
        return <ShieldX className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'healthy':
        return `TUF Secure (${regulationCount} regs)`;
      case 'warning':
        return 'TUF Warning';
      case 'error':
        return 'TUF Error';
      default:
        return null; // Don't show anything when TUF is disabled
    }
  };

  // Don't render anything if TUF is disabled/unknown
  if (status === 'unknown') {
    return null;
  }

  return (
    <div 
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-md border text-sm font-medium ${getStatusColor()} ${className}`}
      title={`TUF Repository Status: ${status}${lastCheck ? ` (Last checked: ${lastCheck.toLocaleTimeString()})` : ''}`}
    >
      {getStatusIcon()}
      <span className="hidden sm:inline">{getStatusText()}</span>
      <span className="sm:hidden">{status === 'healthy' ? '🛡️' : status === 'warning' ? '⚠️' : status === 'error' ? '❌' : '⏳'}</span>
    </div>
  );
}
