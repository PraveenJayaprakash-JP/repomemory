import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface RepoMemoryStore {
  version: number;
  projects: {
    id: string;
    folderPath: string;
    repoName: string;
    language: string;
    framework: string;
    lastScore: number | null;
    lastScanAt: string | null;
    createdAt: string;
  }[];
  scans: {
    id: string;
    projectId: string;
    createdAt: string;
    audit: {
      totalScore: number;
      badge: string;
      summary: string;
      dimensions: { name: string; score: number; maxScore: number; reason: string }[];
    };
    snapshot: {
      repoName: string;
      language: string;
      framework: string;
      fileCount: number;
      totalSizeBytes: number;
      topFiles: string[];
      noisyDirs: string[];
    };
  }[];
}

function getStorePath(): string {
  const home = os.homedir();
  // Try multiple locations
  const candidates = [
    path.join(process.cwd(), '.repomemory', 'store.json'),
    path.join(home, '.repomemory', 'store.json'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0]; // default to cwd
}

export function loadStore(): RepoMemoryStore | null {
  try {
    const storePath = getStorePath();
    if (!fs.existsSync(storePath)) return null;
    const raw = fs.readFileSync(storePath, 'utf-8');
    return JSON.parse(raw) as RepoMemoryStore;
  } catch {
    return null;
  }
}

export function getScannedProjects() {
  const store = loadStore();
  if (!store) return [];
  return store.projects.map((p) => {
    const latestScan = store.scans
      .filter((s) => s.projectId === p.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    return {
      ...p,
      latestScanId: latestScan?.id ?? null,
      latestScore: latestScan?.audit.totalScore ?? p.lastScore,
      latestBadge: latestScan?.audit.badge ?? 'unknown',
    };
  });
}

export function getScanById(id: string) {
  const store = loadStore();
  if (!store) return null;
  return store.scans.find((s) => s.id === id) ?? null;
}
