'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FolderPicker from '@/components/FolderPicker';
import ScoreCard from '@/components/ScoreCard';
import FilePreview from '@/components/FilePreview';
import ExportButton from '@/components/ExportButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Download, FileUp, Loader2, FolderGit, Files, BarChart3 } from 'lucide-react';
import type { Scan, Project, GeneratedFile } from '@/lib/types';

export default function ScanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ written: string[] } | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [activeResultTab, setActiveResultTab] = useState('audit');

  const handleScan = async (folderPath: string) => {
    setLoading(true);
    setError('');
    setScan(null);
    setProject(null);
    setFiles([]);
    setApplyResult(null);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath }),
      });
      const data = await res.json();

      if (!data.ok) {
        setError(data.error ?? 'Scan failed');
        return;
      }

      setScan(data.data.scan);
      setProject(data.data.project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

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

      if (!data.ok) {
        setError(data.error ?? 'Generation failed');
        return;
      }

      setFiles(data.data.files);
      setActiveResultTab('files');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = async () => {
    if (!scan) return;
    setApplying(true);
    setApplyResult(null);
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId: scan.id }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setApplyResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scan a Repository</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the local path to any repository folder to audit its AI context setup.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <FolderPicker onScan={handleScan} loading={loading} />
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Scanning repository...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {error && !loading && (
        <Card className="border-[var(--error-border)] bg-[var(--error-bg)]">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-[var(--score-critical)]">{error}</p>
          </CardContent>
        </Card>
      )}

      {project && scan && (
        <Card className="transition-default hover:shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderGit className="h-5 w-5 text-muted-foreground" />
              {project.repoName}
              <Badge variant="secondary" className="text-xs">{project.language}</Badge>
              {project.framework !== 'None' && project.framework !== 'Unknown' && (
                <Badge variant="outline" className="text-xs">{project.framework}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Files className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Files</span>
                <span className="font-medium ml-auto">{scan.snapshot.fileCount}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Size</span>
                <span className="font-medium ml-auto">{(scan.snapshot.totalSizeBytes / 1024 / 1024).toFixed(1)} MB</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Score</span>
                <span className="font-medium ml-auto">{scan.audit.totalScore}/100</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {scan && (
        <Tabs value={activeResultTab} onValueChange={setActiveResultTab}>
          <TabsList>
            <TabsTrigger value="audit">Audit Results</TabsTrigger>
            <TabsTrigger value="files">Generated Files</TabsTrigger>
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
              {files.length > 0 && (
                <>
                  <ExportButton scanId={scan.id} />
                  <Button onClick={handleApply} disabled={applying} variant="outline">
                    {applying ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Applying...</>
                    ) : (
                      <><FileUp className="h-4 w-4 mr-2" />Apply to Repo</>
                    )}
                  </Button>
                </>
              )}
            </div>

            {applyResult && (
              <Card className="border-[var(--success-border)] bg-[var(--success-bg)]">
                <CardContent className="py-4">
                  <p className="text-sm font-medium text-[var(--score-excellent)] mb-2">Written to repo:</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                    {applyResult.written.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="files" className="space-y-4 mt-4">
            <FilePreview files={files} />
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <ExportButton scanId={scan.id} />
                <Button onClick={handleApply} disabled={applying} variant="outline">
                  {applying ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Applying...</>
                  ) : (
                    <><FileUp className="h-4 w-4 mr-2" />Apply to Repo</>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
