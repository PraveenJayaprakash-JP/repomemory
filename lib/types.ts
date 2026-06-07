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
  existingContextFiles: AgentContextFile[];
  existingClaudeMd: string | null; // content if exists (kept for backward compat)
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
  suggestions: string[]; // actionable fix suggestions
}

/** Full audit result */
export interface AuditResult {
  totalScore: number; // 0-100 (weighted average of all audited agents)
  dimensions: AuditDimension[]; // primary agent dimensions (backward compat)
  summary: string;
  badge: 'excellent' | 'good' | 'needs-improvement' | 'critical';
  agentAudits: AgentAuditResult[]; // per-agent breakdown
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

// ---------------------------------------------------------------------------
// Multi-agent support — configurable AI coding agent targets
// ---------------------------------------------------------------------------

/** Supported AI coding agent types */
export type AgentType = 'claude' | 'cursor' | 'windsurf' | 'gemini' | 'opencode' | 'aider';

/** Human-readable names for each agent */
export const AGENT_DISPLAY_NAMES: Record<AgentType, string> = {
  claude: 'Claude Code',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
  gemini: 'Gemini Code Assist',
  opencode: 'OpenCode',
  aider: 'Aider',
};

/** A detected agent context file with its content */
export interface AgentContextFile {
  agentType: AgentType;
  fileName: string;
  content: string | null;
}

/** Per-agent audit result */
export interface AgentAuditResult {
  agentType: AgentType;
  agentName: string;
  totalScore: number;
  dimensions: AuditDimension[];
  badge: 'excellent' | 'good' | 'needs-improvement' | 'critical';
  summary: string;
}

/** File descriptor for a single generated context file */
export interface AgentFileDescriptor {
  fileName: string;
  description: string;
}

/** Maps each agent type to the context files it needs */
export const AGENT_FILE_MAP: Record<AgentType, AgentFileDescriptor[]> = {
  claude: [
    { fileName: 'CLAUDE.md', description: 'Project context for Claude Code' },
    { fileName: '.claudeignore', description: 'File exclusion rules for Claude' },
    { fileName: 'commands/review.md', description: 'Code review command' },
    { fileName: 'commands/test.md', description: 'Test command' },
    { fileName: 'commands/deploy.md', description: 'Deploy command' },
    { fileName: 'hooks/pre-commit.sh', description: 'Pre-commit hook' },
  ],
  cursor: [
    { fileName: '.cursor/rules.mdc', description: 'Cursor AI project rules' },
    { fileName: '.cursor/context.md', description: 'Project context for Cursor' },
  ],
  windsurf: [
    { fileName: '.windsurf/rules.md', description: 'Windsurf AI project rules' },
    { fileName: '.windsurf/context.md', description: 'Project context for Windsurf' },
  ],
  gemini: [
    { fileName: 'GEMINI.md', description: 'Project context for Google Gemini Code Assist' },
  ],
  opencode: [
    { fileName: 'AGENTS.md', description: 'Agent definitions for OpenCode' },
    { fileName: '.opencode/instructions.md', description: 'OpenCode project instructions' },
  ],
  aider: [
    { fileName: '.aider.conf.yml', description: 'Aider AI coding assistant config' },
    { fileName: 'AIDER.md', description: 'Project context for Aider' },
  ],
};
