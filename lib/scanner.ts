// RepoMemory — Repository scanner
// Walks local directory, extracts metadata, detects language/framework,
// reads existing AI context files, hashes key files for drift detection

import { readFile, stat, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import fg from 'fast-glob';
import { createHash } from 'crypto';
import type {
  ProjectSnapshot,
  DetectedLanguage,
  DetectedFramework,
  FileTreeHash,
  AgentContextFile,
  AgentType,
} from './types';

// ─── Constants ────────────────────────────────────────────

const NOISY_DIRS = [
  'node_modules',
  '.git',
  'dist',
  '__pycache__',
  'venv',
  '.next',
  'coverage',
  '.nuxt',
  '.output',
  'build',
  '.turbo',
  '.cache',
  '.vercel',
  '.repomemory',
];

const DEFAULT_GLOB_IGNORE = NOISY_DIRS.map(d => `**/${d}/**`);

const KEY_FILE_PATTERNS = [
  'package.json',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.github/workflows/*.yml',
  '.github/workflows/*.yaml',
  '.gitlab-ci.yml',
  '.env.example',
  '.env.sample',
  'tsconfig.json',
  'Cargo.toml',
  'go.mod',
  'pyproject.toml',
  'requirements.txt',
  'Gemfile',
  'pom.xml',
  'build.gradle',
  'composer.json',
];

const LANGUAGE_MARKERS: Record<string, DetectedLanguage> = {
  'tsconfig.json': 'TypeScript',
  'package.json': 'JavaScript', // upgraded to TypeScript if tsconfig present
  'pyproject.toml': 'Python',
  'requirements.txt': 'Python',
  'setup.py': 'Python',
  'Pipfile': 'Python',
  'Cargo.toml': 'Rust',
  'go.mod': 'Go',
  'pom.xml': 'Java',
  'build.gradle': 'Java',
  'build.gradle.kts': 'Kotlin',
  'Gemfile': 'Ruby',
  'composer.json': 'PHP',
  '*.csproj': 'C#',
  'CMakeLists.txt': 'C++',
  'Makefile': 'C',
};

const FRAMEWORK_DETECTORS: Record<string, DetectedFramework> = {
  next: 'Next.js',
  react: 'React',
  vue: 'Vue',
  '@angular/core': 'Angular',
  '@sveltejs/kit': 'Svelte',
  express: 'Express',
  '@nestjs/core': 'NestJS',
  fastapi: 'FastAPI',
  django: 'Django',
  flask: 'Flask',
  '@tauri-apps/api': 'Tauri',
  electron: 'Electron',
  rails: 'Rails',
  laravel: 'Laravel',
  '@spring/boot': 'Spring Boot',
};

// ─── Helpers ──────────────────────────────────────────────

async function hashFileContent(content: string): Promise<string> {
  return createHash('sha256').update(content).digest('hex');
}

async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

async function safeReadJson<T>(filePath: string): Promise<T | null> {
  const raw = await safeReadFile(filePath);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function extractRepoName(folderPath: string): string {
  return basename(folderPath);
}

// ─── Language Detection ───────────────────────────────────

async function detectLanguage(folderPath: string): Promise<DetectedLanguage> {
  // Check for TypeScript first (has both package.json and tsconfig.json)
  const hasTsconfig = existsSync(join(folderPath, 'tsconfig.json'));
  const hasPackageJson = existsSync(join(folderPath, 'package.json'));

  if (hasPackageJson && hasTsconfig) return 'TypeScript';
  if (hasPackageJson && !hasTsconfig) return 'JavaScript';

  // Check other language markers in priority order
  const markerEntries = Object.entries(LANGUAGE_MARKERS);
  for (const [marker, lang] of markerEntries) {
    if (marker === 'package.json' || marker === 'tsconfig.json') continue; // handled above
    if (existsSync(join(folderPath, marker))) return lang;
  }

  // Fallback: scan file extensions
  try {
    const files = await fg('**/*', {
      cwd: folderPath,
      ignore: DEFAULT_GLOB_IGNORE,
      onlyFiles: true,
      deep: 2,
    });

    const extCounts: Record<string, number> = {};
    for (const f of files) {
      const ext = f.split('.').pop()?.toLowerCase() ?? '';
      extCounts[ext] = (extCounts[ext] ?? 0) + 1;
    }

    if ((extCounts['ts'] ?? 0) > 0 || (extCounts['tsx'] ?? 0) > 0) return 'TypeScript';
    if ((extCounts['js'] ?? 0) > 0 || (extCounts['jsx'] ?? 0) > 0) return 'JavaScript';
    if ((extCounts['py'] ?? 0) > 0) return 'Python';
    if ((extCounts['rs'] ?? 0) > 0) return 'Rust';
    if ((extCounts['go'] ?? 0) > 0) return 'Go';
    if ((extCounts['java'] ?? 0) > 0) return 'Java';
    if ((extCounts['kt'] ?? 0) > 0) return 'Kotlin';
    if ((extCounts['rb'] ?? 0) > 0) return 'Ruby';
    if ((extCounts['php'] ?? 0) > 0) return 'PHP';
    if ((extCounts['cs'] ?? 0) > 0) return 'C#';
    if ((extCounts['cpp'] ?? 0) > 0 || (extCounts['hpp'] ?? 0) > 0) return 'C++';
    if ((extCounts['c'] ?? 0) > 0) return 'C';
    if ((extCounts['sh'] ?? 0) > 0 || (extCounts['bash'] ?? 0) > 0) return 'Shell';
  } catch {
    // glob failed, fall through
  }

  return 'Unknown';
}

// ─── Framework Detection ──────────────────────────────────

async function detectFramework(
  folderPath: string,
  language: DetectedLanguage
): Promise<DetectedFramework> {
  // Python frameworks
  if (language === 'Python') {
    const requirements = await safeReadFile(join(folderPath, 'requirements.txt'));
    const pyproject = await safeReadFile(join(folderPath, 'pyproject.toml'));
    const combined = [requirements, pyproject].filter(Boolean).join('\n');

    if (combined.includes('fastapi')) return 'FastAPI';
    if (combined.includes('django')) return 'Django';
    if (combined.includes('flask')) return 'Flask';
  }

  // Ruby frameworks
  if (language === 'Ruby') {
    const gemfile = await safeReadFile(join(folderPath, 'Gemfile'));
    if (gemfile?.includes('rails')) return 'Rails';
  }

  // PHP frameworks
  if (language === 'PHP') {
    const composer = await safeReadJson<Record<string, unknown>>(join(folderPath, 'composer.json'));
    if (composer) {
      const requires = composer['require'] as Record<string, string> | undefined;
      if (requires?.['laravel/framework']) return 'Laravel';
    }
  }

  // Java/Kotlin frameworks
  if (language === 'Java' || language === 'Kotlin') {
    const buildGradle = await safeReadFile(join(folderPath, 'build.gradle'));
    const buildGradleKts = await safeReadFile(join(folderPath, 'build.gradle.kts'));
    const pomXml = await safeReadFile(join(folderPath, 'pom.xml'));
    const combined = [buildGradle, buildGradleKts, pomXml].filter(Boolean).join('\n');

    if (combined.includes('spring-boot')) return 'Spring Boot';
  }

  // C# frameworks
  if (language === 'C#') {
    const csproj = await safeReadFile(join(folderPath, '*.csproj'));
    if (csproj?.includes('Microsoft.AspNetCore')) return 'ASP.NET';
  }

  // JS/TS frameworks — check package.json dependencies
  if (language === 'TypeScript' || language === 'JavaScript') {
    const pkg = await safeReadJson<Record<string, unknown>>(join(folderPath, 'package.json'));
    if (pkg) {
      const deps = {
        ...(pkg['dependencies'] as Record<string, string> ?? {}),
        ...(pkg['devDependencies'] as Record<string, string> ?? {}),
      };

      // Check in priority order (more specific first)
      for (const [depName, framework] of Object.entries(FRAMEWORK_DETECTORS)) {
        if (depName in deps) return framework;
      }
    }
  }

  // Rust frameworks — check Cargo.toml
  if (language === 'Rust') {
    const cargo = await safeReadFile(join(folderPath, 'Cargo.toml'));
    if (cargo?.includes('tauri')) return 'Tauri';
  }

  // Check for Dockerfile-based detection
  if (existsSync(join(folderPath, 'Dockerfile'))) {
    // If language is Shell or Unknown but has Dockerfile
    if (language === 'Shell' || language === 'Unknown') return 'None';
  }

  return 'Unknown';
}

// ─── Agent Context File Definitions ────────────────────────

const AGENT_CONTEXT_FILES: Array<{ agentType: AgentType; fileName: string; path: string[] }> = [
  { agentType: 'claude', fileName: 'CLAUDE.md', path: ['.'] },
  { agentType: 'opencode', fileName: 'AGENTS.md', path: ['.'] },
  { agentType: 'gemini', fileName: 'GEMINI.md', path: ['.'] },
  { agentType: 'aider', fileName: 'AIDER.md', path: ['.'] },
  { agentType: 'cursor', fileName: 'rules.mdc', path: ['.cursor'] },
  { agentType: 'cursor', fileName: 'context.md', path: ['.cursor'] },
  { agentType: 'windsurf', fileName: 'rules.md', path: ['.windsurf'] },
  { agentType: 'windsurf', fileName: 'context.md', path: ['.windsurf'] },
  { agentType: 'opencode', fileName: 'instructions.md', path: ['.opencode'] },
];

// ─── Existing AI Context Files ────────────────────────────

async function readExistingContext(folderPath: string): Promise<{
  claudeMd: string | null;
  claudeIgnore: string | null;
  commands: string[];
  contextFiles: AgentContextFile[];
}> {
  const [claudeMd, claudeIgnore] = await Promise.all([
    safeReadFile(join(folderPath, 'CLAUDE.md')),
    safeReadFile(join(folderPath, '.claudeignore')),
  ]);

  let commands: string[] = [];
  const commandsDir = join(folderPath, '.claude', 'commands');
  if (existsSync(commandsDir)) {
    try {
      const entries = await readdir(commandsDir);
      commands = entries.filter(e => e.endsWith('.md'));
    } catch {
      commands = [];
    }
  }

  // Detect all agent context files
  const contextFiles: AgentContextFile[] = [];
  for (const def of AGENT_CONTEXT_FILES) {
    const filePath = join(folderPath, ...def.path, def.fileName);
    if (existsSync(filePath)) {
      const content = await safeReadFile(filePath);
      // Only add if not already present (same agentType + fileName combo)
      const alreadyAdded = contextFiles.some(
        (f) => f.agentType === def.agentType && f.fileName === def.fileName
      );
      if (!alreadyAdded) {
        contextFiles.push({
          agentType: def.agentType,
          fileName: def.fileName,
          content,
        });
      }
    }
  }

  return { claudeMd, claudeIgnore, commands, contextFiles };
}

// ─── Key Files ───────────────────────────────────────────

async function readKeyFiles(folderPath: string): Promise<ProjectSnapshot['keyFiles']> {
  const [packageJson, dockerFile, ciConfig, envExample] = await Promise.all([
    safeReadJson<Record<string, unknown>>(join(folderPath, 'package.json')),
    safeReadFile(join(folderPath, 'Dockerfile')),
    readCiConfig(folderPath),
    safeReadFile(join(folderPath, '.env.example')) ??
      safeReadFile(join(folderPath, '.env.sample')),
  ]);

  return { packageJson, dockerFile, ciConfig, envExample };
}

async function readCiConfig(folderPath: string): Promise<string | null> {
  // GitHub Actions
  const ghWorkflows = join(folderPath, '.github', 'workflows');
  if (existsSync(ghWorkflows)) {
    try {
      const files = await readdir(ghWorkflows);
      const ymlFile = files.find(f => f.endsWith('.yml') || f.endsWith('.yaml'));
      if (ymlFile) {
        return await safeReadFile(join(ghWorkflows, ymlFile));
      }
    } catch { /* fall through */ }
  }

  // GitLab CI
  const gitlabCi = await safeReadFile(join(folderPath, '.gitlab-ci.yml'));
  if (gitlabCi) return gitlabCi;

  // CircleCI
  const circleConfig = await safeReadFile(join(folderPath, '.circleci', 'config.yml'));
  if (circleConfig) return circleConfig;

  return null;
}

// ─── File Tree Hashing ────────────────────────────────────

async function hashKeyFiles(folderPath: string): Promise<FileTreeHash[]> {
  const hashes: FileTreeHash[] = [];

  for (const pattern of KEY_FILE_PATTERNS) {
    const matches = await fg(pattern, {
      cwd: folderPath,
      ignore: DEFAULT_GLOB_IGNORE,
      onlyFiles: true,
      deep: 5,
    });

    for (const relPath of matches) {
      const fullPath = join(folderPath, relPath);
      const content = await safeReadFile(fullPath);
      if (content === null) continue;

      let lastModified: number;
      try {
        const stats = await stat(fullPath);
        lastModified = stats.mtimeMs;
      } catch {
        lastModified = Date.now();
      }

      hashes.push({
        path: relPath,
        hash: await hashFileContent(content),
        lastModified,
      });
    }
  }

  return hashes;
}

// ─── Directory Stats ──────────────────────────────────────

async function gatherDirectoryStats(folderPath: string): Promise<{
  fileCount: number;
  totalSizeBytes: number;
  topFiles: string[];
  noisyDirs: string[];
}> {
  const allFiles = await fg('**/*', {
    cwd: folderPath,
    ignore: DEFAULT_GLOB_IGNORE,
    onlyFiles: true,
    deep: 10,
    stats: true,
  });

  let totalSizeBytes = 0;
  const fileSizes: Array<{ path: string; size: number }> = [];

  for (const entry of allFiles) {
    const size = (entry as fg.Entry).stats?.size ?? 0;
    totalSizeBytes += size;
    fileSizes.push({ path: entry.path ?? String(entry), size });
  }

  // Top files by size (max 20)
  const topFiles = fileSizes
    .sort((a, b) => b.size - a.size)
    .slice(0, 20)
    .map(f => f.path);

  // Detect which noisy dirs actually exist
  const noisyDirs: string[] = [];
  for (const dir of NOISY_DIRS) {
    if (existsSync(join(folderPath, dir))) {
      noisyDirs.push(dir);
    }
  }

  return {
    fileCount: allFiles.length,
    totalSizeBytes,
    topFiles,
    noisyDirs,
  };
}

// ─── Main Scanner ─────────────────────────────────────────

export async function scanRepository(folderPath: string): Promise<ProjectSnapshot> {
  // Validate folder exists
  if (!existsSync(folderPath)) {
    throw new Error(`Repository folder does not exist: ${folderPath}`);
  }

  // Verify it's a directory
  let pathStat;
  try {
    pathStat = await stat(folderPath);
  } catch {
    throw new Error(`Cannot stat path: ${folderPath}`);
  }
  if (!pathStat.isDirectory()) {
    throw new Error(`Path is not a directory: ${folderPath}`);
  }

  // Run all detection in parallel where possible
  const language = await detectLanguage(folderPath);
  const [framework, context, keyFiles, fileHashes, dirStats] = await Promise.all([
    detectFramework(folderPath, language),
    readExistingContext(folderPath),
    readKeyFiles(folderPath),
    hashKeyFiles(folderPath),
    gatherDirectoryStats(folderPath),
  ]);

  const snapshot: ProjectSnapshot = {
    folderPath,
    repoName: extractRepoName(folderPath),
    language,
    framework,
    fileCount: dirStats.fileCount,
    totalSizeBytes: dirStats.totalSizeBytes,
    topFiles: dirStats.topFiles,
    noisyDirs: dirStats.noisyDirs,
    existingContextFiles: context.contextFiles,
    existingClaudeMd: context.claudeMd,
    existingClaudeIgnore: context.claudeIgnore,
    existingCommands: context.commands,
    fileTreeHashes: fileHashes,
    keyFiles,
    scannedAt: new Date().toISOString(),
  };

  return snapshot;
}