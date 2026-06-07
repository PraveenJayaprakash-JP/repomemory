#!/usr/bin/env node

import { Command } from 'commander';
import { scanRepository } from '../../lib/scanner.ts';
import { auditClaudeMd } from '../../lib/auditor.ts';
import { generateContextPack } from '../../lib/generator.ts';
import { checkDrift, createDriftEvent } from '../../lib/drift.ts';
import {
  getProjectByPath, saveProject, saveScan,
  listScans, generateId,
} from '../../lib/storage.ts';
import type { Project, Scan } from '../../lib/types.ts';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const program = new Command();

program
  .name('repomemory')
  .description('Scan, audit, and generate AI context files for any repository')
  .version('0.1.0');

// ── scan ───────────────────────────────────────────────────

program
  .command('scan')
  .description('Scan a repo folder and return audit score')
  .argument('<path>', 'Path to the repository folder')
  .option('--json', 'Output as JSON')
  .action(async (folderPath: string, options: { json?: boolean }) => {
    try {
      console.error(`Scanning ${folderPath}...`);
      const snapshot = await scanRepository(folderPath);
      const audit = auditClaudeMd(snapshot.existingClaudeMd, snapshot);

      // Persist
      let project = getProjectByPath(folderPath);
      if (!project) {
        project = {
          id: generateId(), folderPath, repoName: snapshot.repoName,
          language: snapshot.language, framework: snapshot.framework,
          lastScore: audit.totalScore, lastScanAt: snapshot.scannedAt,
          createdAt: new Date().toISOString(),
        };
      } else {
        project.lastScore = audit.totalScore;
        project.lastScanAt = snapshot.scannedAt;
      }
      saveProject(project);

      const scan: Scan = {
        id: generateId(), projectId: project.id,
        snapshot, audit, generatedFiles: [], driftEvents: [],
        createdAt: snapshot.scannedAt,
      };
      saveScan(scan);

      if (options.json) {
        console.log(JSON.stringify({
          repoName: snapshot.repoName,
          language: snapshot.language,
          framework: snapshot.framework,
          fileCount: snapshot.fileCount,
          totalScore: audit.totalScore,
          badge: audit.badge,
          dimensions: audit.dimensions,
          summary: audit.summary,
          scanId: scan.id,
        }, null, 2));
      } else {
        console.log(`\n  ${snapshot.repoName}`);
        console.log(`  ${snapshot.language}${snapshot.framework !== 'None' && snapshot.framework !== 'Unknown' ? ` / ${snapshot.framework}` : ''}`);
        console.log(`  ${snapshot.fileCount} files, ${(snapshot.totalSizeBytes / 1024 / 1024).toFixed(1)} MB`);
        console.log(`\n  Score: ${audit.totalScore}/100 — ${audit.badge}`);
        console.log('');
        audit.dimensions.forEach((d) => {
          const bar = '█'.repeat(Math.round(d.score / d.maxScore * 10)) + '░'.repeat(10 - Math.round(d.score / d.maxScore * 10));
          console.log(`  ${d.name.padEnd(14)} ${d.score.toString().padStart(2)}/${d.maxScore.toString().padStart(2)}  ${bar}`);
        });
        console.log(`\n  ${audit.summary}\n`);
      }
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── generate ───────────────────────────────────────────────

program
  .command('generate')
  .description('Generate AI context files for a repo')
  .argument('<path>', 'Path to the repository folder')
  .option('--apply', 'Write files directly to the repo')
  .option('--model <model>', 'AI model override')
  .option('--json', 'Output as JSON')
  .action(async (folderPath: string, options: { apply?: boolean; model?: string; json?: boolean }) => {
    try {
      console.error(`Scanning ${folderPath}...`);
      const snapshot = await scanRepository(folderPath);
      const audit = auditClaudeMd(snapshot.existingClaudeMd, snapshot);
      console.error(`Score: ${audit.totalScore}/100. Generating context pack...`);

      const opts = options.model ? { claudeMdModel: options.model } : {};
      const files = await generateContextPack(snapshot, opts);

      if (options.apply) {
        for (const file of files) {
          const fullPath = join(folderPath, file.fileName);
          mkdirSync(dirname(fullPath), { recursive: true });
          writeFileSync(fullPath, file.content, 'utf-8');
          console.log(`  ✓ ${file.fileName}`);
        }
        console.log(`\n  Written ${files.length} files to ${folderPath}`);
      } else if (options.json) {
        console.log(JSON.stringify({
          repoName: snapshot.repoName,
          files: files.reduce((acc, f) => { acc[f.fileName] = f.content; return acc; }, {} as Record<string, string>),
        }, null, 2));
      } else {
        console.log(`\n  Generated ${files.length} files:\n`);
        files.forEach((f) => {
          console.log(`  ── ${f.fileName} ──`);
          console.log(f.content.slice(0, 300) + (f.content.length > 300 ? '\n  ...' : ''));
          console.log('');
        });
        console.log(`  Use --apply to write these files directly to the repo.\n`);
      }
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── check (drift) ──────────────────────────────────────────

program
  .command('check')
  .description('Check a repo for drift since last scan')
  .argument('<path>', 'Path to the repository folder')
  .option('--json', 'Output as JSON')
  .action(async (folderPath: string, options: { json?: boolean }) => {
    try {
      const current = await scanRepository(folderPath);
      const project = getProjectByPath(folderPath);

      if (!project) {
        console.log('No previous scan found. Run `repomemory scan` first.');
        process.exit(0);
      }

      const previousScans = listScans(project.id);
      if (previousScans.length === 0) {
        console.log('No previous scan data found.');
        process.exit(0);
      }

      const result = checkDrift(current, previousScans[0].snapshot);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.hasDrift) {
        console.log('\n  ⚠ Drift detected!\n');
        result.staleContextFiles.forEach((f) => console.log(`  • ${f}`));
        console.log('');
        result.changedFiles.slice(0, 10).forEach((f) => {
          const icon = f.change === 'added' ? '+' : f.change === 'deleted' ? '-' : '~';
          console.log(`  ${icon} ${f.path}`);
        });
        if (result.changedFiles.length > 10) {
          console.log(`  ...and ${result.changedFiles.length - 10} more`);
        }
        console.log('');
      } else {
        console.log('\n  ✓ No drift detected.\n');
      }
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── Install npm packages warning ──────────────────────────

program.hook('preAction', () => {
  if (!process.env.AI_PROVIDER_API_KEY) {
    console.warn('⚠ AI_PROVIDER_API_KEY not set. Generation commands will fail.');
    console.warn('  Set it in .env.local or export AI_PROVIDER_API_KEY=your_key\n');
  }
});

program.parse();
