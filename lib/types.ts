// RepoMemory — Shared TypeScript Types

/** Detected programming language in scanned repo */
export type DetectedLanguage = 
  | 'TypeScript' | 'JavaScript' | 'Python' | 'Rust' | 'Go' 
  | 'Java' | 'Kotlin' | 'Ruby' | 'PHP' | 'C#' | 'C++' | 'C'
  | 'Shell' | 'Dockerfile' | 'Unknown';

/** Detected framework in scanned repo */
export type DetectedFramework =
  | 'Next.js' | 'React' | 'Vue' | 'Angular' | 'Svelte'
  | 'FastAPI' | 'Django' | 'Flask' | 'Express' | 'NestJS'
  | 'Spring Boot' | 'Rails' | 'Laravel' | 'ASP.NET'
  | 'Tauri' | 'Electron' | 'None' | 'Unknown';

/** Snapshot of file tree metadata for drift detection */
export interface FileTreeHash {
  path: string;
  hash: string; // sha256 of file content
  lastModified: number; // unix ms
}

/** Result of scanning a repo folder */
export interface ProjectSnapshot {
  folderPath: string;
  repoName: string;
  language: DetectedLanguage;
  framework: DetectedFramework;
  fileCount: number;
  totalSizeBytes: number;
  topFiles: string[];
  noisyDirs: string[]; // node_modules, .git, dist, etc.
  existingClaudeMd: string | null; // content if exists
  existingClaudeIgnore: string | null;
  existingCommands: string[]; // file names in /commands/
  fileTreeHashes: FileTreeHash[];
  keyFiles: {
    packageJson: Record<string, unknown> | null;
    dockerFile: string | null;
    ciConfig: string | null;
    envExample: string | null;
  };
  scannedAt: string; // ISO datetime
}

/** Seven quality dimensions for CLAUDE.md audit */
export interface AuditDimension {
  name: string;
  maxScore: number;
  score: number;
  reason: string;
}

/** Full audit result */
export interface AuditResult {
  totalScore: number; // 0-100
  dimensions: AuditDimension[];
  summary: string;
  badge: 'excellent' | 'good' | 'needs-improvement' | 'critical';
}

/** A single generated context file */
export interface GeneratedFile {
  fileName: string; // e.g. "CLAUDE.md"
  content: string;
  applied: boolean;
}

/** A drift event when repo changed but context didn't */
export interface DriftEvent {
  id: string;
  projectId: string;
  changedFiles: { path: string; change: 'modified' | 'added' | 'deleted' }[];
  staleContextFiles: string[];
  detectedAt: string;
  resolved: boolean;
}

/** A scanned project record */
export interface Project {
  id: string;
  folderPath: string;
  repoName: string;
  language: DetectedLanguage;
  framework: DetectedFramework;
  lastScore: number | null;
  lastScanAt: string | null;
  createdAt: string;
}

/** A single scan record */
export interface Scan {
  id: string;
  projectId: string;
  snapshot: ProjectSnapshot;
  audit: AuditResult;
  generatedFiles: GeneratedFile[];
  driftEvents: DriftEvent[];
  createdAt: string;
}

/** The on-disk store structure (.repomemory/store.json) */
export interface RepoMemoryStore {
  version: 1;
  projects: Project[];
  scans: Scan[];
}

/** AI provider configuration */
export interface AiProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** API request types */
export interface ScanRequest {
  folderPath: string;
}

export interface GenerateRequest {
  scanId: string;
}

/** API response wrapper */
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
