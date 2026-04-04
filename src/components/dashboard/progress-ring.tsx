"use client";

interface ProgressRingProps {
  passed: number;
  total: number;
  label: string;
  color: string;
  size?: number;
}

export function ProgressRing({ passed, total, label, color, size = 80 }: ProgressRingProps) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total > 0 ? passed / total : 0;
  const dashOffset = circumference * (1 - ratio);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* 배경 트랙 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={6}
            className="text-muted/30"
          />
          {/* 진행 링 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        {/* 중앙 텍스트 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg leading-none font-bold">{passed}</span>
          <span className="text-muted-foreground text-xs">/{total}</span>
        </div>
      </div>
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
    </div>
  );
}
