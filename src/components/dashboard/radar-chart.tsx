"use client";

interface RadarDataPoint {
  skill_name: string;
  confidence_level: number;
}

interface RadarChartProps {
  data: RadarDataPoint[];
}

export function RadarChart({ data }: RadarChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-48 items-center justify-center text-sm">
        아직 학습 데이터가 없습니다
      </div>
    );
  }

  // 최대 10개만 표시
  const items = data.slice(0, 10);
  const n = items.length;
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 80;

  // 각 꼭짓점 좌표 계산 (위쪽부터 시계방향)
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  function getPoint(index: number, r: number) {
    const angle = startAngle + index * angleStep;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }

  // 배경 격자선 (20, 40, 60, 80, 100%)
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  const gridPolygons = gridLevels.map((level) => {
    const points = Array.from({ length: n }, (_, i) => {
      const p = getPoint(i, maxR * level);
      return `${p.x},${p.y}`;
    }).join(" ");
    return points;
  });

  // 데이터 폴리곤
  const dataPoints = items.map((item, i) => {
    const r = maxR * (item.confidence_level / 100);
    return getPoint(i, r);
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // 축선
  const axisLines = Array.from({ length: n }, (_, i) => {
    const p = getPoint(i, maxR);
    return { x1: cx, y1: cy, x2: p.x, y2: p.y };
  });

  // 레이블 위치 (살짝 바깥)
  const labelPoints = items.map((item, i) => {
    const p = getPoint(i, maxR + 18);
    return { ...p, label: item.skill_name, confidence: item.confidence_level };
  });

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[240px]">
        {/* 배경 격자 */}
        {gridPolygons.map((points, i) => (
          <polygon
            key={i}
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.5}
            className="text-border"
          />
        ))}

        {/* 축선 */}
        {axisLines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="currentColor"
            strokeWidth={0.5}
            className="text-border"
          />
        ))}

        {/* 데이터 영역 */}
        <polygon
          points={dataPolygon}
          fill="hsl(var(--primary))"
          fillOpacity={0.2}
          stroke="hsl(var(--primary))"
          strokeWidth={1.5}
        />

        {/* 데이터 포인트 */}
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="hsl(var(--primary))" />
        ))}
      </svg>

      {/* 레전드 */}
      <div className="mt-2 grid w-full grid-cols-2 gap-x-4 gap-y-1">
        {labelPoints.map((lp, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-muted-foreground truncate text-xs">{lp.label}</span>
            <span className="ml-1 text-xs font-medium">{lp.confidence}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
