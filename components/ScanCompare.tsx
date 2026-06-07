'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowUpRight, ArrowDownRight, Minus, Download } from 'lucide-react';
import ExportButton from '@/components/ExportButton';
import type { Scan } from '@/lib/types';

interface ScanCompareProps {
  scan1: Scan;
  scan2: Scan;
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

function ChangeIndicator({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--score-excellent)' }}>
        <ArrowUpRight className="h-4 w-4" />+{change}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--score-critical)' }}>
        <ArrowDownRight className="h-4 w-4" />{change}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
      <Minus className="h-4 w-4" />0
    </span>
  );
}

function ScanCard({ scan, label }: { scan: Scan; label: string }) {
  const config = badgeConfig[scan.audit.badge];
  return (
    <Card className="transition-default hover:shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
          <Badge variant={config.variant} style={{ color: config.color }}>
            {config.label}
          </Badge>
        </div>
        <CardTitle className="text-lg truncate">{scan.snapshot.repoName}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-4xl font-bold tracking-tight" style={{ color: getScoreColor(scan.audit.totalScore) }}>
            {scan.audit.totalScore}
          </span>
          <span className="text-muted-foreground text-sm font-medium">/ 100</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {new Date(scan.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </CardContent>
    </Card>
  );
}

export default function ScanCompare({ scan1, scan2 }: ScanCompareProps) {
  // scan1 = older, scan2 = newer
  const scoreChange = scan2.audit.totalScore - scan1.audit.totalScore;

  // Build dimension map for comparison
  const dimMap1 = new Map(scan1.audit.dimensions.map(d => [d.name, d]));
  const dimMap2 = new Map(scan2.audit.dimensions.map(d => [d.name, d]));
  const allDimNames = [...new Set([...dimMap1.keys(), ...dimMap2.keys()])];

  const improved: string[] = [];
  const regressed: string[] = [];

  const dimensionRows = allDimNames.map(name => {
    const d1 = dimMap1.get(name);
    const d2 = dimMap2.get(name);
    const s1 = d1?.score ?? 0;
    const s2 = d2?.score ?? 0;
    const max = d2?.maxScore ?? d1?.maxScore ?? 0;
    const change = s2 - s1;
    if (change > 0) improved.push(name);
    else if (change < 0) regressed.push(name);
    return { name, s1, s2, max, change };
  });

  return (
    <div className="space-y-6">
      {/* Side-by-side scan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScanCard scan={scan1} label="Earlier Scan" />
        <ScanCard scan={scan2} label="Later Scan" />
      </div>

      {/* Total score change */}
      <Card className="transition-default hover:shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Score Change</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold" style={{ color: getScoreColor(scan1.audit.totalScore) }}>
              {scan1.audit.totalScore}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="text-2xl font-bold" style={{ color: getScoreColor(scan2.audit.totalScore) }}>
              {scan2.audit.totalScore}
            </span>
            <ChangeIndicator change={scoreChange} />
          </div>
        </CardContent>
      </Card>

      {/* Dimension comparison table */}
      <Card className="transition-default hover:shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Dimension Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Dimension</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">Earlier</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">Later</th>
                  <th className="text-right py-2 pl-4 font-medium text-muted-foreground">Change</th>
                </tr>
              </thead>
              <tbody>
                {dimensionRows.map(row => (
                  <tr key={row.name} className="border-b last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{row.name}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      {row.s1}/{row.max}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      {row.s2}/{row.max}
                    </td>
                    <td className="py-2.5 pl-4 text-right">
                      <ChangeIndicator change={row.change} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Summary section */}
      <Card className="transition-default hover:shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {improved.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--score-excellent)' }}>
                Improved ({improved.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {improved.map(name => (
                  <Badge key={name} variant="secondary" className="text-xs">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {regressed.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--score-critical)' }}>
                Regressed ({regressed.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {regressed.map(name => (
                  <Badge key={name} variant="destructive" className="text-xs">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {improved.length === 0 && regressed.length === 0 && (
            <p className="text-sm text-muted-foreground">No changes between scans.</p>
          )}
        </CardContent>
      </Card>

      {/* Export for newer scan */}
      <div className="flex justify-end">
        <ExportButton scanId={scan2.id} />
      </div>
    </div>
  );
}