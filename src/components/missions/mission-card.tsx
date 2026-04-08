"use client";

import Link from "next/link";
import { BookOpen, MessageSquare, Code, ArrowRight, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface MissionCardData {
  id: string;
  title: string;
  missionType: "concept" | "discussion" | "code";
  status: "pending" | "in_progress" | "passed" | "failed";
  categoryName?: string;
  attemptCount?: number;
  lastScore?: number | null;
}

const typeConfig = {
  concept: { icon: BookOpen, label: "개념", color: "bg-blue-500/10 text-blue-600" },
  discussion: { icon: MessageSquare, label: "토론", color: "bg-purple-500/10 text-purple-600" },
  code: { icon: Code, label: "코드", color: "bg-green-500/10 text-green-600" },
};

const statusConfig = {
  pending: { label: "대기", color: "bg-muted text-muted-foreground" },
  in_progress: { label: "진행 중", color: "bg-yellow-500/10 text-yellow-600" },
  passed: { label: "통과", color: "bg-green-500/10 text-green-600" },
  failed: { label: "실패", color: "bg-red-500/10 text-red-600" },
};

export function MissionCard({
  mission,
  onDelete,
}: {
  mission: MissionCardData;
  onDelete?: (id: string) => void;
}) {
  const type = typeConfig[mission.missionType];
  const status = statusConfig[mission.status];
  const Icon = type.icon;

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="flex items-center gap-4 p-4">
        <Link href={`/missions/${mission.id}`} className="flex min-w-0 flex-1 items-center gap-4">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              type.color,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("text-xs", status.color)}>
                {status.label}
              </Badge>
              <Badge variant="outline" className={cn("text-xs", type.color)}>
                {type.label}
              </Badge>
              {mission.categoryName && (
                <span className="text-muted-foreground text-xs">{mission.categoryName}</span>
              )}
            </div>
            <p className="mt-1 truncate text-sm font-medium">{mission.title}</p>
            {mission.attemptCount !== undefined && mission.attemptCount > 0 && (
              <p className="text-muted-foreground text-xs">
                시도: {mission.attemptCount}회
                {mission.lastScore !== null &&
                  mission.lastScore !== undefined &&
                  ` · 최근 점수: ${mission.lastScore}점`}
              </p>
            )}
          </div>

          <ArrowRight className="text-muted-foreground h-4 w-4 shrink-0" />
        </Link>

        {onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              onDelete(mission.id);
            }}
            className="text-muted-foreground hover:text-destructive shrink-0 cursor-pointer p-1 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </CardContent>
    </Card>
  );
}
