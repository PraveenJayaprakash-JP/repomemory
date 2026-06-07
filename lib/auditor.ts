// RepoMemory — CLAUDE.md Quality Auditor
// Scores CLAUDE.md across 7 dimensions. Pure string analysis, no AI calls.

import type { ProjectSnapshot, AuditDimension, AuditResult } from './types';

// ── Dimension definitions ──────────────────────────────────────────────

const DIMENSIONS: { name: string; maxScore: number }[] = [
  { name: 'Architecture', maxScore: 15 },
  { name: 'Commands', maxScore: 20 },
  { name: 'Conventions', maxScore: 15 },
  { name: 'Off-limits', maxScore: 15 },
  { name: 'Testing', maxScore: 15 },
  { name: 'Deployment', maxScore: 10 },
  { name: 'Freshness', maxScore: 10 },
];

// ── Helpers ────────────────────────────────────────────────────────────

const lower = (s: string): string => s.toLowerCase();
const hasAny = (text: string, keywords: string[]): boolean =>
  keywords.some((k) => lower(text).includes(k));
const countMatches = (text: string, keywords: string[]): number =>
  keywords.filter((k) => lower(text).includes(k)).length;

function clampScore(raw: number, max: number): number {
  return Math.min(Math.max(Math.round(raw), 0), max);
}

// ── Dimension scorers ──────────────────────────────────────────────────

function scoreArchitecture(
  content: string,
  snapshot: ProjectSnapshot,
): { score: number; reason: string } {
  const max = 15;
  const text = lower(content);
  let points = 0;
  const reasons: string[] = [];

  // Folder structure mention (3 pts)
  const folderPatterns = ['src/', 'lib/', 'app/', 'components/', 'pages/', 'modules/', 'packages/', 'services/', 'utils/', 'helpers/'];
  const folderHits = countMatches(content, folderPatterns);
  if (folderHits >= 3) { points += 3; }
  else if (folderHits >= 1) { points += 1; reasons.push('only ' + folderHits + ' folder path(s) mentioned'); }

  // Module names from topFiles (4 pts)
  const topFileRefs = snapshot.topFiles.filter((f) => text.includes(lower(f)));
  if (topFileRefs.length >= 3) { points += 4; }
  else if (topFileRefs.length >= 1) { points += 2; reasons.push('only ' + topFileRefs.length + '/' + snapshot.topFiles.length + ' top files referenced'); }
  else { reasons.push('no top files referenced from project'); }

  // Architecture section or heading (3 pts)
  if (hasAny(content, ['architecture', 'project structure', 'codebase structure', 'directory layout'])) {
    points += 3;
  } else {
    reasons.push('no architecture section');
  }

  // Framework/language mention (3 pts)
  const langFramework = [snapshot.language, snapshot.framework].filter((v) => v && v !== 'Unknown' && v !== 'None');
  const langHits = langFramework.filter((lf) => text.includes(lower(lf)));
  if (langHits.length >= 1) { points += 3; }
  else { reasons.push('missing language/framework mention'); }

  // Dependency awareness (2 pts)
  if (hasAny(content, ['dependencies', 'packages', 'imports', 'requires'])) { points += 2; }

  return { score: clampScore(points, max), reason: reasons.length ? reasons.join('; ') : 'architecture well documented' };
}

function scoreCommands(content: string): { score: number; reason: string } {
  const max = 20;
  const text = lower(content);
  let points = 0;
  const reasons: string[] = [];

  // Build command (4 pts)
  if (hasAny(content, ['build', 'compile', 'tsc', 'webpack', 'vite build', 'cargo build', 'go build'])) {
    points += 4;
  } else { reasons.push('no build command'); }

  // Test command (4 pts)
  if (hasAny(content, ['test', 'jest', 'vitest', 'pytest', 'cargo test', 'go test', 'mocha'])) {
    points += 4;
  } else { reasons.push('no test command'); }

  // Lint/format command (3 pts)
  if (hasAny(content, ['lint', 'eslint', 'prettier', 'format', 'clippy', 'golint', 'flake8', 'ruff'])) {
    points += 3;
  } else { reasons.push('no lint/format command'); }

  // Dev/start command (3 pts)
  if (hasAny(content, ['dev', 'start', 'serve', 'run dev', 'npm start', 'yarn dev', 'pnpm dev'])) {
    points += 3;
  } else { reasons.push('no dev/start command'); }

  // CI or scripts section (3 pts)
  if (hasAny(content, ['scripts', 'ci', 'pipeline', 'makefile', 'task runner'])) {
    points += 3;
  }

  // Command examples with actual invocations (3 pts)
  const commandPatterns = ['npm run', 'yarn ', 'pnpm ', 'npx ', 'cargo ', 'go run', 'make ', 'python -m'];
  if (hasAny(content, commandPatterns)) { points += 3; }

  return { score: clampScore(points, max), reason: reasons.length ? reasons.join('; ') : 'commands well documented' };
}

function scoreConventions(content: string): { score: number; reason: string } {
  const max = 15;
  const text = lower(content);
  let points = 0;
  const reasons: string[] = [];

  // Coding style (3 pts)
  if (hasAny(content, ['coding style', 'code style', 'style guide', 'coding conventions', 'coding standards'])) {
    points += 3;
  } else { reasons.push('no coding style section'); }

  // Naming conventions (3 pts)
  if (hasAny(content, ['naming convention', 'naming pattern', 'camelcase', 'snake_case', 'pascalcase', 'kebab-case', 'file naming'])) {
    points += 3;
  } else { reasons.push('no naming conventions'); }

  // Import rules (2 pts)
  if (hasAny(content, ['import', 'barrel file', 're-export', 'module boundary', 'dependency direction'])) {
    points += 2;
  }

  // Type safety / strictness (2 pts)
  if (hasAny(content, ['strict', 'type safe', 'typescript strict', 'no any', 'no @ts-ignore', 'eslint'])) {
    points += 2;
  }

  // Error handling pattern (2 pts)
  if (hasAny(content, ['error handling', 'exception', 'try/catch', 'result type', 'either'])) {
    points += 2;
  }

  // Comment/doc conventions (2 pts)
  if (hasAny(content, ['comment', 'jsdoc', 'docstring', 'documentation comment'])) {
    points += 2;
  }

  // Git/commit conventions (1 pt)
  if (hasAny(content, ['commit', 'branch naming', 'pr convention', 'conventional commit'])) {
    points += 1;
  }

  return { score: clampScore(points, max), reason: reasons.length ? reasons.join('; ') : 'conventions well documented' };
}

function scoreOffLimits(content: string): { score: number; reason: string } {
  const max = 15;
  const text = lower(content);
  let points = 0;
  const reasons: string[] = [];

  // Explicit "never touch" / "do not modify" warnings (5 pts)
  const neverPatterns = ['never touch', 'do not modify', 'do not edit', 'never change', 'never delete', 'do not delete', 'hands off', 'off limits', 'off-limits', 'read-only'];
  if (hasAny(content, neverPatterns)) {
    points += 5;
  } else { reasons.push('no "do not modify" warnings'); }

  // Generated file warnings (3 pts)
  if (hasAny(content, ['generated', 'auto-generated', 'autogenerated', 'do not edit generated', 'code-generated'])) {
    points += 3;
  } else { reasons.push('no generated file warnings'); }

  // Protected paths/files (3 pts)
  if (hasAny(content, ['protected', 'forbidden', 'restricted', 'no changes allowed'])) {
    points += 3;
  }

  // Ignore/exclude patterns (2 pts)
  if (hasAny(content, ['.gitignore', 'ignore', 'exclude', 'skip', 'claudeignore'])) {
    points += 2;
  }

  // Security boundaries (2 pts)
  if (hasAny(content, ['secret', 'credential', 'api key', 'token', 'password', 'env file'])) {
    points += 2;
  }

  return { score: clampScore(points, max), reason: reasons.length ? reasons.join('; ') : 'off-limits well documented' };
}

function scoreTesting(content: string): { score: number; reason: string } {
  const max = 15;
  const text = lower(content);
  let points = 0;
  const reasons: string[] = [];

  // Test runner/framework (4 pts)
  if (hasAny(content, ['jest', 'vitest', 'pytest', 'mocha', 'cypress', 'playwright', 'testing library', 'react testing', 'cargo test', 'go test'])) {
    points += 4;
  } else { reasons.push('no test runner mentioned'); }

  // Test command (3 pts)
  if (hasAny(content, ['test command', 'run test', 'npm test', 'yarn test', 'pnpm test', 'test:'])) {
    points += 3;
  } else { reasons.push('no test command'); }

  // Testing patterns/philosophy (3 pts)
  if (hasAny(content, ['unit test', 'integration test', 'e2e', 'test coverage', 'tdd', 'bdd', 'snapshot test', 'mock'])) {
    points += 3;
  } else { reasons.push('no testing patterns'); }

  // Test file location convention (2 pts)
  if (hasAny(content, ['test file', 'spec file', '__tests__', '.test.', '.spec.', 'test directory', 'tests/'])) {
    points += 2;
  }

  // Coverage expectations (2 pts)
  if (hasAny(content, ['coverage', 'threshold', 'minimum coverage', 'code coverage'])) {
    points += 2;
  }

  // CI test gate (1 pt)
  if (hasAny(content, ['ci test', 'pipeline test', 'test must pass', 'test gate'])) {
    points += 1;
  }

  return { score: clampScore(points, max), reason: reasons.length ? reasons.join('; ') : 'testing well documented' };
}

function scoreDeployment(content: string): { score: number; reason: string } {
  const max = 10;
  const text = lower(content);
  let points = 0;
  const reasons: string[] = [];

  // CI/CD mention (3 pts)
  if (hasAny(content, ['ci/cd', 'ci cd', 'continuous integration', 'continuous deployment', 'github actions', 'gitlab ci', 'jenkins', 'circleci', 'pipeline'])) {
    points += 3;
  } else { reasons.push('no CI/CD mention'); }

  // Deploy command/process (3 pts)
  if (hasAny(content, ['deploy', 'deployment', 'release', 'publish', 'ship'])) {
    points += 3;
  } else { reasons.push('no deploy process'); }

  // Environment awareness (2 pts)
  if (hasAny(content, ['staging', 'production', 'prod', 'dev environment', 'environment variable', 'env var'])) {
    points += 2;
  }

  // Docker/containerization (2 pts)
  if (hasAny(content, ['docker', 'container', 'kubernetes', 'k8s', 'helm'])) {
    points += 2;
  }

  return { score: clampScore(points, max), reason: reasons.length ? reasons.join('; ') : 'deployment well documented' };
}

function scoreFreshness(
  content: string,
  snapshot: ProjectSnapshot,
): { score: number; reason: string } {
  const max = 10;
  const text = lower(content);
  let points = 0;
  const reasons: string[] = [];

  // References key files from snapshot (4 pts)
  const keyFile = snapshot.keyFiles;
  let keyRefs = 0;
  if (keyFile.packageJson) {
    const pkg = keyFile.packageJson as Record<string, unknown>;
    if (pkg.name && text.includes(lower(String(pkg.name)))) keyRefs++;
    if (pkg.scripts && typeof pkg.scripts === 'object') keyRefs++;
  }
  if (keyFile.dockerFile) {
    if (hasAny(content, ['docker', 'dockerfile'])) keyRefs++;
  }
  if (keyFile.ciConfig) {
    if (hasAny(content, ['ci', 'pipeline', 'github actions'])) keyRefs++;
  }
  if (keyFile.envExample) {
    if (hasAny(content, ['env', 'environment'])) keyRefs++;
  }
  if (keyRefs >= 3) { points += 4; }
  else if (keyRefs >= 1) { points += 2; }
  else { reasons.push('no references to key project files'); }

  // Language/framework match (3 pts)
  const langFramework = [snapshot.language, snapshot.framework].filter((v) => v && v !== 'Unknown' && v !== 'None');
  if (langFramework.length > 0 && hasAny(content, langFramework.map(String))) {
    points += 3;
  } else { reasons.push('language/framework mismatch or missing'); }

  // Recent date or version mention (3 pts)
  const datePattern = /\b(20[2-9]\d)\b/;
  const versionPattern = /v?\d+\.\d+/;
  if (datePattern.test(content) || versionPattern.test(content)) {
    points += 3;
  } else { reasons.push('no version or date references'); }

  return { score: clampScore(points, max), reason: reasons.length ? reasons.join('; ') : 'content appears fresh' };
}

// ── Badge helper ───────────────────────────────────────────────────────

function badgeFor(totalScore: number): AuditResult['badge'] {
  if (totalScore >= 80) return 'excellent';
  if (totalScore >= 60) return 'good';
  if (totalScore >= 30) return 'needs-improvement';
  return 'critical';
}

// ── Main export ────────────────────────────────────────────────────────

export function auditClaudeMd(
  content: string | null,
  snapshot: ProjectSnapshot,
): AuditResult {
  // Null/empty → all zeros, critical
  if (!content || content.trim().length === 0) {
    const dimensions: AuditDimension[] = DIMENSIONS.map((d) => ({
      name: d.name,
      maxScore: d.maxScore,
      score: 0,
      reason: 'no CLAUDE.md content to evaluate',
    }));
    return {
      totalScore: 0,
      dimensions,
      summary: 'No CLAUDE.md found. Create one to improve AI context quality.',
      badge: 'critical',
    };
  }

  // Score each dimension
  const scorers = [
    scoreArchitecture,
    scoreCommands,
    scoreConventions,
    scoreOffLimits,
    scoreTesting,
    scoreDeployment,
    scoreFreshness,
  ];

  const dimensions: AuditDimension[] = DIMENSIONS.map((def, i) => {
    const result = scorers[i](content, snapshot);
    return {
      name: def.name,
      maxScore: def.maxScore,
      score: result.score,
      reason: result.reason,
    };
  });

  const totalScore = dimensions.reduce((sum, d) => sum + d.score, 0);
  const badge = badgeFor(totalScore);

  // Build summary
  const weakDimensions = dimensions.filter((d) => d.score < d.maxScore * 0.5);
  const strongDimensions = dimensions.filter((d) => d.score >= d.maxScore * 0.8);

  let summary: string;
  if (badge === 'excellent') {
    summary = `CLAUDE.md scores ${totalScore}/100 (${badge}). Strong in: ${strongDimensions.map((d) => d.name).join(', ')}.`;
  } else if (badge === 'good') {
    summary = `CLAUDE.md scores ${totalScore}/100 (${badge}). Improve: ${weakDimensions.map((d) => d.name).join(', ') || 'none'}.`;
  } else if (badge === 'needs-improvement') {
    summary = `CLAUDE.md scores ${totalScore}/100 (${badge}). Weak areas: ${weakDimensions.map((d) => `${d.name} (${d.reason})`).join('; ')}.`;
  } else {
    summary = `CLAUDE.md scores ${totalScore}/100 (${badge}). Major gaps in: ${weakDimensions.map((d) => `${d.name} — ${d.reason}`).join('; ')}.`;
  }

  return { totalScore, dimensions, summary, badge };
}