"use client";

interface SkillBarItem {
  skill_name: string;
  mention_count: number;
}

interface SkillBarChartProps {
  data: SkillBarItem[];
  maxCount?: number;
}

const SKILL_COLORS: Record<string, string> = {
  React: "#61DAFB",
  TypeScript: "#3178C6",
  JavaScript: "#F7DF1E",
  "Next.js": "#000000",
  Vue: "#4FC08D",
  Tailwind: "#06B6D4",
  "Node.js": "#339933",
  Redux: "#764ABC",
  Vite: "#646CFF",
  GraphQL: "#E10098",
};

function getColor(skill: string): string {
  return SKILL_COLORS[skill] ?? "#6366f1";
}

export function SkillBarChart({ data, maxCount }: SkillBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
        데이터가 없습니다. JD 수집 버튼을 눌러주세요.
      </div>
    );
  }

  const max = maxCount ?? Math.max(...data.map((d) => d.mention_count), 1);

  return (
    <div className="space-y-2">
      {data.map((item) => {
        const pct = Math.round((item.mention_count / max) * 100);
        return (
          <div key={item.skill_name} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-right text-xs font-medium">
              {item.skill_name}
            </span>
            <div className="bg-muted h-5 flex-1 rounded">
              <div
                className="flex h-5 items-center rounded px-2 transition-all duration-500"
                style={{
                  width: `${Math.max(pct, 4)}%`,
                  backgroundColor: getColor(item.skill_name),
                  opacity: 0.85,
                }}
              >
                <span className="text-[10px] font-bold text-white">{item.mention_count}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
