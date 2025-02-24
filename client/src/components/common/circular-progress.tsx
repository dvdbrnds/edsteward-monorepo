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
  const strokeWidth = size === "sm" ? 3 : size === "md" ? 4 : 6;
  const radius = size === "sm" ? 16 : size === "md" ? 24 : 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalizedProgress / 100) * circumference;

  // Color transitions based on progress
  const getColor = (progress: number) => {
    if (progress < 30) return "text-red-500";
    if (progress < 70) return "text-yellow-500";
    return "text-green-500";
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

  return (
    <div className={cn("relative inline-flex items-center justify-center", sizeClasses[size], className)}>
      <svg className="transform -rotate-90 w-full h-full">
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.1" />
            <stop offset={`${normalizedProgress}%`} stopColor="currentColor" />
          </linearGradient>
        </defs>
        {/* Background circle */}
        <circle
          className="text-gray-100 transition-all duration-500 ease-in-out"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="50%"
          cy="50%"
        />
        {/* Progress circle */}
        <circle
          className={cn("transition-all duration-500 ease-in-out", getColor(normalizedProgress))}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="url(#progressGradient)"
          fill="transparent"
          r={radius}
          cx="50%"
          cy="50%"
        >
          <animate
            attributeName="stroke-dashoffset"
            from={circumference}
            to={offset}
            dur="1s"
            fill="freeze"
          />
        </circle>
      </svg>
      {showPercentage && (
        <div className={cn(
          "absolute inset-0 flex items-center justify-center font-medium",
          textSizes[size],
          getColor(normalizedProgress)
        )}>
          {normalizedProgress}%
        </div>
      )}
    </div>
  );
}