import { Settings2, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { useDashboardWidgets, DASHBOARD_WIDGETS, type WidgetId } from '@/hooks/use-dashboard-widgets';
import { Badge } from '@/components/ui/badge';

interface WidgetSettingsProps {
  className?: string;
}

export function WidgetSettings({ className }: WidgetSettingsProps) {
  const { 
    isWidgetVisible, 
    toggleWidget, 
    showAllWidgets, 
    hiddenCount 
  } = useDashboardWidgets();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Settings2 className="h-4 w-4 mr-2" />
          Customize
          {hiddenCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {hiddenCount} hidden
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Dashboard Widgets</span>
          {hiddenCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={showAllWidgets}
              className="h-7 text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Show All
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {DASHBOARD_WIDGETS.map((widget) => {
          const visible = isWidgetVisible(widget.id);
          return (
            <DropdownMenuCheckboxItem
              key={widget.id}
              checked={visible}
              onCheckedChange={() => toggleWidget(widget.id)}
              disabled={!widget.canHide}
              className="flex items-center gap-2 py-2"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {visible ? (
                    <Eye className="h-3 w-3 text-green-500" />
                  ) : (
                    <EyeOff className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="font-medium">{widget.name}</span>
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  {widget.description}
                </p>
              </div>
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Individual widget wrapper that can be hidden by user
interface WidgetWrapperProps {
  widgetId: WidgetId;
  children: React.ReactNode;
}

export function WidgetWrapper({ widgetId, children }: WidgetWrapperProps) {
  const { isWidgetVisible } = useDashboardWidgets();
  
  if (!isWidgetVisible(widgetId)) {
    return null;
  }

  return <>{children}</>;
}

