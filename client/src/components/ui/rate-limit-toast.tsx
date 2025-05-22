import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Clock, AlertTriangle } from 'lucide-react';

interface RateLimitToastProps {
  retryAfter?: number;
  onRetry?: () => void;
}

export function RateLimitToast({ retryAfter, onRetry }: RateLimitToastProps) {
  const [countdown, setCountdown] = useState(retryAfter || 0);
  const { toast } = useToast();

  useEffect(() => {
    if (!retryAfter) return;

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [retryAfter]);

  useEffect(() => {
    if (retryAfter) {
      toast({
        title: "Rate Limit Exceeded",
        description: (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Too many requests. Please wait before trying again.</span>
            </div>
            {countdown > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Retry in {countdown} seconds</span>
              </div>
            )}
            {countdown === 0 && onRetry && (
              <Button size="sm" onClick={onRetry} className="mt-2">
                Try Again
              </Button>
            )}
          </div>
        ),
        variant: "destructive",
        duration: retryAfter ? retryAfter * 1000 : 5000,
      });
    }
  }, [retryAfter, countdown, onRetry, toast]);

  return null;
}

// Hook for handling rate limit states
export function useRateLimit() {
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const handleRateLimit = (retryAfterSeconds?: number) => {
    setIsRateLimited(true);
    setRetryAfter(retryAfterSeconds || null);
    
    // Auto-reset after the retry period
    if (retryAfterSeconds) {
      setTimeout(() => {
        setIsRateLimited(false);
        setRetryAfter(null);
      }, retryAfterSeconds * 1000);
    }
  };

  const resetRateLimit = () => {
    setIsRateLimited(false);
    setRetryAfter(null);
  };

  return {
    isRateLimited,
    retryAfter,
    handleRateLimit,
    resetRateLimit,
  };
}