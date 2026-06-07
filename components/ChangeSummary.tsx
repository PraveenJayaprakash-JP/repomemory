'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GitCommitHorizontal, Loader2, Sparkles, AlertCircle } from 'lucide-react';

interface CommitEntry {
  hash: string;
  message: string;
  author: string;
  date: string;
}

interface ChangeSummaryData {
  recentCommits: CommitEntry[];
  aiSummary: string | null;
  generatedAt: string;
}

interface ChangeSummaryProps {
  folderPath: string;
}

export default function ChangeSummary({ folderPath }: ChangeSummaryProps) {
  const [data, setData] = useState<ChangeSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ folderPath });
      const res = await fetch(`/api/changelog?${params}`);
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? 'Failed to load changelog');
        return;
      }
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  // Initial state — show load button
  if (!data && !loading && !error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GitCommitHorizontal className="h-5 w-5 text-muted-foreground" />
            Recent Changes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Load recent git commits and generate an AI summary of what changed.
          </p>
          <Button onClick={handleLoad} variant="outline">
            <GitCommitHorizontal className="h-4 w-4 mr-2" />
            Load Recent Changes
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            Loading Changes...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Error Loading Changes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={handleLoad} variant="outline" className="mt-3" size="sm">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Empty state — not a git repo or no commits
  if (data && data.recentCommits.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GitCommitHorizontal className="h-5 w-5 text-muted-foreground" />
            Recent Changes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No git history found. This folder may not be a git repository.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Data state
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <GitCommitHorizontal className="h-5 w-5 text-muted-foreground" />
          Recent Changes
          <Badge variant="secondary" className="text-xs ml-1">
            {data!.recentCommits.length} commits
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Summary */}
        {data!.aiSummary && (
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">AI Summary</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {data!.aiSummary}
            </p>
          </div>
        )}

        {/* Commit list */}
        <div className="space-y-2">
          {data!.recentCommits.map((commit) => (
            <div
              key={commit.hash}
              className="flex items-start gap-3 py-2 border-b last:border-b-0"
            >
              <code className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                {commit.hash}
              </code>
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{commit.message}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {commit.author} · {commit.date}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            Generated {new Date(data!.generatedAt).toLocaleString()}
          </p>
          <Button onClick={handleLoad} variant="ghost" size="sm">
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}