import { Circle } from "lucide-react";

interface HealthScoreIndicatorProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-12 h-12 text-sm",
  lg: "w-16 h-16 text-base"
};

export default function HealthScoreIndicator({ score, size = "sm" }: HealthScoreIndicatorProps) {
  // Calculate color based on score
  const getColor = (score: number) => {
    if (score >= 80) return "rgb(34, 197, 94)"; // green-500
    if (score >= 60) return "rgb(234, 179, 8)"; // yellow-500
    if (score >= 40) return "rgb(249, 115, 22)"; // orange-500
    return "rgb(239, 68, 68)"; // red-500
  };

  const color = getColor(score);
  const sizeClass = sizeClasses[size];

  return (
    <div className={`relative ${sizeClass} inline-flex items-center justify-center`}>
      <svg className="w-full h-full" viewBox="0 0 36 36">
        {/* Background circle */}
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          className="stroke-gray-200"
          strokeWidth="2"
        />
        {/* Progress circle */}
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={`${score} 100`}
          transform="rotate(-90 18 18)"
          className="transition-all duration-300"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-medium" style={{ color }}>
        {score}%
      </div>
    </div>
  );
}
