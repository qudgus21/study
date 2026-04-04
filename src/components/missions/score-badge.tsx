import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "lg";
}

export function ScoreBadge({ score, size = "sm" }: ScoreBadgeProps) {
  const color =
    score >= 80
      ? "bg-green-500/10 text-green-600 border-green-500/20"
      : score >= 60
        ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
        : "bg-red-500/10 text-red-600 border-red-500/20";

  const passed = score >= 80;

  return (
    <Badge variant="outline" className={cn(color, size === "lg" && "px-4 py-2 text-lg font-bold")}>
      {score}/100 {passed ? "PASS" : "RETRY"}
    </Badge>
  );
}
