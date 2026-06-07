// RepoMemory — Drift detection between repo scans

import type { ProjectSnapshot, DriftEvent } from './types';
import { generateId } from './storage';

// ---------------------------------------------------------------------------
// Smart regeneration — detect which sections need updating
// ---------------------------------------------------------------------------

export interface ContextChange {
  section: string;           // e.g. "Commands", "Architecture", "Off-limits"
  reason: string;            // e.g. "New dependency added: zod"
  affectedFiles: string[];   // e.g. ["CLAUDE.md", "AGENTS.md"]
  priority: 'high' | 'medium' | 'low';
}

/** Compare two snapshots and determine which context sections need updating */
export function detectContextChanges(
  current: ProjectSnapshot,
  previous: ProjectSnapshot
): ContextChange[] {
  const changes: ContextChange[] = [];

  // --- Package scripts changed → Commands section ---
  const currScripts = (current.keyFiles.packageJson as Record<string, Record<string, string>> | null)?.scripts ?? null;
  const prevScripts = (previous.keyFiles.packageJson as Record<string, Record<string, string>> | null)?.scripts ?? null;
  if (JSON.stringify(currScripts) !== JSON.stringify(prevScripts)) {
    changes.push({
      section: 'Commands',
      reason: 'Package scripts changed',
      affectedFiles: ['CLAUDE.md', 'GEMINI.md', 'AIDER.md', '.cursor/context.md', '.windsurf/context.md', '.opencode/instructions.md'],
      priority: 'high',
    });
  }

  // --- Dependencies changed → Architecture + Commands ---
  const pkgCurr = current.keyFiles.packageJson as Record<string, unknown> | null;
  const pkgPrev = previous.keyFiles.packageJson as Record<string, unknown> | null;
  const currDeps = (pkgCurr?.dependencies ?? {}) as Record<string, string>;
  const prevDeps = (pkgPrev?.dependencies ?? {}) as Record<string, string>;
  const currDevDeps = (pkgCurr?.devDependencies ?? {}) as Record<string, string>;
  const prevDevDeps = (pkgPrev?.devDependencies ?? {}) as Record<string, string>;

  const newDeps = findNewKeys(currDeps, prevDeps);
  const newDevDeps = findNewKeys(currDevDeps, prevDevDeps);

  if (newDeps.length > 0 || newDevDeps.length > 0) {
    const added = [...newDeps, ...newDevDeps].join(', ');
    changes.push({
      section: 'Architecture',
      reason: `New dependency added: ${added}`,
      affectedFiles: ['CLAUDE.md', 'GEMINI.md', 'AIDER.md', '.cursor/context.md', '.windsurf/context.md', '.opencode/instructions.md'],
      priority: 'high',
    });
    // Commands also affected if deps changed (install/build may differ)
    if (!changes.some(c => c.section === 'Commands')) {
      changes.push({
        section: 'Commands',
        reason: `Dependencies changed — install/build commands may differ`,
        affectedFiles: ['CLAUDE.md', 'GEMINI.md', 'AIDER.md', '.opencode/instructions.md'],
        priority: 'medium',
      });
    }
  }

  // --- New top-level directories → Architecture ---
  const currTopDirs = getTopLevelDirs(current.fileTreeHashes.map(f => f.path));
  const prevTopDirs = getTopLevelDirs(previous.fileTreeHashes.map(f => f.path));
  const addedDirs = currTopDirs.filter(d => !prevTopDirs.includes(d));
  if (addedDirs.length > 0) {
    changes.push({
      section: 'Architecture',
      reason: `New top-level directories: ${addedDirs.join(', ')}`,
      affectedFiles: ['CLAUDE.md', 'GEMINI.md', 'AIDER.md', '.cursor/context.md', '.windsurf/context.md', '.opencode/instructions.md'],
      priority: 'medium',
    });
  }

  // --- Noisy dirs changed → Off-limits + .claudeignore ---
  const addedNoisy = current.noisyDirs.filter(d => !previous.noisyDirs.includes(d));
  const removedNoisy = previous.noisyDirs.filter(d => !current.noisyDirs.includes(d));
  if (addedNoisy.length > 0 || removedNoisy.length > 0) {
    const detail = addedNoisy.length > 0
      ? `Added noisy dirs: ${addedNoisy.join(', ')}`
      : `Removed noisy dirs: ${removedNoisy.join(', ')}`;
    changes.push({
      section: 'Off-limits',
      reason: detail,
      affectedFiles: ['CLAUDE.md', '.claudeignore', 'GEMINI.md', 'AIDER.md', '.cursor/rules.mdc', '.windsurf/rules.md'],
      priority: 'medium',
    });
  }

  // --- Language/framework changed → Architecture ---
  if (current.language !== previous.language || current.framework !== previous.framework) {
    const detail: string[] = [];
    if (current.language !== previous.language) detail.push(`Language: ${previous.language} → ${current.language}`);
    if (current.framework !== previous.framework) detail.push(`Framework: ${previous.framework} → ${current.framework}`);
    changes.push({
      section: 'Architecture',
      reason: detail.join('; '),
      affectedFiles: ['CLAUDE.md', 'GEMINI.md', 'AIDER.md', '.cursor/context.md', '.windsurf/context.md', '.opencode/instructions.md', '.aider.conf.yml'],
      priority: 'high',
    });
  }

  return changes;
}

/** Find keys present in `curr` but not in `prev` */
function findNewKeys(
  curr: Record<string, string>,
  prev: Record<string, string>
): string[] {
  return Object.keys(curr).filter(k => !(k in prev));
}

/** Extract unique top-level directory names from file paths */
function getTopLevelDirs(paths: string[]): string[] {
  const dirs = new Set<string>();
  for (const p of paths) {
    const parts = p.split('/');
    if (parts.length > 1) {
      dirs.add(parts[0]);
    }
  }
  return [...dirs].sort();
}

// ---------------------------------------------------------------------------
// Drift check — detect stale context files
// ---------------------------------------------------------------------------

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
