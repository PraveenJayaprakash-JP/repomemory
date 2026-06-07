'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Scan, History, ArrowRight, FolderGit, BarChart3 } from 'lucide-react';

interface EnrichedProject {
  id: string;
  repoName: string;
  folderPath: string;
  language: string;
  framework: string;
  lastScore: number | null;
  lastScanAt: string | null;
  scanCount: number;
  latestScanId: string | null;
}

const badgeForScore = (score: number | null) => {
  if (score === null) return { label: 'Not scored', variant: 'outline' as const };
  if (score >= 80) return { label: 'Excellent', variant: 'default' as const };
  if (score >= 60) return { label: 'Good', variant: 'secondary' as const };
  if (score >= 30) return { label: 'Needs work', variant: 'outline' as const };
  return { label: 'Critical', variant: 'destructive' as const };
};

function ProjectSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-32 bg-muted rounded animate-pulse" />
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
          <div className="flex items-center gap-3 pt-1">
            <div className="h-5 w-16 bg-muted rounded animate-pulse" />
            <div className="h-3 w-12 bg-muted rounded animate-pulse" />
            <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="h-4 w-4 bg-muted rounded animate-pulse shrink-0 ml-4" />
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [projects, setProjects] = useState<EnrichedProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) setProjects(res.data ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scan history and project intelligence overview
          </p>
        </div>
        <Link href="/scan">
          <Button>
            <Scan className="h-4 w-4 mr-2" />
            New Scan
          </Button>
        </Link>
      </div>

      {loading && (
        <div className="grid gap-3">
          <ProjectSkeleton />
          <ProjectSkeleton />
          <ProjectSkeleton />
        </div>
      )}

      {!loading && projects.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
              <History className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No scans yet</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Scan your first repository to generate AI context files and track project intelligence.
            </p>
            <Link href="/scan">
              <Button>
                <Scan className="h-4 w-4 mr-2" />
                Scan a Repo
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {!loading && projects.length > 0 && (
        <div className="grid gap-3">
          {projects.map((p) => {
            const badge = badgeForScore(p.lastScore);
            return (
              <Link key={p.id} href={`/audit/${p.latestScanId}`} className="group">
                <Card className="transition-default hover:shadow-md hover:border-border/80 cursor-pointer">
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FolderGit className="h-4 w-4 text-muted-foreground shrink-0" />
                        <h3 className="font-semibold truncate">{p.repoName}</h3>
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({p.language}{p.framework !== 'None' && p.framework !== 'Unknown' ? `, ${p.framework}` : ''})
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate font-mono">
                        {p.folderPath}
                      </p>
                      <div className="flex items-center gap-3 mt-2.5">
                        <Badge variant={badge.variant} className="text-xs">
                          {badge.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {p.scanCount} scan{p.scanCount !== 1 ? 's' : ''}
                        </span>
                        {p.lastScanAt && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(p.lastScanAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 ml-4 transition-default group-hover:text-foreground group-hover:translate-x-0.5" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
