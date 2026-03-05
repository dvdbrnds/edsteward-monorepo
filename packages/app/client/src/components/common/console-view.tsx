import * as React from "react";
import { cn } from "@/lib/utils";

export interface ConsoleViewProps extends React.HTMLAttributes<HTMLPreElement> {
  logs: Array<{
    message: string;
    type?: 'info' | 'error' | 'warning' | 'success';
    timestamp?: string;
  }>;
}

export function ConsoleView({ logs, className, ...props }: ConsoleViewProps) {
  const consoleRef = React.useRef<HTMLPreElement>(null);

  React.useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <pre
      ref={consoleRef}
      className={cn(
        "font-mono text-sm bg-zinc-950 text-zinc-50 p-4 rounded-lg overflow-auto max-h-[500px]",
        className
      )}
      {...props}
    >
      {logs.map((log, index) => (
        <div
          key={index}
          className={cn(
            "border-l-2 pl-2 mb-1",
            log.type === 'error' && "border-red-500 text-red-400",
            log.type === 'warning' && "border-yellow-500 text-yellow-400",
            log.type === 'success' && "border-green-500 text-green-400",
            !log.type && "border-blue-500 text-blue-400"
          )}
        >
          {log.timestamp && (
            <span className="text-zinc-500 mr-2">[{log.timestamp}]</span>
          )}
          {log.message}
        </div>
      ))}
    </pre>
  );
}