'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ScoreCard from '@/components/ScoreCard';
import FilePreview from '@/components/FilePreview';
import DriftAlert from '@/components/DriftAlert';
import ExportButton from '@/components/ExportButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import BadgeSnippet from '@/components/BadgeSnippet';
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, FolderGit, Files, BarChart3, Calendar, Loader2, Download, GitCompare, Shield, Network, ScrollText, FileText, ShieldCheck, Camera, Expand } from 'lucide-react';
import type { Scan, GeneratedFile } from '@/lib/types';
import { buildArchitectureGraph, getGraphSummary } from '@/lib/graph';
import ArchGraph from '@/components/ArchGraph';

function AuditSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-9 w-9 bg-muted rounded-md animate-pulse" />
        <div className="space-y-2">
          <div className="h-7 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="py-4"><div className="h-4 w-full bg-muted rounded animate-pulse" /></CardContent></Card>
        <Card><CardContent className="py-4"><div className="h-4 w-full bg-muted rounded animate-pulse" /></CardContent></Card>
        <Card><CardContent className="py-4"><div className="h-4 w-full bg-muted rounded animate-pulse" /></CardContent></Card>
      </div>
      <div className="h-8 w-64 bg-muted rounded animate-pulse" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="py-8"><div className="h-4 w-full bg-muted rounded animate-pulse" /></CardContent></Card>
        <Card><CardContent className="py-8"><div className="h-4 w-full bg-muted rounded animate-pulse" /></CardContent></Card>
      </div>
    </div>
  );
}

export default function AuditPage() {
  const params = useParams();
  const router = useRouter();
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [activeTab, setActiveTab] = useState('audit');
  const [error, setError] = useState('');
  const [previousScanId, setPreviousScanId] = useState<string | null>(null);
  const [fullViewGraph, setFullViewGraph] = useState(false);

  useEffect(() => {
    async function loadScan() {
      try {
        const res = await fetch(`/api/scan/${params.id}`);
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Scan not found');
        setScan(data.data);

        // Find previous scan for comparison
        try {
          const scansRes = await fetch(`/api/scans?projectId=${encodeURIComponent(data.data.projectId)}`);
          const scansData = await scansRes.json();
          if (scansData.ok) {
            const scansList: { id: string; createdAt: string }[] = scansData.data.scans;
            const currentIdx = scansList.findIndex((s: { id: string }) => s.id === data.data.id);
            if (currentIdx > 0) {
              setPreviousScanId(scansList[currentIdx - 1].id);
            }
          }
        } catch {
          // Non-critical: comparison button just won't appear
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }
    if (params.id) loadScan();
  }, [params.id]);

  const handleGenerate = async () => {
    if (!scan) return;
    setGenerating(true);
    const loadingToast = toast.loading('Generating context pack...');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId: scan.id }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setFiles(data.data.files);
      setActiveTab('files');
      toast.dismiss(loadingToast);
      toast.success('Generation complete', {
        description: `${data.data.files.length} files generated`,
      });
    } catch (err) {
      toast.dismiss(loadingToast);
      const message = err instanceof Error ? err.message : 'Generation failed';
      setError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <AuditSkeleton />;
  }

  if (error && !scan) {
    return (
      <div className="py-12 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--error-bg)] mb-4">
          <BarChart3 className="h-6 w-6 text-[var(--score-critical)]" />
        </div>
        <p className="text-sm font-medium text-[var(--score-critical)] mb-4">{error}</p>
        <Button variant="outline" onClick={() => router.push('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (!scan) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{scan.snapshot.repoName}</h1>
          <p className="text-sm text-muted-foreground font-mono truncate">
            {scan.snapshot.folderPath}
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto shrink-0">{scan.snapshot.language}</Badge>
        {previousScanId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/compare?scanId1=${previousScanId}&scanId2=${scan.id}`)}
            className="shrink-0"
          >
            <GitCompare className="h-4 w-4 mr-2" />
            Compare with previous
          </Button>
        )}
      </div>

      <DriftAlert events={scan.driftEvents} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="transition-default hover:shadow-sm">
          <CardContent className="py-4 flex items-center gap-3">
            <Files className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Files</span>
              <span className="font-medium">{scan.snapshot.fileCount}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-default hover:shadow-sm">
          <CardContent className="py-4 flex items-center gap-3">
            <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Size</span>
              <span className="font-medium">{(scan.snapshot.totalSizeBytes / 1024 / 1024).toFixed(1)} MB</span>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-default hover:shadow-sm">
          <CardContent className="py-4 flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Scanned</span>
              <span className="font-medium">{new Date(scan.createdAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="mb-2" />
      <Separator />

      <div className="flex flex-col md:flex-row gap-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col md:flex-row gap-6 w-full" orientation="vertical">
          <TabsList className="flex-row md:flex-col w-full md:w-44 shrink-0 h-auto md:h-fit gap-1 bg-transparent">
          <TabsTrigger value="audit" className="flex-1 md:w-full justify-center md:justify-start gap-2 px-3 py-2 text-sm data-[active]:bg-accent data-[active]:text-foreground rounded-md">
            <ScrollText className="h-4 w-4" />
            Audit
          </TabsTrigger>
          <TabsTrigger value="files" className="flex-1 md:w-full justify-center md:justify-start gap-2 px-3 py-2 text-sm data-[active]:bg-accent data-[active]:text-foreground rounded-md">
            <FileText className="h-4 w-4" />
            Generated Files
          </TabsTrigger>
          <TabsTrigger value="badge" className="flex-1 md:w-full justify-center md:justify-start gap-2 px-3 py-2 text-sm data-[active]:bg-accent data-[active]:text-foreground rounded-md">
            <ShieldCheck className="h-4 w-4" />
            Badge
          </TabsTrigger>
          <TabsTrigger value="snapshot" className="flex-1 md:w-full justify-center md:justify-start gap-2 px-3 py-2 text-sm data-[active]:bg-accent data-[active]:text-foreground rounded-md">
            <Camera className="h-4 w-4" />
            Snapshot
          </TabsTrigger>
          <TabsTrigger value="architecture" className="flex-1 md:w-full justify-center md:justify-start gap-2 px-3 py-2 text-sm data-[active]:bg-accent data-[active]:text-foreground rounded-md">
            <Network className="h-4 w-4" />
            Architecture
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-w-0">
          <TabsContent value="audit" className="space-y-4 mt-0">
          <div className="grid gap-4 md:grid-cols-2">
            <ScoreCard
              totalScore={scan.audit.totalScore}
              dimensions={scan.audit.dimensions}
              badge={scan.audit.badge}
              cta={
                <Button onClick={handleGenerate} disabled={generating} size="sm">
                  {generating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                  ) : (
                    <><Download className="h-4 w-4 mr-2" />Generate Context Pack</>
                  )}
                </Button>
              }
            />
            <Card className="transition-default hover:shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {scan.audit.summary}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
              ) : (
                <><Download className="h-4 w-4 mr-2" />Generate Context Pack</>
              )}
            </Button>
            {files.length > 0 && <ExportButton scanId={scan.id} />}
          </div>
        </TabsContent>

        <TabsContent value="files" className="space-y-4 mt-0">
          <FilePreview files={files.length > 0 ? files : scan.generatedFiles} />
          {(files.length > 0 || scan.generatedFiles.length > 0) && (
            <ExportButton scanId={scan.id} />
          )}
        </TabsContent>

        <TabsContent value="badge" className="space-y-4 mt-0">
          <BadgeSnippet projectId={scan.projectId} score={scan.audit.totalScore} />
        </TabsContent>

        <TabsContent value="snapshot" className="space-y-4 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Repo Snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-xs leading-relaxed">
                <code>{JSON.stringify(scan.snapshot, null, 2)}</code>
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="architecture" className="space-y-4 mt-0">
          {(() => {
            const graph = buildArchitectureGraph(scan.snapshot);
            const summary = getGraphSummary(scan.snapshot);
            return (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <Card className="flex-1 min-w-[200px]">
                    <CardContent className="py-3 flex items-center gap-3">
                      <Network className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="text-sm">
                        <span className="text-muted-foreground">Modules </span>
                        <span className="font-medium">{summary.moduleCount}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="flex-1 min-w-[200px]">
                    <CardContent className="py-3 flex items-center gap-3">
                      <FolderGit className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="text-sm">
                        <span className="text-muted-foreground">Directories </span>
                        <span className="font-medium">{summary.dirCount}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="flex-1 min-w-[200px]">
                    <CardContent className="py-3 flex items-center gap-3">
                      <Files className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="text-sm">
                        <span className="text-muted-foreground">Files </span>
                        <span className="font-medium">{summary.fileCount}</span>
                      </div>
                    </CardContent>
                  </Card>
                  {summary.databases.length > 0 && (
                    <Card className="flex-1 min-w-[200px]">
                      <CardContent className="py-3 flex items-center gap-3">
                        <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="text-sm">
                          <span className="text-muted-foreground">Databases </span>
                          <span className="font-medium">{summary.databases.join(', ')}</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {summary.moduleCount} modules detected across {summary.dirCount} directories
                  {summary.framework !== 'Unknown' && summary.framework !== 'None'
                    ? ` · Framework: ${summary.framework}`
                    : ''}
                  {summary.databases.length > 0
                    ? ` · DB: ${summary.databases.join(', ')}`
                    : ''}
                  {summary.testingTools.length > 0
                    ? ` · Testing: ${summary.testingTools.join(', ')}`
                    : ''}
                  .
                </p>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Dependency Map</CardTitle>
                    <Dialog open={fullViewGraph} onOpenChange={setFullViewGraph}>
                      <DialogTrigger className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-default">
                        <Expand className="h-4 w-4 mr-1.5" />
                        Full View
                      </DialogTrigger>
                      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col">
                        <DialogTitle className="text-lg">Dependency Map — Full View</DialogTitle>
                        <div className="flex-1 overflow-auto p-4 bg-muted/20 rounded-lg">
                          <ArchGraph graph={graph} />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    <ArchGraph graph={graph} />
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>
      </div>
        </Tabs>
      </div>
    </div>
  );
}
