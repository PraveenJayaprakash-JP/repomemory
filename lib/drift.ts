// RepoMemory — Drift detection between repo scans

import { execSync } from 'child_process';
import type { ProjectSnapshot, DriftEvent, DriftRiskLevel, AdvancedDriftResult } from './types';
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
// Advanced drift check — git-aware analysis with risk scoring
// ---------------------------------------------------------------------------

/** In-memory timeline of drift events per project path */
const driftTimeline: Map<string, Array<{ timestamp: string; score: number; riskLevel: DriftRiskLevel }>> = new Map();

/** File patterns classified by risk level when changed */
const HIGH_RISK_PATTERNS = [
  'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
  'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  '.github/workflows', '.gitlab-ci.yml',
  'Cargo.toml', 'go.mod', 'pyproject.toml',
  'next.config', 'nuxt.config', 'vite.config', 'tsconfig.json',
];

const LOW_RISK_PATTERNS = [
  '.test.', '.spec.', '__tests__', '.stories.', '.storybook/',
  'README.md', 'CHANGELOG.md', 'LICENSE', '.mdx',
];

/** Classify a single file change into a risk level */
function classifyFileRisk(filePath: string): DriftRiskLevel {
  const normalized = filePath.replace(/\\/g, '/');
  if (HIGH_RISK_PATTERNS.some(p => normalized.includes(p))) return 'high';
  if (LOW_RISK_PATTERNS.some(p => normalized.includes(p))) return 'low';
  return 'medium';
}

/** Map a numeric drift score to a risk level */
function scoreToRiskLevel(score: number): DriftRiskLevel {
  if (score >= 80) return 'low';
  if (score >= 50) return 'medium';
  if (score >= 20) return 'high';
  return 'critical';
}

/** Safely run a git command, returning stdout or null on failure */
function gitCommand(cwd: string, args: string, timeoutMs: number = 5000): string | null {
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: 'utf-8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

/** Gather git insights for a repo folder */
function gatherGitInsights(folderPath: string): AdvancedDriftResult['gitInsights'] {
  const defaultInsights: AdvancedDriftResult['gitInsights'] = {
    recentCommits: 0,
    authors: [],
    hasUnpushed: false,
  };

  // Verify it's a git repo
  const isGitRepo = gitCommand(folderPath, 'rev-parse --is-inside-work-tree');
  if (isGitRepo !== 'true') return defaultInsights;

  // Recent commits count
  const logOutput = gitCommand(folderPath, 'log --oneline -20');
  const recentCommits = logOutput ? logOutput.split('\n').filter(Boolean).length : 0;

  // Unique authors in recent commits
  const authorOutput = gitCommand(folderPath, 'log --format="%aN" -20');
  const authors = authorOutput
    ? [...new Set(authorOutput.split('\n').filter(Boolean))]
    : [];

  // Check for unpushed commits
  const branchOutput = gitCommand(folderPath, 'rev-parse --abbrev-ref HEAD');
  let hasUnpushed = false;
  if (branchOutput) {
    const unpushedOutput = gitCommand(folderPath, `log --oneline origin/${branchOutput}..HEAD`);
    // If the command fails (no upstream), check if any local-only commits exist
    if (unpushedOutput === null) {
      // No remote tracking branch → assume unpushed
      hasUnpushed = true;
    } else {
      hasUnpushed = unpushedOutput.length > 0;
    }
  }

  return { recentCommits, authors, hasUnpushed };
}

/** Build repair suggestions based on drift findings */
function buildRepairSuggestions(
  changedFiles: AdvancedDriftResult['changedFiles'],
  staleContextFiles: AdvancedDriftResult['staleContextFiles'],
  gitInsights: AdvancedDriftResult['gitInsights'],
): string[] {
  const suggestions: string[] = [];

  if (staleContextFiles.length > 0) {
    suggestions.push('Run `repomemory generate . --apply` to update CLAUDE.md and other context files');
  }

  const highRiskFiles = changedFiles.filter(f => f.risk === 'high');
  if (highRiskFiles.length > 0) {
    const fileNames = highRiskFiles.map(f => f.path).join(', ');
    suggestions.push(`Review high-risk config changes: ${fileNames} — these affect build/deploy pipelines`);
  }

  const deletedFiles = changedFiles.filter(f => f.change === 'deleted');
  if (deletedFiles.length > 0) {
    suggestions.push('Deleted files detected — verify no stale imports reference removed modules');
  }

  if (gitInsights.hasUnpushed) {
    suggestions.push('Unpushed commits detected — push to remote before regenerating context to avoid stale references');
  }

  if (gitInsights.recentCommits > 10) {
    suggestions.push(`${gitInsights.recentCommits} recent commits — consider regenerating context to capture recent changes`);
  }

  if (suggestions.length === 0 && changedFiles.length > 0) {
    suggestions.push('Minor drift detected — context files may still be accurate but consider a refresh');
  }

  return suggestions;
}

/** Compute a drift score (0-100) based on file changes and context staleness */
function computeDriftScore(
  changedFiles: AdvancedDriftResult['changedFiles'],
  staleContextFiles: AdvancedDriftResult['staleContextFiles'],
  gitInsights: AdvancedDriftResult['gitInsights'],
): number {
  // Start at 100 (no drift) and subtract for issues
  let score = 100;

  // Deductions per changed file, weighted by risk
  for (const f of changedFiles) {
    switch (f.risk) {
      case 'critical': score -= 15; break;
      case 'high': score -= 10; break;
      case 'medium': score -= 5; break;
      case 'low': score -= 2; break;
    }
  }

  // Stale context files are a strong signal
  score -= staleContextFiles.length * 8;

  // Unpushed commits increase drift risk
  if (gitInsights.hasUnpushed) score -= 5;

  // High commit velocity increases drift likelihood
  if (gitInsights.recentCommits > 10) score -= 5;

  return Math.max(0, Math.min(100, score));
}

/** Build a human-readable summary */
function buildSummary(
  score: number,
  riskLevel: DriftRiskLevel,
  changedFiles: AdvancedDriftResult['changedFiles'],
  staleContextFiles: AdvancedDriftResult['staleContextFiles'],
  gitInsights: AdvancedDriftResult['gitInsights'],
): string {
  const parts: string[] = [];

  parts.push(`Drift score: ${score}/100 (${riskLevel} risk)`);

  if (changedFiles.length > 0) {
    const byChange = {
      modified: changedFiles.filter(f => f.change === 'modified').length,
      added: changedFiles.filter(f => f.change === 'added').length,
      deleted: changedFiles.filter(f => f.change === 'deleted').length,
    };
    const changeParts: string[] = [];
    if (byChange.modified > 0) changeParts.push(`${byChange.modified} modified`);
    if (byChange.added > 0) changeParts.push(`${byChange.added} added`);
    if (byChange.deleted > 0) changeParts.push(`${byChange.deleted} deleted`);
    parts.push(`Files changed: ${changeParts.join(', ')}`);
  }

  if (staleContextFiles.length > 0) {
    parts.push(`${staleContextFiles.length} stale context section(s)`);
  }

  if (gitInsights.recentCommits > 0) {
    parts.push(`${gitInsights.recentCommits} recent commits by ${gitInsights.authors.length} author(s)`);
  }

  if (gitInsights.hasUnpushed) {
    parts.push('unpushed commits detected');
  }

  return parts.join('. ') + '.';
}

/** Advanced git-aware drift check with risk scoring, timeline tracking, and repair suggestions */
export function advancedDriftCheck(
  current: ProjectSnapshot,
  previous: ProjectSnapshot,
  folderPath: string,
): AdvancedDriftResult {
  // 1. Run basic drift detection (reuse existing logic)
  const basicResult = checkDrift(current, previous);

  // 2. Classify each changed file by risk
  const changedFiles: AdvancedDriftResult['changedFiles'] = basicResult.changedFiles.map(f => ({
    path: f.path,
    change: f.change,
    risk: classifyFileRisk(f.path),
  }));

  // 3. Enrich stale context files with section and reason
  const staleContextFiles: AdvancedDriftResult['staleContextFiles'] = basicResult.staleContextFiles.map(entry => {
    // Parse entries like "CLAUDE.md (Commands section)" into structured data
    const match = entry.match(/^(.+?)\s*\((.+?)\)$/);
    if (match) {
      return { file: match[1], section: match[2], reason: `Content in ${match[2]} is stale due to detected changes` };
    }
    return { file: entry, section: 'unknown', reason: 'Stale content detected' };
  });

  // 4. Gather git insights
  const gitInsights = gatherGitInsights(folderPath);

  // 5. Compute drift score
  const driftScore = computeDriftScore(changedFiles, staleContextFiles, gitInsights);

  // 6. Determine risk level
  const riskLevel = scoreToRiskLevel(driftScore);

  // 7. Build repair suggestions
  const repairSuggestions = buildRepairSuggestions(changedFiles, staleContextFiles, gitInsights);

  // 8. Build summary
  const summary = buildSummary(driftScore, riskLevel, changedFiles, staleContextFiles, gitInsights);

  // 9. Track in timeline
  const projectKey = current.folderPath;
  const timeline = driftTimeline.get(projectKey) ?? [];
  timeline.push({
    timestamp: new Date().toISOString(),
    score: driftScore,
    riskLevel,
  });
  driftTimeline.set(projectKey, timeline);

  return {
    hasDrift: basicResult.hasDrift || driftScore < 80,
    driftScore,
    riskLevel,
    changedFiles,
    staleContextFiles,
    repairSuggestions,
    summary,
    gitInsights,
  };
}

/** Retrieve the drift timeline for a project (in-memory, no DB) */
export function getDriftTimeline(folderPath: string): Array<{ timestamp: string; score: number; riskLevel: DriftRiskLevel }> {
  return driftTimeline.get(folderPath) ?? [];
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
