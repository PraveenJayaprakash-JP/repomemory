// RepoMemory — Drift detection between repo scans

import type { ProjectSnapshot, DriftEvent } from './types';
import { generateId } from './storage';

export interface DriftCheckResult {
  hasDrift: boolean;
  changedFiles: { path: string; change: 'modified' | 'added' | 'deleted' }[];
  staleContextFiles: string[];
}

/** Compare current snapshot against previous to detect drift */
export function checkDrift(
  current: ProjectSnapshot,
  previous: ProjectSnapshot
): DriftCheckResult {
  const changedFiles: DriftCheckResult['changedFiles'] = [];
  const staleContextFiles: string[] = [];

  // Build maps for comparison
  const prevHashMap = new Map(previous.fileTreeHashes.map(f => [f.path, f]));
  const currHashMap = new Map(current.fileTreeHashes.map(f => [f.path, f]));

  // Check for modified or deleted files
  for (const [path, prev] of prevHashMap) {
    const curr = currHashMap.get(path);
    if (!curr) {
      changedFiles.push({ path, change: 'deleted' });
    } else if (curr.hash !== prev.hash || curr.lastModified !== prev.lastModified) {
      changedFiles.push({ path, change: 'modified' });
    }
  }

  // Check for new files
  for (const [path] of currHashMap) {
    if (!prevHashMap.has(path)) {
      changedFiles.push({ path, change: 'added' });
    }
  }

  // Check if specific critical areas changed
  const criticalPatterns = [
    'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
    'Dockerfile', 'docker-compose', '.github/workflows',
    '.env.example', '.env.local', 'tsconfig.json', 'next.config',
    'pyproject.toml', 'Cargo.toml', 'go.mod', 'build.gradle',
  ];

  const criticalChanges = changedFiles.filter(f =>
    criticalPatterns.some(p => f.path.includes(p))
  );

  // Determine which context files are stale
  if (criticalChanges.length > 0) {
    // If package files changed → CLAUDE.md Commands section stale
    if (criticalChanges.some(f => f.path.includes('package.json') || f.path.includes('requirements') || f.path.includes('Cargo.toml'))) {
      staleContextFiles.push('CLAUDE.md (Commands section)');
    }
    // If Docker/CI changed → CLAUDE.md Deployment section stale
    if (criticalChanges.some(f => f.path.includes('Docker') || f.path.includes('github/workflows') || f.path.includes('docker-compose'))) {
      staleContextFiles.push('CLAUDE.md (Deployment section)');
    }
    // If config changed → .claudeignore may need update
    if (criticalChanges.some(f => f.path.includes('tsconfig') || f.path.includes('build'))) {
      staleContextFiles.push('.claudeignore');
    }
    // If .env.example changed → CLAUDE.md may reference wrong vars
    if (criticalChanges.some(f => f.path.includes('.env.example'))) {
      staleContextFiles.push('CLAUDE.md (Environment section)');
    }
  }

  return {
    hasDrift: staleContextFiles.length > 0,
    changedFiles,
    staleContextFiles,
  };
}

/** Create a DriftEvent from check results */
export function createDriftEvent(
  projectId: string,
  result: DriftCheckResult
): DriftEvent {
  return {
    id: generateId(),
    projectId,
    changedFiles: result.changedFiles,
    staleContextFiles: result.staleContextFiles,
    detectedAt: new Date().toISOString(),
    resolved: false,
  };
}
