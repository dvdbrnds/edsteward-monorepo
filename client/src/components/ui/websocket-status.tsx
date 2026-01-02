import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";

export function WebSocketStatus() {
  const webSocket = useWebSocket({ autoConnect: true });
  const { connectionState, useMCPEngine, subscribedRegulations } = webSocket;

  const getStatusColor = () => {
    if (!useMCPEngine) {
      return 'bg-gray-400'; // Neutral color when MCP is disabled
    }
    
    switch (connectionState) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-background0';
    }
  };

  const getStatusIcon = () => {
    if (!useMCPEngine) {
      return <WifiOff className="h-3 w-3 opacity-60" />; // Dimmed icon when disabled
    }
    
    switch (connectionState) {
      case 'connected':
        return <Wifi className="h-3 w-3" />;
      case 'connecting':
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case 'error':
      case 'disconnected':
        return <WifiOff className="h-3 w-3" />;
      default:
        return <WifiOff className="h-3 w-3" />;
    }
  };

  const getStatusText = () => {
    if (useMCPEngine) {
      switch (connectionState) {
        case 'connected':
          return `MCP Engine (${subscribedRegulations.length} regs)`;
        case 'connecting':
          return 'Connecting to MCP...';
        case 'error':
          return 'MCP Engine Error';
        default:
          return 'MCP Disconnected';
      }
    } else {
      // When MCP is disabled, show a neutral status
      return 'Real-time Updates Disabled';
    }
  };

  return (
    <Badge 
      variant="outline" 
      className={`${getStatusColor()} text-white border-white/20 flex items-center gap-1 text-xs`}
    >
      {getStatusIcon()}
      <span className="hidden sm:inline">{getStatusText()}</span>
    </Badge>
  );
}
