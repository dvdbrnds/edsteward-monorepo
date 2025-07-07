import { cn } from "@/lib/utils";

interface CircularProgressProps {
  progress: number;
  size?: "sm" | "md" | "lg";
  showPercentage?: boolean;
  className?: string;
}

export default function CircularProgress({
  progress,
  size = "md",
  showPercentage = true,
  className
}: CircularProgressProps) {
  const normalizedProgress = Math.min(Math.max(progress, 0), 100);

  // Calculate color based on progress from red to green
  const getProgressColor = (progress: number) => {
    // Convert progress (0-100) to hue (0-120, where 0 is red and 120 is green)
    const hue = (progress * 120) / 100;
    return `hsl(${hue}, 100%, 40%)`;
  };

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16"
  };

  const textSizes = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm"
  };

  // Calculate the coordinates for the arc
  const getArcPath = (percentage: number) => {
    const angle = (percentage / 100) * 360;
    const radius = 50; // SVG viewBox is 100x100, so radius is 50
    const centerX = 50;
    const centerY = 50;

    // Convert angle to radians
    const angleRad = (angle - 90) * Math.PI / 180;

    // Calculate end point
    const endX = centerX + radius * Math.cos(angleRad);
    const endY = centerY + radius * Math.sin(angleRad);

    // Create arc flag (0 for < 180 degrees, 1 for > 180 degrees)
    const largeArcFlag = angle > 180 ? 1 : 0;

    // Move to center, draw line to top, then arc to end point
    return `M ${centerX} ${centerY} L ${centerX} ${centerY - radius} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
  };

  return (
    <div className={cn("relative inline-flex items-center justify-center", sizeClasses[size], className)}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        {/* Background circle */}
        <circle
          className="text-gray-100"
          cx="50"
          cy="50"
          r="48"
          fill="currentColor"
        />
        {/* Progress fill */}
        <path
          d={getArcPath(normalizedProgress)}
          fill={getProgressColor(normalizedProgress)}
        />
      </svg>
      {showPercentage && (
        <div 
          className={cn(
            "absolute inset-0 flex items-center justify-center font-medium rotate-0",
            textSizes[size]
          )}
          style={{ color: getProgressColor(normalizedProgress) }}
        >
          {normalizedProgress}%
        </div>
      )}
    </div>
  );
}