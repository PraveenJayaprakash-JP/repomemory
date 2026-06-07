'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Lightbulb } from 'lucide-react';
import type { AuditDimension, AgentAuditResult } from '@/lib/types';

interface ScoreCardProps {
  totalScore: number;
  dimensions: AuditDimension[];
  badge: 'excellent' | 'good' | 'needs-improvement' | 'critical';
  agentAudits?: AgentAuditResult[];
  cta?: React.ReactNode;
}

function cleanReason(reason: string): string {
  return reason.replace(/\s+\d+x\b/g, '').trim();
}

const badgeConfig = {
  excellent: { label: 'Excellent', variant: 'default' as const, color: 'var(--score-excellent)' },
  good: { label: 'Good', variant: 'secondary' as const, color: 'var(--score-good)' },
  'needs-improvement': { label: 'Needs Improvement', variant: 'outline' as const, color: 'var(--score-warning)' },
  critical: { label: 'Critical', variant: 'destructive' as const, color: 'var(--score-critical)' },
};

function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--score-excellent)';
  if (score >= 60) return 'var(--score-good)';
  if (score >= 30) return 'var(--score-warning)';
  return 'var(--score-critical)';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'var(--score-excellent-bg)';
  if (score >= 60) return 'var(--score-good-bg)';
  if (score >= 30) return 'var(--score-warning-bg)';
  return 'var(--score-critical-bg)';
}

export default function ScoreCard({ totalScore, dimensions, badge, agentAudits, cta }: ScoreCardProps) {
  const config = badgeConfig[badge];

  const allFirstSuggestions = dimensions
    .map((d) => d.suggestions?.[0])
    .filter(Boolean) as string[];
  const uniqueFirstSuggestions = [...new Set(allFirstSuggestions)];
  const hasGlobalSuggestion =
    uniqueFirstSuggestions.length === 1 && allFirstSuggestions.length === dimensions.length;
  const globalSuggestion = hasGlobalSuggestion ? uniqueFirstSuggestions[0] : null;

  return (
    <Card className="transition-default hover:shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Audit Score</CardTitle>
        <Badge variant={config.variant} style={{ color: config.color }}>
          {config.label}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2 mb-6">
          <span className="text-5xl font-bold tracking-tight" style={{ color: config.color }}>
            {totalScore}
          </span>
          <span className="text-muted-foreground text-sm font-medium">/ 100</span>
        </div>

        {cta && <div className="mb-6">{cta}</div>}

        {agentAudits && agentAudits.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {agentAudits.map((audit) => {
              const pillColor = getScoreColor(audit.totalScore);
              const pillBg = getScoreBg(audit.totalScore);
              return (
                <span
                  key={audit.agentType}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ color: pillColor, backgroundColor: pillBg }}
                >
                  {audit.agentName}
                  <span className="tabular-nums">{audit.totalScore}/100</span>
                </span>
              );
            })}
          </div>
        )}

        {globalSuggestion && (
          <div className="bg-muted/50 rounded p-3 text-sm flex items-start gap-2 mb-4">
            <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <span>{globalSuggestion}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {dimensions.map((dim, index) => {
            const pct = (dim.score / dim.maxScore) * 100;
            const color = getScoreColor(pct);
            const hasUniqueSuggestions =
              dim.suggestions &&
              dim.suggestions.length > 0 &&
              (!globalSuggestion || dim.suggestions.some((s, i) => i > 0 || s !== globalSuggestion));
            return (
              <div key={dim.name}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">{dim.name}</span>
                  <span className="text-muted-foreground font-medium tabular-nums">
                    {dim.score}/{dim.maxScore}
                  </span>
                </div>
                <Progress
                  value={pct}
                  className="h-2"
                  indicatorClassName={`transition-all duration-500 bg-[${color}]`}
                />
                {dim.reason && (
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    {cleanReason(dim.reason)}
                  </p>
                )}
                {hasUniqueSuggestions && (
                  <ul className="mt-1.5 space-y-0.5">
                    {dim.suggestions
                      ?.filter((s, i) => !globalSuggestion || i > 0 || s !== globalSuggestion)
                      .map((suggestion, si) => (
                        <li
                          key={si}
                          className="flex items-start gap-1.5 text-xs text-muted-foreground/80 leading-relaxed"
                        >
                          <span className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400">
                            →
                          </span>
                          <span>{suggestion}</span>
                        </li>
                      ))}
                  </ul>
                )}
                {index < dimensions.length - 1 && <Separator className="mt-4" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
