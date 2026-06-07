import { describe, it, expect } from 'vitest';
import { checkDrift, createDriftEvent } from '../lib/drift';
import type { ProjectSnapshot } from '../lib/types';

const BASE_SNAPSHOT: ProjectSnapshot = {
  folderPath: '/test/repo',
  repoName: 'test-repo',
  language: 'TypeScript',
  framework: 'Next.js',
  fileCount: 50,
  totalSizeBytes: 1000000,
  topFiles: ['src/index.ts', 'package.json'],
  noisyDirs: ['node_modules'],
  existingContextFiles: [],
  existingClaudeMd: null,
  existingClaudeIgnore: null,
  existingCommands: [],
  fileTreeHashes: [
    { path: 'package.json', hash: 'abc123', lastModified: 1000 },
    { path: 'src/index.ts', hash: 'def456', lastModified: 1000 },
    { path: 'README.md', hash: 'ghi789', lastModified: 1000 },
  ],
  keyFiles: {
    packageJson: { name: 'test' },
    dockerFile: null,
    ciConfig: null,
    envExample: null,
  },
  scannedAt: '2026-01-01T00:00:00.000Z',
};

describe('checkDrift', () => {
  it('returns no drift when snapshots are identical', () => {
    const result = checkDrift(BASE_SNAPSHOT, BASE_SNAPSHOT);
    expect(result.hasDrift).toBe(false);
    expect(result.changedFiles).toHaveLength(0);
    expect(result.staleContextFiles).toHaveLength(0);
  });

  it('detects modified files', () => {
    const current: ProjectSnapshot = {
      ...BASE_SNAPSHOT,
      fileTreeHashes: [
        { path: 'package.json', hash: 'xyz999', lastModified: 2000 },
        { path: 'src/index.ts', hash: 'def456', lastModified: 1000 },
        { path: 'README.md', hash: 'ghi789', lastModified: 1000 },
      ],
    };
    const result = checkDrift(current, BASE_SNAPSHOT);
    expect(result.hasDrift).toBe(true);
    expect(result.changedFiles).toHaveLength(1);
    expect(result.changedFiles[0].path).toBe('package.json');
    expect(result.changedFiles[0].change).toBe('modified');
  });

  it('detects added files', () => {
    const current: ProjectSnapshot = {
      ...BASE_SNAPSHOT,
      fileTreeHashes: [
        ...BASE_SNAPSHOT.fileTreeHashes,
        { path: 'new-file.ts', hash: 'new123', lastModified: 2000 },
      ],
    };
    const result = checkDrift(current, BASE_SNAPSHOT);
    expect(result.hasDrift).toBe(false); // new file alone doesn't trigger drift
    expect(result.changedFiles).toHaveLength(1);
    expect(result.changedFiles[0].change).toBe('added');
  });

  it('detects deleted files', () => {
    const current: ProjectSnapshot = {
      ...BASE_SNAPSHOT,
      fileTreeHashes: BASE_SNAPSHOT.fileTreeHashes.slice(0, 2),
    };
    const result = checkDrift(current, BASE_SNAPSHOT);
    expect(result.changedFiles).toHaveLength(1);
    expect(result.changedFiles[0].change).toBe('deleted');
  });

  it('flags stale context files when package.json changes', () => {
    const current: ProjectSnapshot = {
      ...BASE_SNAPSHOT,
      fileTreeHashes: [
        { path: 'package.json', hash: 'changed', lastModified: 2000 },
        { path: 'src/index.ts', hash: 'def456', lastModified: 1000 },
        { path: 'README.md', hash: 'ghi789', lastModified: 1000 },
      ],
    };
    const result = checkDrift(current, BASE_SNAPSHOT);
    expect(result.hasDrift).toBe(true);
    expect(result.staleContextFiles.length).toBeGreaterThan(0);
    expect(
      result.staleContextFiles.some((f) => f.includes('Commands'))
    ).toBe(true);
  });

  it('flags stale context when Dockerfile changes', () => {
    const prevSnapshot: ProjectSnapshot = {
      ...BASE_SNAPSHOT,
      fileTreeHashes: [
        { path: 'Dockerfile', hash: 'old_hash', lastModified: 1000 },
      ],
      keyFiles: { ...BASE_SNAPSHOT.keyFiles, dockerFile: 'FROM node:18' },
    };
    const currentSnapshot: ProjectSnapshot = {
      ...prevSnapshot,
      fileTreeHashes: [
        { path: 'Dockerfile', hash: 'new_hash', lastModified: 2000 },
      ],
      keyFiles: { ...prevSnapshot.keyFiles, dockerFile: 'FROM node:20' },
    };
    const result = checkDrift(currentSnapshot, prevSnapshot);
    expect(result.hasDrift).toBe(true);
    expect(
      result.staleContextFiles.some((f) => f.includes('Deployment'))
    ).toBe(true);
  });

  it('detects no drift for non-critical file changes', () => {
    const current: ProjectSnapshot = {
      ...BASE_SNAPSHOT,
      fileTreeHashes: [
        ...BASE_SNAPSHOT.fileTreeHashes,
        { path: 'README.md', hash: 'updated', lastModified: 2000 },
      ],
    };
    // Same file, just updated content — not a critical change
    const result = checkDrift(current, {
      ...BASE_SNAPSHOT,
      fileTreeHashes: [
        { path: 'package.json', hash: 'abc123', lastModified: 1000 },
        { path: 'src/index.ts', hash: 'def456', lastModified: 1000 },
        { path: 'README.md', hash: 'original', lastModified: 1000 },
      ],
    });
    expect(result.changedFiles).toHaveLength(1);
    expect(result.changedFiles[0].path).toBe('README.md');
  });
});

describe('createDriftEvent', () => {
  it('creates a drift event with required fields', () => {
    const driftResult = {
      hasDrift: true,
      changedFiles: [{ path: 'package.json', change: 'modified' as const }],
      staleContextFiles: ['CLAUDE.md (Commands section)'],
    };
    const event = createDriftEvent('project-123', driftResult);
    expect(event.id).toBeDefined();
    expect(event.projectId).toBe('project-123');
    expect(event.changedFiles).toHaveLength(1);
    expect(event.staleContextFiles).toHaveLength(1);
    expect(event.resolved).toBe(false);
    expect(event.detectedAt).toBeDefined();
  });
});
