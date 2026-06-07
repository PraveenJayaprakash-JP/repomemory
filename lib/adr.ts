// RepoMemory — Architecture Decision Record generator
// Detects significant changes from git history, dependency shifts, and config edits
// then uses AI to produce structured ADRs

import type { ProjectSnapshot } from './types';
import { generateText } from './ai';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

// ─── Types ────────────────────────────────────────────────

export type AdrStatus = 'proposed' | 'accepted' | 'deprecated' | 'superseded';
export type AdrSource = 'commit' | 'dependency' | 'config-change' | 'manual';

export interface AdrRecord {
  id: string;
  title: string;
  date: string;
  status: AdrStatus;
  context: string;
  decision: string;
  consequences: string;
  source: AdrSource;
  sourceRef: string;
}

export interface AdrTrigger {
  type: AdrSource;
  description: string;
  sourceRef: string;
  detail: string;
}

export interface AdrGenerationResult {
  records: AdrRecord[];
  outputPath: string;
}

// ─── Git helpers ──────────────────────────────────────────

function runGit(folderPath: string, args: string): string | null {
  try {
    return execSync(`git ${args}`, {
      cwd: folderPath,
      encoding: 'utf-8',
      timeout: 15000,
    }).trim();
  } catch {
    return null;
  }
}

function isGitRepo(folderPath: string): boolean {
  return runGit(folderPath, 'rev-parse --is-inside-work-tree') === 'true';
}

// ─── Trigger detection ─────────────────────────────────────

/** Detect ADR-worthy triggers from git history, dependency changes, and config edits */
export function detectAdrTriggers(snapshot: ProjectSnapshot): AdrTrigger[] {
  const triggers: AdrTrigger[] = [];
  const { folderPath } = snapshot;

  // 1. Git commit triggers — significant structural changes
  if (isGitRepo(folderPath)) {
    const logOutput = runGit(
      folderPath,
      'log --oneline --no-merges --format="%h|%s" -30',
    );
    if (logOutput) {
      const significantPatterns = [
        /(?:migrat|refactor|rewrit|replac|remov|deprecat|switch|adopt|introduc|upgrad)/i,
        /(?:architect|design|decid|choos|select|pick|move to|move from)/i,
        /(?:docker|kubernetes|k8s|terraform|infra|deploy|ci|cd)/i,
        /(?:auth|security|encrypt|tls|ssl|oauth|jwt)/i,
        /(?:database|db|schema|migration|orm|query)/i,
        /(?:test|jest|vitest|cypress|playwright|testing)/i,
      ];

      const lines = logOutput.split('\n').filter(Boolean);
      for (const line of lines) {
        const [hash, ...msgParts] = line.split('|');
        const message = msgParts.join('|');
        if (!hash || !message) continue;

        const isSignificant = significantPatterns.some((p) => p.test(message));
        if (isSignificant) {
          triggers.push({
            type: 'commit',
            description: message,
            sourceRef: hash.trim(),
            detail: `Git commit ${hash.trim()}: ${message}`,
          });
        }
      }
    }
  }

  // 2. Dependency triggers — changes in package.json
  const pkg = snapshot.keyFiles.packageJson;
  if (pkg && typeof pkg === 'object') {
    const deps = pkg.dependencies as Record<string, string> | undefined;
    const devDeps = pkg.devDependencies as Record<string, string> | undefined;
    const allDeps = { ...deps, ...devDeps };

    // Major frameworks/libraries that warrant ADRs
    const adrWorthyPackages = [
      'next', 'react', 'vue', 'angular', 'svelte', 'nuxt', 'remix', 'astro',
      'express', 'fastify', 'nestjs', 'hono',
      'prisma', 'drizzle-orm', 'typeorm', 'mongoose',
      'tailwindcss', 'shadcn', 'radix-ui',
      'typescript', 'eslint', 'prettier',
      'docker', 'kubernetes',
    ];

    for (const name of adrWorthyPackages) {
      if (name in allDeps) {
        triggers.push({
          type: 'dependency',
          description: `Uses ${name}@${allDeps[name]}`,
          sourceRef: name,
          detail: `Dependency: ${name}@${allDeps[name]}`,
        });
      }
    }
  }

  // 3. Config-change triggers — key infrastructure files
  const configFiles: { path: string; label: string }[] = [
    { path: 'tsconfig.json', label: 'TypeScript config' },
    { path: 'Dockerfile', label: 'Docker config' },
    { path: 'docker-compose.yml', label: 'Docker Compose' },
    { path: '.github/workflows/ci.yml', label: 'CI pipeline' },
    { path: '.github/workflows/deploy.yml', label: 'CD pipeline' },
    { path: '.gitlab-ci.yml', label: 'GitLab CI' },
    { path: 'next.config.ts', label: 'Next.js config' },
    { path: 'next.config.js', label: 'Next.js config' },
    { path: 'vite.config.ts', label: 'Vite config' },
  ];

  for (const cf of configFiles) {
    const fullPath = join(folderPath, cf.path);
    if (existsSync(fullPath)) {
      triggers.push({
        type: 'config-change',
        description: `${cf.label} present`,
        sourceRef: cf.path,
        detail: `Config file: ${cf.path} (${cf.label})`,
      });
    }
  }

  return triggers;
}

// ─── ADR generation ───────────────────────────────────────

/** Generate a single ADR from a trigger using AI */
export async function generateAdr(
  trigger: AdrTrigger,
  snapshot: ProjectSnapshot,
): Promise<AdrRecord> {
  const id = `ADR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const prompt = `Generate an Architecture Decision Record for the following change in the project "${snapshot.repoName}" (${snapshot.language}, ${snapshot.framework}).

Change details:
- Type: ${trigger.type}
- Description: ${trigger.description}
- Source: ${trigger.sourceRef}
- Detail: ${trigger.detail}

Project context:
- Language: ${snapshot.language}
- Framework: ${snapshot.framework}
- Files: ${snapshot.fileCount}
- Top files: ${snapshot.topFiles.slice(0, 10).join(', ')}

Respond in this exact JSON format (no markdown, no code fences):
{
  "title": "Short descriptive title for this decision",
  "context": "2-3 sentences explaining why this decision was needed. What forces were at play?",
  "decision": "2-3 sentences stating what was decided and why this approach was chosen.",
  "consequences": "2-3 sentences on the trade-offs, benefits, and risks of this decision."
}

Be specific to this project and change. Avoid generic filler.`;

  const systemPrompt =
    'You are a senior architect writing Architecture Decision Records. Be precise, specific, and practical. No fluff.';

  let title = trigger.description;
  let context = trigger.detail;
  let decision = `Adopted ${trigger.description} for the ${snapshot.repoName} project.`;
  let consequences = 'Impact to be evaluated.';

  try {
    const raw = await generateText(prompt, systemPrompt, {
      maxTokens: 600,
      temperature: 0.4,
    });

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
    const parsed = JSON.parse(cleaned);
    title = parsed.title ?? title;
    context = parsed.context ?? context;
    decision = parsed.decision ?? decision;
    consequences = parsed.consequences ?? consequences;
  } catch {
    // Fallback: use trigger-based defaults (already set above)
  }

  return {
    id,
    title,
    date: new Date().toISOString().split('T')[0],
    status: 'proposed',
    context,
    decision,
    consequences,
    source: trigger.type,
    sourceRef: trigger.sourceRef,
  };
}

// ─── Template ──────────────────────────────────────────────

/** Standard ADR markdown template */
export function getAdrTemplate(): string {
  return `# ADR-{id}: {title}

- **Date**: {date}
- **Status**: {status}
- **Source**: {source} ({sourceRef})

## Context

{context}

## Decision

{decision}

## Consequences

{consequences}
`;
}

/** Render an AdrRecord to markdown */
export function renderAdrMarkdown(adr: AdrRecord): string {
  return getAdrTemplate()
    .replace('{id}', adr.id)
    .replace('{title}', adr.title)
    .replace('{date}', adr.date)
    .replace('{status}', adr.status)
    .replace('{source}', adr.source)
    .replace('{sourceRef}', adr.sourceRef)
    .replace('{context}', adr.context)
    .replace('{decision}', adr.decision)
    .replace('{consequences}', adr.consequences);
}

// ─── Batch generation ──────────────────────────────────────

/** Detect triggers, generate ADRs for each, write .md files to adr/ directory */
export async function generateAllAdrs(
  snapshot: ProjectSnapshot,
): Promise<AdrGenerationResult> {
  const triggers = detectAdrTriggers(snapshot);

  if (triggers.length === 0) {
    return { records: [], outputPath: '' };
  }

  // Deduplicate triggers by sourceRef to avoid duplicate ADRs
  const seen = new Set<string>();
  const uniqueTriggers = triggers.filter((t) => {
    const key = `${t.type}:${t.sourceRef}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Limit to 15 triggers to avoid excessive AI calls
  const limited = uniqueTriggers.slice(0, 15);

  const records = await Promise.all(
    limited.map((trigger) => generateAdr(trigger, snapshot)),
  );

  // Write ADR files to adr/ directory
  const adrDir = join(snapshot.folderPath, 'adr');
  if (!existsSync(adrDir)) {
    mkdirSync(adrDir, { recursive: true });
  }

  // Read existing ADRs to avoid overwriting
  let nextNumber = 1;
  try {
    const existing = readFileSync(join(adrDir, 'README.md'), 'utf-8');
    const match = existing.match(/ADR-(\d+)/g);
    if (match) {
      const nums = match.map((m) => parseInt(m.replace('ADR-', ''), 10));
      nextNumber = Math.max(...nums) + 1;
    }
  } catch {
    // No existing README, start from 1
  }

  // Check existing files for numbering
  try {
    const existingFiles = execSync(`ls "${adrDir}"`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    const numMatch = existingFiles.match(/(\d+)-.*\.md/g);
    if (numMatch) {
      const nums = numMatch.map((f) =>
        parseInt(f.replace(/^(\d+)-.*/, '$1'), 10),
      );
      nextNumber = Math.max(nextNumber, ...nums, 0) + 1;
    }
  } catch {
    // Directory may be empty or not exist yet
  }

  for (const record of records) {
    const paddedNum = String(nextNumber).padStart(4, '0');
    const slug = record.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
    const fileName = `${paddedNum}-${slug}.md`;
    const filePath = join(adrDir, fileName);

    // Update the record id to use sequential numbering
    record.id = `ADR-${paddedNum}`;

    const markdown = renderAdrMarkdown(record);
    writeFileSync(filePath, markdown, 'utf-8');
    nextNumber++;
  }

  // Write/update README.md index
  const readmePath = join(adrDir, 'README.md');
  const readmeLines = [
    '# Architecture Decision Records',
    '',
    'This directory contains ADRs auto-generated by RepoMemory.',
    '',
    '| Number | Title | Date | Status | Source |',
    '|--------|-------|------|--------|--------|',
    ...records.map(
      (r) =>
        `| ${r.id} | ${r.title} | ${r.date} | ${r.status} | ${r.source} |`,
    ),
    '',
  ].join('\n');

  writeFileSync(readmePath, readmeLines, 'utf-8');

  return {
    records,
    outputPath: adrDir,
  };
}