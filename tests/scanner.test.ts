import { describe, it, expect } from 'vitest';
import { scanRepository } from '../lib/scanner';
import path from 'path';

const FIXTURE_PATH = path.resolve(__dirname, 'fixtures', 'sample-repo');

describe('scanRepository', () => {
  it('scans a real repo and returns a snapshot', async () => {
    const result = await scanRepository(FIXTURE_PATH);
    expect(result.repoName).toBe('sample-repo');
    expect(result.language).toBe('TypeScript');
    expect(result.framework).toBe('Next.js');
    expect(result.fileCount).toBeGreaterThan(0);
    expect(result.totalSizeBytes).toBeGreaterThan(0);
    expect(result.folderPath).toBe(FIXTURE_PATH);
  });

  it('detects existing CLAUDE.md content', async () => {
    const result = await scanRepository(FIXTURE_PATH);
    expect(result.existingClaudeMd).not.toBeNull();
    expect(result.existingClaudeMd).toContain('Architecture');
  });

  it('detects noisy directories', async () => {
    const result = await scanRepository(FIXTURE_PATH);
    expect(Array.isArray(result.noisyDirs)).toBe(true);
  });

  it('extracts package.json key files', async () => {
    const result = await scanRepository(FIXTURE_PATH);
    expect(result.keyFiles.packageJson).not.toBeNull();
    expect(result.keyFiles.packageJson).toHaveProperty('name', 'sample-repo');
  });

  it('hashes key files correctly', async () => {
    const result = await scanRepository(FIXTURE_PATH);
    expect(result.fileTreeHashes.length).toBeGreaterThan(0);
    const pkgHash = result.fileTreeHashes.find((f) => f.path === 'package.json');
    expect(pkgHash).toBeDefined();
    expect(pkgHash!.hash).toBeDefined();
    expect(pkgHash!.hash.length).toBeGreaterThan(0);
    expect(pkgHash!.lastModified).toBeGreaterThan(0);
  });

  it('throws on non-existent path', async () => {
    await expect(
      scanRepository('/nonexistent/path/that/definitely/does/not/exist')
    ).rejects.toThrow();
  });

  it('returns top files sorted by size', async () => {
    const result = await scanRepository(FIXTURE_PATH);
    expect(result.topFiles.length).toBeGreaterThan(0);
  });

  it('returns scannedAt as valid ISO datetime', async () => {
    const result = await scanRepository(FIXTURE_PATH);
    expect(() => new Date(result.scannedAt)).not.toThrow();
    expect(new Date(result.scannedAt).toISOString()).toBe(result.scannedAt);
  });
});
