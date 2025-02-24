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
  const strokeWidth = size === "sm" ? 4 : size === "md" ? 6 : 8;
  const radius = size === "sm" ? 24 : size === "md" ? 36 : 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalizedProgress / 100) * circumference;

  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-20 h-20",
    lg: "w-28 h-28"
  };

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  };

  return (
    <div className={cn("relative inline-flex items-center justify-center", sizeClasses[size], className)}>
      <svg className="transform -rotate-90 w-full h-full">
        {/* Background circle */}
        <circle
          className="text-gray-200"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="50%"
          cy="50%"
        />
        {/* Progress circle */}
        <circle
          className="text-[#00267A] transition-all duration-300 ease-in-out"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="50%"
          cy="50%"
        />
      </svg>
      {showPercentage && (
        <div className={cn("absolute inset-0 flex items-center justify-center font-semibold", textSizes[size])}>
          {normalizedProgress}%
        </div>
      )}
    </div>
  );
}
