'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import FolderPicker from '@/components/FolderPicker';
import ScoreCard from '@/components/ScoreCard';
import FilePreview from '@/components/FilePreview';
import ExportButton from '@/components/ExportButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileUp, Loader2, FolderGit, Files, BarChart3, Check, ScrollText, FileText, Sparkles, GitCommitHorizontal, Brain } from 'lucide-react';
import ChangeSummary from '@/components/ChangeSummary';
import BrainPanel from '@/components/BrainPanel';
import type { Scan, Project, GeneratedFile, AgentType } from '@/lib/types';
import { AGENT_DISPLAY_NAMES, AGENT_FILE_MAP } from '@/lib/types';

export default function ScanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [applyResult, setApplyResult] = useState<{ written: string[] } | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [activeResultTab, setActiveResultTab] = useState('audit');
  const [selectedAgents, setSelectedAgents] = useState<AgentType[]>(['claude']);

  const handleScan = async (folderPath: string) => {
    setLoading(true);
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
        toast.error(data.error ?? 'Scan failed');
        return;
      }

      setScan(data.data.scan);
      setProject(data.data.project);
      toast.success('Scan complete', {
        description: `Scanned ${data.data.scan.snapshot.fileCount} files`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const toggleAgent = (agent: AgentType) => {
    setSelectedAgents((prev) => {
      if (prev.includes(agent)) {
        // Don't allow deselecting the last one
        if (prev.length === 1) return prev;
        return prev.filter((a) => a !== agent);
      }
      return [...prev, agent];
    });
  };

  const handleGenerate = async () => {
    if (!scan) return;
    setGenerating(true);
    const loadingToast = toast.loading('Generating context pack...');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId: scan.id, agents: selectedAgents }),
      });
      const data = await res.json();

      if (!data.ok) {
        toast.dismiss(loadingToast);
        toast.error(data.error ?? 'Generation failed');
        return;
      }

      setFiles(data.data.files);
      setActiveResultTab('files');
      toast.dismiss(loadingToast);
      toast.success('Generation complete', {
        description: `${data.data.files.length} files generated`,
      });
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error(err instanceof Error ? err.message : 'Network error');
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
      toast.success('Applied to repo', {
        description: `Written ${data.data.written.length} file${data.data.written.length !== 1 ? 's' : ''}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  const handleFixEverything = async () => {
    if (!scan) return;
    setFixing(true);
    setApplyResult(null);
    const loadingToast = toast.loading('Fixing everything...');
    try {
      const res = await fetch('/api/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId: scan.id, agents: selectedAgents }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setFiles(data.data.files ?? []);
      setApplyResult(data.data);
      setActiveResultTab('files');
      toast.dismiss(loadingToast);
      toast.success('Fix complete', {
        description: `Written ${data.data.written.length} file${data.data.written.length !== 1 ? 's' : ''}`,
      });
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error(err instanceof Error ? err.message : 'Fix failed');
    } finally {
      setFixing(false);
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
        <div className="space-y-4">
          <Card>
            <CardContent className="py-8">
              <div className="flex items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">Scanning repository...</span>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardContent className="py-8 space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent></Card>
            <Card><CardContent className="py-8 space-y-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </CardContent></Card>
          </div>
        </div>
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
          <TabsList variant="line" className="flex-wrap h-auto gap-1">
            <TabsTrigger value="audit" className="gap-1.5 px-2 py-1 text-xs sm:text-sm">
              <ScrollText className="h-4 w-4" />
              Audit Results
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-1.5 px-2 py-1 text-xs sm:text-sm">
              <FileText className="h-4 w-4" />
              Generated Files
            </TabsTrigger>
            <TabsTrigger value="changes" className="gap-1.5 px-2 py-1 text-xs sm:text-sm">
              <GitCommitHorizontal className="h-4 w-4" />
              Changes
            </TabsTrigger>
            <TabsTrigger value="brain" className="gap-1.5 px-2 py-1 text-xs sm:text-sm">
              <Brain className="h-4 w-4" />
              Brain
            </TabsTrigger>
          </TabsList>

          <TabsContent value="audit" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <ScoreCard
                totalScore={scan.audit.totalScore}
                dimensions={scan.audit.dimensions}
                badge={scan.audit.badge}
                agentAudits={scan.audit.agentAudits}
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

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(AGENT_DISPLAY_NAMES) as AgentType[]).map((agent) => {
                  const isSelected = selectedAgents.includes(agent);
                  const fileCount = AGENT_FILE_MAP[agent].length;
                  return (
                    <button
                      key={agent}
                      type="button"
                      onClick={() => toggleAgent(agent)}
                      disabled={generating}
                      className={`
                        inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium
                        transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                        ${isSelected
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          agent === 'claude' ? 'bg-sky-400'
                          : agent === 'cursor' ? 'bg-emerald-400'
                          : agent === 'windsurf' ? 'bg-amber-400'
                          : agent === 'gemini' ? 'bg-violet-400'
                          : agent === 'opencode' ? 'bg-rose-400'
                          : 'bg-cyan-400'
                        }`}
                      />
                      <span>{AGENT_DISPLAY_NAMES[agent]}</span>
                      <span className={`text-xs ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground/70'}`}>
                        {fileCount} file{fileCount !== 1 ? 's' : ''}
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleGenerate} disabled={generating || fixing}>
                  {generating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                  ) : (
                    <><Download className="h-4 w-4 mr-2" />Generate Context Pack</>
                  )}
                </Button>
                <Button onClick={handleFixEverything} disabled={fixing || generating} variant="default" className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
                  {fixing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Fixing...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" />Fix Everything</>
                  )}
                </Button>
              {files.length > 0 && (
                <>
                  <ExportButton scanId={scan.id} />
                  <Button onClick={handleApply} disabled={applying || fixing} variant="outline">
                    {applying ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Applying...</>
                    ) : (
                      <><FileUp className="h-4 w-4 mr-2" />Apply to Repo</>
                    )}
                  </Button>
                </>
              )}
              </div>
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

          <TabsContent value="changes" className="space-y-4 mt-4">
            <ChangeSummary folderPath={scan.snapshot.folderPath} />
          </TabsContent>

          <TabsContent value="brain" className="space-y-4 mt-4">
            <BrainPanel folderPath={scan.snapshot.folderPath} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
