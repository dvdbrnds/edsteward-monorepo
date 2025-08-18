import { useWebSocket } from "@/hooks/useWebSocket";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

export function WebSocketStatus() {
  const { connectionState, useMCPEngine, subscribedRegulations } = useWebSocket();

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = () => {
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
      switch (connectionState) {
        case 'connected':
          return 'WebSocket Connected';
        case 'connecting':
          return 'Connecting...';
        case 'error':
          return 'Connection Error';
        default:
          return 'Disconnected';
      }
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
