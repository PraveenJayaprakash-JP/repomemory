'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ScoreCard from '@/components/ScoreCard';
import FilePreview from '@/components/FilePreview';
import DriftAlert from '@/components/DriftAlert';
import ExportButton from '@/components/ExportButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, FolderGit, Files, BarChart3, Calendar, Loader2, Download } from 'lucide-react';
import type { Scan, GeneratedFile } from '@/lib/types';

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

  useEffect(() => {
    async function loadScan() {
      try {
        const res = await fetch(`/api/scan/${params.id}`);
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Scan not found');
        setScan(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    if (params.id) loadScan();
  }, [params.id]);

  const handleGenerate = async () => {
    if (!scan) return;
    setGenerating(true);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="files">Generated Files</TabsTrigger>
          <TabsTrigger value="snapshot">Snapshot</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ScoreCard
              totalScore={scan.audit.totalScore}
              dimensions={scan.audit.dimensions}
              badge={scan.audit.badge}
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

        <TabsContent value="files" className="space-y-4 mt-4">
          <FilePreview files={files.length > 0 ? files : scan.generatedFiles} />
          {(files.length > 0 || scan.generatedFiles.length > 0) && (
            <ExportButton scanId={scan.id} />
          )}
        </TabsContent>

        <TabsContent value="snapshot" className="space-y-4 mt-4">
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
      </Tabs>
    </div>
  );
}
