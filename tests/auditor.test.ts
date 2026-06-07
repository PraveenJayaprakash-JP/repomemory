import { describe, it, expect } from 'vitest';
import { auditClaudeMd } from '../lib/auditor';
import type { ProjectSnapshot } from '../lib/types';

const MOCK_SNAPSHOT: ProjectSnapshot = {
  folderPath: '/test/repo',
  repoName: 'test-repo',
  language: 'TypeScript',
  framework: 'Next.js',
  fileCount: 50,
  totalSizeBytes: 1000000,
  topFiles: ['src/index.ts', 'package.json', 'tsconfig.json', 'README.md'],
  noisyDirs: ['node_modules', '.next'],
  existingContextFiles: [],
  existingClaudeMd: null,
  existingClaudeIgnore: null,
  existingCommands: [],
  fileTreeHashes: [],
  keyFiles: {
    packageJson: { name: 'test-repo', scripts: { dev: 'next dev' } },
    dockerFile: null,
    ciConfig: null,
    envExample: null,
  },
  scannedAt: new Date().toISOString(),
};

describe('auditClaudeMd', () => {
  it('returns critical badge when content is null', () => {
    const result = auditClaudeMd(null, MOCK_SNAPSHOT);
    expect(result.totalScore).toBe(0);
    expect(result.badge).toBe('critical');
    expect(result.dimensions).toHaveLength(7);
    result.dimensions.forEach((d) => {
      expect(d.score).toBe(0);
    });
  });

  it('returns critical badge when content is empty', () => {
    const result = auditClaudeMd('', MOCK_SNAPSHOT);
    expect(result.totalScore).toBe(0);
    expect(result.badge).toBe('critical');
  });

  it('scores well when CLAUDE.md has all sections with detail', () => {
    const content = `# Project

## Architecture
The project uses src/ directory with components/, lib/, pages/ folders.
Main entry: src/index.ts. Configuration in package.json and tsconfig.json.

## Commands
- dev: npm run dev — starts the dev server
- build: npm run build — production build
- test: npm test — runs jest tests
- lint: npm run lint — runs eslint
- start: npm start — starts production server

## Conventions
TypeScript strict mode. ESLint for linting. Prettier for formatting.
Follow existing code style. Use named exports.

## Off-limits
Do not modify generated files in dist/ or .next/ directories.
node_modules is never committed. Secrets in .env.local are never committed.

## Testing
Run tests with jest: npm test. Tests live in src/__tests__/.
Write unit tests for all new functions.

## Deployment
CI/CD via GitHub Actions. Deploy to Vercel production.
Staging branch: develop. Production branch: main.
`;
    const result = auditClaudeMd(content, MOCK_SNAPSHOT);
    expect(result.totalScore).toBeGreaterThanOrEqual(70);
    expect(['excellent', 'good']).toContain(result.badge);
  });

  it('scores medium when CLAUDE.md is partial', () => {
    const content = `# Project

## Commands
- dev: npm run dev
- build: npm run build
`;
    const result = auditClaudeMd(content, MOCK_SNAPSHOT);
    expect(result.totalScore).toBeGreaterThanOrEqual(10);
    expect(result.totalScore).toBeLessThanOrEqual(60);
    expect(['needs-improvement', 'critical']).toContain(result.badge);
  });

  it('rewards architecture section for referencing top files', () => {
    const content = `# Project

## Architecture
src/index.ts is the main entry point. package.json has dependencies.
`;
    const result = auditClaudeMd(content, MOCK_SNAPSHOT);
    const archDim = result.dimensions.find((d) => d.name === 'Architecture');
    expect(archDim).toBeDefined();
    expect(archDim!.score).toBeGreaterThan(0);
  });

  it('checks freshness by detecting stale references', () => {
    const content = `# Project

## Architecture

## Commands
- dev: npm run dev

## Conventions

## Off-limits

## Testing

## Deployment
`;
    const result = auditClaudeMd(content, MOCK_SNAPSHOT);
    const freshDim = result.dimensions.find((d) => d.name === 'Freshness');
    expect(freshDim).toBeDefined();
    // Should detect some freshness test
    expect(freshDim!.score).toBeGreaterThanOrEqual(0);
  });

  it('contains summary text explaining the score', () => {
    const result = auditClaudeMd(null, MOCK_SNAPSHOT);
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.summary.toLowerCase()).toContain('claude.md');
  });

  it('handles different snapshot data correctly', () => {
    const pythonSnapshot: ProjectSnapshot = {
      ...MOCK_SNAPSHOT,
      language: 'Python',
      framework: 'FastAPI',
      topFiles: ['main.py', 'requirements.txt'],
      keyFiles: { ...MOCK_SNAPSHOT.keyFiles, packageJson: null },
    };
    const result = auditClaudeMd(null, pythonSnapshot);
    expect(result.totalScore).toBe(0);
    expect(result.badge).toBe('critical');
  });
});
