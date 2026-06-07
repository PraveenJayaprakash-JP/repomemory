'use client';

import { useState } from 'react';

interface ScanPoint {
  createdAt: string;
  totalScore: number;
}

interface ScoreTimelineProps {
  scans: ScanPoint[];
}

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green-500
  if (score >= 60) return '#3b82f6'; // blue-500
  if (score >= 30) return '#f59e0b'; // amber-500
  return '#ef4444'; // red-500
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function ScoreTimeline({ scans }: ScoreTimelineProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (scans.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        No scan history yet
      </div>
    );
  }

  const W = 600;
  const H = 200;
  const PAD_LEFT = 40;
  const PAD_RIGHT = 20;
  const PAD_TOP = 20;
  const PAD_BOTTOM = 30;
  const chartW = W - PAD_LEFT - PAD_RIGHT;
  const chartH = H - PAD_TOP - PAD_BOTTOM;

  // Y axis: 0-100
  const yScale = (score: number) =>
    PAD_TOP + chartH - (score / 100) * chartH;

  // X axis: evenly spaced
  const xScale = (i: number) => {
    if (scans.length === 1) return PAD_LEFT + chartW / 2;
    return PAD_LEFT + (i / (scans.length - 1)) * chartW;
  };

  const points = scans.map((s, i) => ({
    x: xScale(i),
    y: yScale(s.totalScore),
    score: s.totalScore,
    date: s.createdAt,
    color: scoreColor(s.totalScore),
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Y-axis gridlines at 0, 25, 50, 75, 100
  const gridLines = [0, 25, 50, 75, 100].map((v) => ({
    y: yScale(v),
    label: String(v),
  }));

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 200 }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {gridLines.map((g) => (
          <g key={g.label}>
            <line
              x1={PAD_LEFT}
              y1={g.y}
              x2={W - PAD_RIGHT}
              y2={g.y}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT - 6}
              y={g.y}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground"
              fontSize={10}
            >
              {g.label}
            </text>
          </g>
        ))}

        {/* Connecting line */}
        {points.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}

        {/* Data points + hover areas */}
        {points.map((p, i) => (
          <g
            key={i}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Invisible hit area */}
            <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
            {/* Visible dot */}
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === i ? 6 : 4}
              fill={p.color}
              stroke="white"
              strokeWidth={2}
              className="transition-all duration-150"
            />
            {/* Tooltip */}
            {hoveredIndex === i && (
              <g>
                <rect
                  x={p.x - 48}
                  y={p.y - 38}
                  width={96}
                  height={28}
                  rx={4}
                  fill="hsl(var(--popover))"
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                />
                <text
                  x={p.x}
                  y={p.y - 20}
                  textAnchor="middle"
                  className="fill-popover-foreground"
                  fontSize={11}
                  fontWeight={600}
                >
                  {p.score} — {formatDate(p.date)}
                </text>
              </g>
            )}
          </g>
        ))}

        {/* X-axis date labels */}
        {points.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={H - 6}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={10}
          >
            {formatDate(p.date)}
          </text>
        ))}
      </svg>
    </div>
  );
}