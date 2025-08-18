import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
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

// MCP Engine message format
export interface MCPRegulationUpdateEvent {
  type: 'regulation_updated';
  regulationId: string;
  version: number;
  timestamp: string;
  data: {
    changeType: string;
    summary?: any;
  };
}

// MCP Engine connection events
export interface MCPConnectionEvent {
  type: 'connected';
  clientId: string;
  timestamp: string;
}

export interface MCPSubscriptionEvent {
  type: 'subscription_confirmed';
  regulationIds: string[];
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
  const [clientId, setClientId] = useState<string | null>(null);
  const [subscribedRegulations, setSubscribedRegulations] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const heartbeatTimeoutRef = useRef<number | null>(null);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [reconnectCount, setReconnectCount] = useState(0);

  // Use MCP Engine URL if configured, otherwise fall back to internal WebSocket
  const wsUrl = import.meta.env.VITE_MCP_WS_URL || import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL?.replace(/^http/, 'ws');
  const useMCPEngine = !!import.meta.env.VITE_MCP_WS_URL;

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
        case 'regulation_updated': {
          // MCP Engine format
          const mcpEvent = message as MCPRegulationUpdateEvent;
          // Invalidate both regulations and regulation updates queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['regulations'] });
          queryClient.invalidateQueries({ queryKey: ['/api/regulation-updates/pending'] });
          
          toast({
            title: "Regulation Updated",
            description: `Regulation ${mcpEvent.regulationId} has been updated to version ${mcpEvent.version}`,
          });
          break;
        }
        case 'reg_version_advanced': {
          // Legacy internal format
          const regEvent = message as RegulationVersionEvent;
          // Invalidate both regulations and regulation updates queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['regulations'] });
          queryClient.invalidateQueries({ queryKey: ['/api/regulation-updates/pending'] });
          
          toast({
            title: "Regulation Updated",
            description: `Regulation ${regEvent.reg_id} has been updated to version ${regEvent.version}`,
          });
          break;
        }
        case 'connected': {
          // MCP Engine connection confirmation
          const connEvent = message as MCPConnectionEvent;
          setClientId(connEvent.clientId);
          console.log('Connected to MCP Engine with client ID:', connEvent.clientId);
          break;
        }
        case 'subscription_confirmed': {
          // MCP Engine subscription confirmation
          const subEvent = message as MCPSubscriptionEvent;
          setSubscribedRegulations(subEvent.regulationIds);
          console.log('Subscribed to regulations:', subEvent.regulationIds);
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
    if (!wsUrl) {
      return;
    }

    // For MCP Engine, we don't require authentication
    if (useMCPEngine || !isAuthenticated) {
      if (!useMCPEngine && !isAuthenticated) {
        return;
      }
    }

    // Don't connect if already connecting or connected
    if (wsRef.current?.readyState === WebSocket.CONNECTING || 
        wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setConnectionState('connecting');
      
      let url: string;
      if (useMCPEngine) {
        // Connect directly to MCP Engine
        url = wsUrl;
      } else {
        // Use legacy internal WebSocket with authentication
        const token = await getToken();
        if (!token) {
          setConnectionState('error');
          return;
        }
        url = `${wsUrl}/stream?token=${encodeURIComponent(token)}`;
      }
      
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState('connected');
        setReconnectCount(0);
        startHeartbeat();
        
        if (useMCPEngine) {
          console.log('Connected to MCP Engine');
          // Subscribe to all regulations (you can make this configurable)
          const subscribeMessage = {
            type: 'subscribe',
            regulationIds: ['REG-66'] // Start with REG-66, expand as needed
          };
          ws.send(JSON.stringify(subscribeMessage));
        } else {
          console.log('WebSocket connected to internal server');
        }
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
  }, [isAuthenticated, wsUrl, getToken, reconnectCount, reconnectAttempts, reconnectDelay, handleMessage, startHeartbeat, cleanup, toast, useMCPEngine]);

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

  // Auto-connect when authenticated (or immediately for MCP Engine)
  useEffect(() => {
    if (autoConnect && (isAuthenticated || useMCPEngine)) {
      connect();
    } else if (!isAuthenticated && !useMCPEngine) {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, isAuthenticated, connect, disconnect, useMCPEngine]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [cleanup]);

  // Method to subscribe to additional regulations
  const subscribeToRegulations = useCallback((regulationIds: string[]) => {
    if (useMCPEngine && wsRef.current?.readyState === WebSocket.OPEN) {
      const subscribeMessage = {
        type: 'subscribe',
        regulationIds
      };
      wsRef.current.send(JSON.stringify(subscribeMessage));
      return true;
    }
    return false;
  }, [useMCPEngine]);

  return {
    connectionState,
    reconnectCount,
    connect,
    disconnect,
    sendMessage,
    subscribeToRegulations,
    clientId,
    subscribedRegulations,
    useMCPEngine,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    hasError: connectionState === 'error',
  };
}