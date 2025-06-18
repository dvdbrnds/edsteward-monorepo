import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: string;
}

export interface RegulationVersionEvent {
  type: 'reg_version_advanced';
  reg_id: string;
  version: number;
  timestamp: string;
}

export interface WebSocketHookOptions {
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
}

export function useWebSocket(options: WebSocketHookOptions = {}) {
  const {
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 3000,
    heartbeatInterval = 30000,
  } = options;

  const { getToken, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const heartbeatTimeoutRef = useRef<number | null>(null);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [reconnectCount, setReconnectCount] = useState(0);

  const wsUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL?.replace(/^http/, 'ws');

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }

    heartbeatTimeoutRef.current = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
        startHeartbeat(); // Schedule next heartbeat
      }
    }, heartbeatInterval) as unknown as number;
  }, [heartbeatInterval]);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'reg_version_advanced': {
          const regEvent = message as RegulationVersionEvent;
          // Invalidate regulations queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['regulations'] });
          
          toast({
            title: "Regulation Updated",
            description: `Regulation ${regEvent.reg_id} has been updated to version ${regEvent.version}`,
          });
          break;
        }
        case 'pong':
          // Heartbeat response, connection is alive
          break;
        case 'error':
          console.error('WebSocket error message:', message.data);
          toast({
            title: "WebSocket Error",
            description: message.data?.message || "An error occurred",
            variant: "destructive",
          });
          break;
        default:
          console.log('Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, [queryClient, toast]);

  const connect = useCallback(async () => {
    if (!isAuthenticated || !wsUrl) {
      return;
    }

    // Don't connect if already connecting or connected
    if (wsRef.current?.readyState === WebSocket.CONNECTING || 
        wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setConnectionState('connecting');
      
      const token = await getToken();
      if (!token) {
        setConnectionState('error');
        return;
      }

      const url = `${wsUrl}/stream?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState('connected');
        setReconnectCount(0);
        startHeartbeat();
        console.log('WebSocket connected');
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        setConnectionState('disconnected');
        cleanup();
        
        if (!event.wasClean && reconnectCount < reconnectAttempts) {
          console.log(`WebSocket closed unexpectedly. Reconnecting in ${reconnectDelay}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectCount(prev => prev + 1);
            connect();
          }, reconnectDelay) as unknown as number;
        } else if (reconnectCount >= reconnectAttempts) {
          setConnectionState('error');
          toast({
            title: "Connection Lost",
            description: "Failed to reconnect to real-time updates. Please refresh the page.",
            variant: "destructive",
          });
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionState('error');
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setConnectionState('error');
    }
  }, [isAuthenticated, wsUrl, getToken, reconnectCount, reconnectAttempts, reconnectDelay, handleMessage, startHeartbeat, cleanup, toast]);

  const disconnect = useCallback(() => {
    cleanup();
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    setConnectionState('disconnected');
    setReconnectCount(0);
  }, [cleanup]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Auto-connect when authenticated
  useEffect(() => {
    if (autoConnect && isAuthenticated) {
      connect();
    } else if (!isAuthenticated) {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, isAuthenticated, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [cleanup]);

  return {
    connectionState,
    reconnectCount,
    connect,
    disconnect,
    sendMessage,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    hasError: connectionState === 'error',
  };
}