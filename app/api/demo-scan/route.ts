// GET /api/demo-scan — Returns mock scan data for the live demo

import { NextResponse } from 'next/server';
import { generateId } from '@/lib/storage';
import type { ApiResponse } from '@/lib/types';

export async function GET() {
  const now = new Date().toISOString();
  const scanId = generateId();
  const projectId = generateId();

  const demo = {
    project: {
      id: projectId,
      folderPath: '/demo/nextjs-blog-starter',
      repoName: 'nextjs-blog-starter',
      language: 'TypeScript' as const,
      framework: 'Next.js' as const,
      lastScore: 72,
      lastScanAt: now,
      createdAt: now,
    },
    scan: {
      id: scanId,
      projectId,
      snapshot: {
        folderPath: '/demo/nextjs-blog-starter',
        repoName: 'nextjs-blog-starter',
        language: 'TypeScript' as const,
        framework: 'Next.js' as const,
        fileCount: 87,
        totalSizeBytes: 2450000,
        topFiles: ['package.json', 'tsconfig.json', 'next.config.js', 'app/page.tsx', 'app/layout.tsx', 'components/Header.tsx', 'lib/posts.ts', 'lib/markdown.ts'],
        noisyDirs: ['node_modules', '.next', 'out'],
        existingClaudeMd: '# Blog Starter\n\n## Architecture\nUses Next.js 15 App Router with src/ directory.\n\n## Commands\n- dev: npm run dev\n- build: npm run build\n- start: npm start\n\n## Testing\nRun tests with vitest.',
        existingClaudeIgnore: null,
        existingCommands: [],
        existingContextFiles: [
          { agentType: 'claude' as const, fileName: 'CLAUDE.md', content: '# Blog Starter\n\n## Architecture\nUses Next.js 15 App Router.\n\n## Commands\n- dev: npm run dev\n- build: npm run build' },
        ],
        fileTreeHashes: [
          { path: 'package.json', hash: 'abc123', lastModified: Date.now() },
          { path: 'tsconfig.json', hash: 'def456', lastModified: Date.now() },
          { path: 'app/page.tsx', hash: 'ghi789', lastModified: Date.now() },
        ],
        keyFiles: {
          packageJson: {
            name: 'nextjs-blog-starter',
            scripts: { dev: 'next dev', build: 'next build', start: 'next start', lint: 'next lint' },
            dependencies: { next: '^15.0.0', react: '^19.0.0', 'react-dom': '^19.0.0' },
            devDependencies: { typescript: '^5.0.0', vitest: '^2.0.0', eslint: '^9.0.0' },
          },
          dockerFile: null,
          ciConfig: '.github/workflows/ci.yml',
          envExample: '# Environment Variables\nDATABASE_URL=\nNEXT_PUBLIC_API_KEY=\n',
        },
        scannedAt: now,
      },
      audit: {
        totalScore: 72,
        dimensions: [
          { name: 'Architecture', maxScore: 15, score: 12, reason: 'architecture well documented; references key files', suggestions: ['Add service layer documentation'] },
          { name: 'Commands', maxScore: 20, score: 17, reason: 'commands well documented', suggestions: ['Add format command'] },
          { name: 'Conventions', maxScore: 15, score: 8, reason: 'no naming conventions documented', suggestions: ['Add TypeScript naming conventions section'] },
          { name: 'Off-limits', maxScore: 15, score: 10, reason: 'off-limits partially covered', suggestions: ['Add .next directory to off-limits'] },
          { name: 'Testing', maxScore: 15, score: 9, reason: 'testing workflow mentioned but incomplete', suggestions: ['Add test file location patterns'] },
          { name: 'Deployment', maxScore: 10, score: 6, reason: 'deployment mentioned', suggestions: ['Add Vercel deployment instructions'] },
          { name: 'Freshness', maxScore: 10, score: 10, reason: 'freshness looks good', suggestions: [] },
        ],
        summary: 'CLAUDE.md scores 72/100 (good). Strong in: Architecture, Commands. Improve: Conventions, Testing.',
        badge: 'good' as const,
        agentAudits: [
          { agentType: 'claude' as const, agentName: 'Claude', totalScore: 72, dimensions: [], badge: 'good' as const, summary: '' },
          { agentType: 'cursor' as const, agentName: 'Cursor', totalScore: 0, dimensions: [], badge: 'critical' as const, summary: '' },
          { agentType: 'gemini' as const, agentName: 'Gemini', totalScore: 0, dimensions: [], badge: 'critical' as const, summary: '' },
        ],
      },
      generatedFiles: [],
      driftEvents: [],
      createdAt: now,
    },
  };

  return NextResponse.json<ApiResponse<typeof demo>>({
    ok: true,
    data: demo,
  });
}
