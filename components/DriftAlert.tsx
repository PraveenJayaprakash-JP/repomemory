'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, FileDiff, GitCommitHorizontal } from 'lucide-react';
import type { DriftEvent } from '@/lib/types';

interface DriftAlertProps {
  events: DriftEvent[];
}

export default function DriftAlert({ events }: DriftAlertProps) {
  const unresolved = events.filter((e) => !e.resolved);

  if (unresolved.length === 0) return null;

  return (
    <Card className="border-[var(--drift-border)] bg-[var(--drift-bg)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-[var(--score-warning)] shrink-0" />
          <CardTitle className="text-lg">Drift Detected</CardTitle>
          <Badge variant="outline" className="ml-auto text-xs border-[var(--drift-border)] text-[var(--score-warning)]">
            {unresolved.length} alert{unresolved.length > 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {unresolved.map((event, eventIndex) => (
            <div key={event.id}>
              <div className="flex items-center gap-2 mb-3">
                <GitCommitHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Detected {new Date(event.detectedAt).toLocaleString()}
                </p>
              </div>
              
              {event.staleContextFiles.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FileDiff className="h-4 w-4 text-muted-foreground" />
                    Stale context files
                  </p>
                  <ul className="space-y-1">
                    {event.staleContextFiles.map((f) => (
                      <li
                        key={f}
                        className="text-sm text-muted-foreground pl-6 relative before:content-['•'] before:absolute before:left-2 before:text-[var(--score-warning)]"
                      >
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {event.changedFiles.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FileDiff className="h-4 w-4 text-muted-foreground" />
                    Changed files
                  </p>
                  <div className="max-h-32 overflow-y-auto rounded-md border bg-background/50 p-2 space-y-1">
                    {event.changedFiles.slice(0, 10).map((f) => (
                      <div key={f.path} className="text-xs flex items-center gap-2 font-mono">
                        <span
                          className="shrink-0 w-4 text-center font-bold"
                          style={{
                            color: f.change === 'added' ? 'var(--score-excellent)' :
                                   f.change === 'deleted' ? 'var(--score-critical)' :
                                   'var(--score-warning)'
                          }}
                        >
                          {f.change === 'added' ? '+' : f.change === 'deleted' ? '-' : '~'}
                        </span>
                        <span className="text-muted-foreground truncate">{f.path}</span>
                      </div>
                    ))}
                    {event.changedFiles.length > 10 && (
                      <p className="text-xs text-muted-foreground pt-1 border-t">
                        ...and {event.changedFiles.length - 10} more
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {eventIndex < unresolved.length - 1 && <Separator className="mt-4" />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
