// RepoMemory — AI Context File Quality Auditor
// Scores agent context files across 7 dimensions. Pure string analysis, no AI calls.

import type { ProjectSnapshot, AuditDimension, AuditResult, AgentAuditResult, AgentType } from './types';

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

/** Extract script commands from package.json for suggestion generation */
function getPkgScripts(snapshot: ProjectSnapshot): string[] {
  const pkg = snapshot.keyFiles.packageJson as Record<string, unknown> | null;
  if (!pkg || typeof pkg.scripts !== 'object' || pkg.scripts === null) return [];
  return Object.keys(pkg.scripts as Record<string, unknown>);
}

function getPkgName(snapshot: ProjectSnapshot): string {
  const pkg = snapshot.keyFiles.packageJson as Record<string, unknown> | null;
  if (!pkg || !pkg.name) return '';
  return String(pkg.name);
}

// ── Dimension scorers ──────────────────────────────────────────────────

function scoreArchitecture(
  content: string,
  snapshot: ProjectSnapshot,
): { score: number; reason: string; suggestions: string[] } {
  const max = 15;
  const text = lower(content);
  let points = 0;
  const reasons: string[] = [];
  const suggestions: string[] = [];

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
    suggestions.push('Add a `## Architecture` section describing the project structure');
  }

  // Framework/language mention (3 pts)
  const langFramework = [snapshot.language, snapshot.framework].filter((v) => v && v !== 'Unknown' && v !== 'None');
  const langHits = langFramework.filter((lf) => text.includes(lower(lf)));
  if (langHits.length >= 1) { points += 3; }
  else {
    reasons.push('missing language/framework mention');
    if (langFramework.length > 0) {
      suggestions.push(`Mention the framework (${langFramework.join(', ')}) and main entry points`);
    }
  }

  // Dependency awareness (2 pts)
  if (hasAny(content, ['dependencies', 'packages', 'imports', 'requires'])) { points += 2; }

  // Suggestions for low folder hits
  if (folderHits < 3) {
    const topDirs = [...new Set(snapshot.topFiles.map((f) => f.split('/').slice(0, -1).join('/')))].filter(Boolean).slice(0, 5);
    if (topDirs.length > 0) {
      suggestions.push(`Reference key directories: ${topDirs.join(', ')}`);
    }
  }

  // Suggestions for low file refs
  if (topFileRefs.length < 3 && snapshot.topFiles.length > 0) {
    const missing = snapshot.topFiles.filter((f) => !text.includes(lower(f))).slice(0, 3);
    if (missing.length > 0) {
      suggestions.push(`Reference key files: ${missing.join(', ')}`);
    }
  }

  return { score: clampScore(points, max), reason: reasons.length ? reasons.join('; ') : 'architecture well documented', suggestions };
}

function scoreCommands(content: string, snapshot: ProjectSnapshot): { score: number; reason: string; suggestions: string[] } {
  const max = 20;
  const text = lower(content);
  let points = 0;
  const reasons: string[] = [];
  const suggestions: string[] = [];
  const scripts = getPkgScripts(snapshot);

  // Build command (4 pts)
  if (hasAny(content, ['build', 'compile', 'tsc', 'webpack', 'vite build', 'cargo build', 'go build'])) {
    points += 4;
  } else {
    reasons.push('no build command');
    if (scripts.includes('build')) {
      suggestions.push(`Add the build command: \`npm run build\` (found in package.json scripts)`);
    } else {
      suggestions.push('Add a `## Commands` section with the build command');
    }
  }

  // Test command (4 pts)
  if (hasAny(content, ['test', 'jest', 'vitest', 'pytest', 'cargo test', 'go test', 'mocha'])) {
    points += 4;
  } else {
    reasons.push('no test command');
    const testScript = scripts.find((s) => s === 'test');
    if (testScript) {
      suggestions.push(`Include the test command: \`npm run test\` (from package.json scripts)`);
    } else {
      suggestions.push('Document the test command and how to run tests');
    }
  }

  // Lint/format command (3 pts)
  if (hasAny(content, ['lint', 'eslint', 'prettier', 'format', 'clippy', 'golint', 'flake8', 'ruff'])) {
    points += 3;
  } else {
    reasons.push('no lint/format command');
    const lintScripts = scripts.filter((s) => s.includes('lint') || s.includes('format'));
    if (lintScripts.length > 0) {
      suggestions.push(`Add lint/format commands: ${lintScripts.map((s) => `\`npm run ${s}\``).join(', ')}`);
    } else {
      suggestions.push('Add lint and format commands if available');
    }
  }

  // Dev/start command (3 pts)
  if (hasAny(content, ['dev', 'start', 'serve', 'run dev', 'npm start', 'yarn dev', 'pnpm dev'])) {
    points += 3;
  } else {
    reasons.push('no dev/start command');
    const devScript = scripts.find((s) => s === 'dev' || s === 'start');
    if (devScript) {
      suggestions.push(`Add the dev command: \`npm run ${devScript}\` (from package.json scripts)`);
    } else {
      suggestions.push('Add a `## Commands` section with: `npm run dev`, `npm run build`');
    }
  }

  // CI or scripts section (3 pts)
  if (hasAny(content, ['scripts', 'ci', 'pipeline', 'makefile', 'task runner'])) {
    points += 3;
  }

  // Command examples with actual invocations (3 pts)
  const commandPatterns = ['npm run', 'yarn ', 'pnpm ', 'npx ', 'cargo ', 'go run', 'make ', 'python -m'];
  if (hasAny(content, commandPatterns)) { points += 3; }

  // Aggregate suggestion for low overall score
  if (points < max * 0.5 && suggestions.length === 0) {
    suggestions.push('Add a `## Commands` section listing all available scripts from package.json');
  }

  return { score: clampScore(points, max), reason: reasons.length ? reasons.join('; ') : 'commands well documented', suggestions };
}

function scoreConventions(content: string, snapshot: ProjectSnapshot): { score: number; reason: string; suggestions: string[] } {
  const max = 15;
  const text = lower(content);
  let points = 0;
  const reasons: string[] = [];
  const suggestions: string[] = [];

  // Coding style (3 pts)
  if (hasAny(content, ['coding style', 'code style', 'style guide', 'coding conventions', 'coding standards'])) {
    points += 3;
  } else {
    reasons.push('no coding style section');
    if (snapshot.language === 'TypeScript' || snapshot.language === 'JavaScript') {
      suggestions.push('Document coding style: TypeScript strict mode, ESLint rules');
    } else {
      suggestions.push('Add a `## Conventions` section describing coding style');
    }
  }

  // Naming conventions (3 pts)
  if (hasAny(content, ['naming convention', 'naming pattern', 'camelcase', 'snake_case', 'pascalcase', 'kebab-case', 'file naming'])) {
    points += 3;
  } else {
    reasons.push('no naming conventions');
    suggestions.push('Specify naming conventions (camelCase, PascalCase) for different code types');
  }

  // Import rules (2 pts)
  if (hasAny(content, ['import', 'barrel file', 're-export', 'module boundary', 'dependency direction'])) {
    points += 2;
  }

  // Type safety / strictness (2 pts)
  if (hasAny(content, ['strict', 'type safe', 'typescript strict', 'no any', 'no @ts-ignore', 'eslint'])) {
    points += 2;
  } else if (snapshot.language === 'TypeScript') {
    suggestions.push('Mention TypeScript strict mode and `no any` / `no @ts-ignore` rules');
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
  } else {
    suggestions.push('Add import ordering and formatting rules');
  }

  return { score: clampScore(points, max), reason: reasons.length ? reasons.join('; ') : 'conventions well documented', suggestions };
}

function scoreOffLimits(content: string, snapshot: ProjectSnapshot): { score: number; reason: string; suggestions: string[] } {
  const max = 15;
  const text = lower(content);
  let points = 0;
  const reasons: string[] = [];
  const suggestions: string[] = [];

  // Explicit "never touch" / "do not modify" warnings (5 pts)
  const neverPatterns = ['never touch', 'do not modify', 'do not edit', 'never change', 'never delete', 'do not delete', 'hands off', 'off limits', 'off-limits', 'read-only'];
  if (hasAny(content, neverPatterns)) {
    points += 5;
  } else {
    reasons.push('no "do not modify" warnings');
    suggestions.push('Add explicit "do not modify" warnings for protected files and directories');
  }

  // Generated file warnings (3 pts)
  if (hasAny(content, ['generated', 'auto-generated', 'autogenerated', 'do not edit generated', 'code-generated'])) {
    points += 3;
  } else {
    reasons.push('no generated file warnings');
    const noisyDirs = snapshot.noisyDirs;
    if (noisyDirs.length > 0) {
      suggestions.push(`Add warnings about generated directories: ${noisyDirs.slice(0, 3).join(', ')}`);
    } else {
      suggestions.push('Add warnings about generated directories: node_modules, dist, .next');
    }
  }

  // Protected paths/files (3 pts)
  if (hasAny(content, ['protected', 'forbidden', 'restricted', 'no changes allowed'])) {
    points += 3;
  }

  // Ignore/exclude patterns (2 pts)
  if (hasAny(content, ['.gitignore', 'ignore', 'exclude', 'skip', 'claudeignore'])) {
    points += 2;
  } else {
    suggestions.push('Reference .gitignore patterns and .claudeignore for excluded paths');
  }

  // Security boundaries (2 pts)
  if (hasAny(content, ['secret', 'credential', 'api key', 'token', 'password', 'env file'])) {
    points += 2;
  } else {
    suggestions.push('Mention that .env files and secrets should never be committed');
  }

  return { score: clampScore(points, max), reason: reasons.length ? reasons.join('; ') : 'off-limits well documented', suggestions };
}

function scoreTesting(content: string, snapshot: ProjectSnapshot): { score: number; reason: string; suggestions: string[] } {
  const max = 15;
  const text = lower(content);
  let points = 0;
  const reasons: string[] = [];
  const suggestions: string[] = [];
  const scripts = getPkgScripts(snapshot);

  // Test runner/framework (4 pts)
  if (hasAny(content, ['jest', 'vitest', 'pytest', 'mocha', 'cypress', 'playwright', 'testing library', 'react testing', 'cargo test', 'go test'])) {
    points += 4;
  } else {
    reasons.push('no test runner mentioned');
    // Detect from scripts
    const testRunner = scripts.find((s) => s === 'test');
    if (testRunner) {
      suggestions.push(`Document the test runner and test command: \`npm run ${testRunner}\``);
    } else {
      suggestions.push('Document the test runner (e.g., vitest, jest) and how to run tests');
    }
  }

  // Test command (3 pts)
  if (hasAny(content, ['test command', 'run test', 'npm test', 'yarn test', 'pnpm test', 'test:'])) {
    points += 3;
  } else {
    reasons.push('no test command');
    const testScript = scripts.find((s) => s === 'test');
    if (testScript) {
      suggestions.push(`Include the test command: \`npm run ${testScript}\` (from package.json scripts)`);
    }
  }

  // Testing patterns/philosophy (3 pts)
  if (hasAny(content, ['unit test', 'integration test', 'e2e', 'test coverage', 'tdd', 'bdd', 'snapshot test', 'mock'])) {
    points += 3;
  } else {
    reasons.push('no testing patterns');
    suggestions.push('Describe testing patterns: unit tests, integration tests, E2E tests');
  }

  // Test file location convention (2 pts)
  if (hasAny(content, ['test file', 'spec file', '__tests__', '.test.', '.spec.', 'test directory', 'tests/'])) {
    points += 2;
  } else {
    suggestions.push('Specify test file location patterns (e.g., `__tests__/`, `.test.ts` co-located)');
  }

  // Coverage expectations (2 pts)
  if (hasAny(content, ['coverage', 'threshold', 'minimum coverage', 'code coverage'])) {
    points += 2;
  } else {
    suggestions.push('Add example test commands and coverage requirements');
  }

  // CI test gate (1 pt)
  if (hasAny(content, ['ci test', 'pipeline test', 'test must pass', 'test gate'])) {
    points += 1;
  }

  return { score: clampScore(points, max), reason: reasons.length ? reasons.join('; ') : 'testing well documented', suggestions };
}

function scoreDeployment(content: string, snapshot: ProjectSnapshot): { score: number; reason: string; suggestions: string[] } {
  const max = 10;
  const text = lower(content);
  let points = 0;
  const reasons: string[] = [];
  const suggestions: string[] = [];

  // CI/CD mention (3 pts)
  if (hasAny(content, ['ci/cd', 'ci cd', 'continuous integration', 'continuous deployment', 'github actions', 'gitlab ci', 'jenkins', 'circleci', 'pipeline'])) {
    points += 3;
  } else {
    reasons.push('no CI/CD mention');
    if (snapshot.keyFiles.ciConfig) {
      suggestions.push('Add CI/CD pipeline documentation referencing the project\'s CI config');
    } else {
      suggestions.push('Add CI/CD pipeline documentation referencing GitHub Actions or equivalent');
    }
  }

  // Deploy command/process (3 pts)
  if (hasAny(content, ['deploy', 'deployment', 'release', 'publish', 'ship'])) {
    points += 3;
  } else {
    reasons.push('no deploy process');
    suggestions.push('Describe the deployment process and commands');
  }

  // Environment awareness (2 pts)
  if (hasAny(content, ['staging', 'production', 'prod', 'dev environment', 'environment variable', 'env var'])) {
    points += 2;
  } else {
    suggestions.push('Describe staging and production environments');
  }

  // Docker/containerization (2 pts)
  if (hasAny(content, ['docker', 'container', 'kubernetes', 'k8s', 'helm'])) {
    points += 2;
  } else if (snapshot.keyFiles.dockerFile) {
    suggestions.push('Document the Docker setup since a Dockerfile exists in the project');
  }

  return { score: clampScore(points, max), reason: reasons.length ? reasons.join('; ') : 'deployment well documented', suggestions };
}

function scoreFreshness(
  content: string,
  snapshot: ProjectSnapshot,
): { score: number; reason: string; suggestions: string[] } {
  const max = 10;
  const text = lower(content);
  let points = 0;
  const reasons: string[] = [];
  const suggestions: string[] = [];

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
  else {
    reasons.push('no references to key project files');
    suggestions.push('Cross-reference actual file structure paths from the project');
  }

  // Language/framework match (3 pts)
  const langFramework = [snapshot.language, snapshot.framework].filter((v) => v && v !== 'Unknown' && v !== 'None');
  if (langFramework.length > 0 && hasAny(content, langFramework.map(String))) {
    points += 3;
  } else {
    reasons.push('language/framework mismatch or missing');
    if (langFramework.length > 0) {
      suggestions.push(`Update to reference the actual language/framework: ${langFramework.join(', ')}`);
    }
  }

  // Recent date or version mention (3 pts)
  const datePattern = /\b(20[2-9]\d)\b/;
  const versionPattern = /v?\d+\.\d+/;
  if (datePattern.test(content) || versionPattern.test(content)) {
    points += 3;
  } else {
    reasons.push('no version or date references');
    suggestions.push('Add last-updated date or version reference');
  }

  // Suggest updating dependency versions if package.json exists
  if (keyFile.packageJson && keyRefs < 3) {
    const pkgName = getPkgName(snapshot);
    if (pkgName) {
      suggestions.push(`Reference the project name "${pkgName}" and its key configuration files`);
    }
  }

  return { score: clampScore(points, max), reason: reasons.length ? reasons.join('; ') : 'content appears fresh', suggestions };
}

// ── Badge helper ───────────────────────────────────────────────────────

function badgeFor(totalScore: number): AuditResult['badge'] {
  if (totalScore >= 80) return 'excellent';
  if (totalScore >= 60) return 'good';
  if (totalScore >= 30) return 'needs-improvement';
  return 'critical';
}

// ── Agent name map ──────────────────────────────────────────────────────

const AGENT_NAMES: Record<AgentType, string> = {
  claude: 'Claude',
  opencode: 'OpenCode',
  gemini: 'Gemini',
  aider: 'Aider',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
};

// ── Internal: audit a single agent file ─────────────────────────────────

function auditAgentFile(
  content: string | null,
  snapshot: ProjectSnapshot,
  agentType: AgentType,
  fileName: string,
): { totalScore: number; dimensions: AuditDimension[]; badge: AuditResult['badge']; summary: string } {
  const agentName = AGENT_NAMES[agentType];

  // Null/empty → all zeros, critical
  if (!content || content.trim().length === 0) {
    const dimensions: AuditDimension[] = DIMENSIONS.map((d) => ({
      name: d.name,
      maxScore: d.maxScore,
      score: 0,
      reason: `no ${fileName} content to evaluate`,
      suggestions: [
        `Create a ${fileName} file with sections for Architecture, Commands, Conventions, Off-limits, Testing, Deployment, and Freshness`,
      ],
    }));
    return {
      totalScore: 0,
      dimensions,
      summary: `No ${fileName} found. Create one to improve AI context quality.`,
      badge: 'critical',
    };
  }

  // Score each dimension using the same 7 scorers
  const scorers: Array<(content: string, snapshot: ProjectSnapshot) => { score: number; reason: string; suggestions: string[] }> = [
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
      suggestions: result.score < def.maxScore ? result.suggestions : [],
    };
  });

  const totalScore = dimensions.reduce((sum, d) => sum + d.score, 0);
  const badge = badgeFor(totalScore);

  // Build summary
  const weakDimensions = dimensions.filter((d) => d.score < d.maxScore * 0.5);
  const strongDimensions = dimensions.filter((d) => d.score >= d.maxScore * 0.8);

  let summary: string;
  if (badge === 'excellent') {
    summary = `${fileName} scores ${totalScore}/100 (${badge}). Strong in: ${strongDimensions.map((d) => d.name).join(', ')}.`;
  } else if (badge === 'good') {
    summary = `${fileName} scores ${totalScore}/100 (${badge}). Improve: ${weakDimensions.map((d) => d.name).join(', ') || 'none'}.`;
  } else if (badge === 'needs-improvement') {
    summary = `${fileName} scores ${totalScore}/100 (${badge}). Weak areas: ${weakDimensions.map((d) => `${d.name} (${d.reason})`).join('; ')}.`;
  } else {
    summary = `${fileName} scores ${totalScore}/100 (${badge}). Major gaps in: ${weakDimensions.map((d) => `${d.name} — ${d.reason}`).join('; ')}.`;
  }

  return { totalScore, dimensions, badge, summary };
}

// ── Main export: audit all context files ─────────────────────────────────

export function auditContextFiles(snapshot: ProjectSnapshot): AuditResult {
  const agentAudits: AgentAuditResult[] = [];

  for (const ctxFile of snapshot.existingContextFiles) {
    const result = auditAgentFile(ctxFile.content, snapshot, ctxFile.agentType, ctxFile.fileName);
    agentAudits.push({
      agentType: ctxFile.agentType,
      agentName: AGENT_NAMES[ctxFile.agentType],
      totalScore: result.totalScore,
      dimensions: result.dimensions,
      badge: result.badge,
      summary: result.summary,
    });
  }

  // Calculate weighted average: CLAUDE.md gets 2x weight, others 1x
  let totalWeight = 0;
  let weightedSum = 0;
  let primaryDimensions: AuditDimension[] = [];
  let primaryBadge: AuditResult['badge'] = 'critical';

  if (agentAudits.length === 0) {
    // No agent files at all — return zero-score result
    const dimensions: AuditDimension[] = DIMENSIONS.map((d) => ({
      name: d.name,
      maxScore: d.maxScore,
      score: 0,
      reason: 'no agent context files found',
      suggestions: [
        'Create a CLAUDE.md or other agent context file with sections for Architecture, Commands, Conventions, Off-limits, Testing, Deployment, and Freshness',
      ],
    }));
    return {
      totalScore: 0,
      dimensions,
      summary: 'No agent context files found. Create CLAUDE.md, AGENTS.md, or similar to improve AI context quality.',
      badge: 'critical',
      agentAudits: [],
    };
  }

  for (const audit of agentAudits) {
    const weight = audit.agentType === 'claude' ? 2 : 1;
    weightedSum += audit.totalScore * weight;
    totalWeight += weight;

    // Use the first claude audit (or first audit) as primary for backward compat
    if (primaryDimensions.length === 0 || audit.agentType === 'claude') {
      primaryDimensions = audit.dimensions;
      primaryBadge = audit.badge;
    }
  }

  const totalScore = Math.round(weightedSum / totalWeight);
  const badge = badgeFor(totalScore);

  // Build combined summary
  const scored = agentAudits.filter((a) => a.totalScore > 0);
  const missing = agentAudits.filter((a) => a.totalScore === 0);
  const parts: string[] = [];
  if (scored.length > 0) {
    parts.push(scored.map((a) => `${a.agentName} ${a.totalScore}/100`).join(' · '));
  }
  if (missing.length > 0) {
    parts.push(`Missing: ${missing.map((a) => a.agentName).join(', ')}`);
  }
  const summary = parts.join('. ');

  return {
    totalScore,
    dimensions: primaryDimensions,
    summary,
    badge,
    agentAudits,
  };
}

// ── Legacy export (backward compat) ─────────────────────────────────────

export function auditClaudeMd(
  content: string | null,
  snapshot: ProjectSnapshot,
): AuditResult {
  // Delegate to auditAgentFile for the CLAUDE.md-specific result
  const result = auditAgentFile(content, snapshot, 'claude', 'CLAUDE.md');

  return {
    totalScore: result.totalScore,
    dimensions: result.dimensions,
    summary: result.summary,
    badge: result.badge,
    agentAudits: [
      {
        agentType: 'claude',
        agentName: 'Claude',
        totalScore: result.totalScore,
        dimensions: result.dimensions,
        badge: result.badge,
        summary: result.summary,
      },
    ],
  };
}