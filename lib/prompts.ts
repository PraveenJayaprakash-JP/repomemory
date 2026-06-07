// RepoMemory — Prompt builders for AI context generation
import type { ProjectSnapshot } from './types';
import type { ContextChange } from './drift';

// ---------------------------------------------------------------------------
// System prompts — instruct AI behavior for each generation category
// ---------------------------------------------------------------------------

export const CLAUDE_MD_SYSTEM_PROMPT = `You are a senior engineer writing a CLAUDE.md project context file. Be precise, structured, and practical. No fluff, no filler, no hedging. Use markdown headings, bullet lists, and code blocks. Every section must contain actionable, concrete information — not vague advice. Prefer specific commands over descriptions. Prefer file paths over general references. Omit sections that would be empty.`;

export const CLAUDE_IGNORE_SYSTEM_PROMPT = `You are a senior engineer writing .claudeignore rules. Be precise and practical. Each rule must have a brief explanatory comment. Rules should cover common noisy/generated directories, lock files, build artifacts, and any project-specific paths that would waste AI context. No fluff.`;

export const COMMAND_SYSTEM_PROMPT = `You are a senior engineer writing slash command markdown files for Claude Code. Be precise, structured, and practical. Each command must define clear triggers, steps, and expected outcomes. Use markdown headings and bullet lists. No fluff, no filler. Commands should be immediately usable — copy-paste ready.`;

export const HOOK_SYSTEM_PROMPT = `You are a senior DevOps engineer writing a pre-commit shell hook. Be precise and practical. The script must be POSIX-compatible (sh, not bash-specific), idempotent, and fast. Include clear comments explaining each check. Exit non-zero only on genuine issues, not warnings. No fluff.`;

// ---------------------------------------------------------------------------
// Prompt builders — construct user messages from ProjectSnapshot
// ---------------------------------------------------------------------------

export function buildClaudeMdPrompt(snapshot: ProjectSnapshot): string {
  const keyFilesList = snapshot.topFiles.length > 0
    ? snapshot.topFiles.map(f => `- ${f}`).join('\n')
    : 'No key files detected.';

  const existingNote = snapshot.existingClaudeMd
    ? `\nAn existing CLAUDE.md was found. Rewrite it completely — preserve what works, fix what doesn't, add what's missing.\n`
    : '';

  const frameworkNote = snapshot.framework !== 'None' && snapshot.framework !== 'Unknown'
    ? `Framework: ${snapshot.framework}\n`
    : '';

  return `Write a complete CLAUDE.md for the project "${snapshot.repoName}".

Project details:
- Language: ${snapshot.language}
${frameworkNote}- File count: ${snapshot.fileCount}
- Total size: ${(snapshot.totalSizeBytes / 1024).toFixed(1)} KB
${existingNote}
Key files:
${keyFilesList}

The CLAUDE.md must include these sections (omit any that would be empty):

1. **Project Overview** — What this project does, why it exists, core value proposition.
2. **Architecture** — Directory structure, main modules, data flow, key abstractions. Reference specific files.
3. **Commands** — Build, test, lint, dev-server, and any project-specific commands with exact invocations.
4. **Conventions** — Coding style, naming patterns, import order, commit message format, branch strategy.
5. **Off-Limits** — Files/directories the AI must never modify. Generated files, lock files, vendored code.
6. **Testing** — How to run tests, test structure, coverage expectations, testing patterns used.
7. **Deployment** — Build steps, environment variables, deployment targets, CI/CD pipeline.

Tone: practical, concrete, production-ready. No filler. Every line must earn its place.
Output: markdown only.`;
}

export function buildClaudeIgnorePrompt(snapshot: ProjectSnapshot): string {
  const noisyDirsList = snapshot.noisyDirs.length > 0
    ? snapshot.noisyDirs.map(d => `- ${d}`).join('\n')
    : 'No noisy directories detected.';

  return `Generate .claudeignore rules for the project "${snapshot.repoName}".

Detected noisy directories:
${noisyDirsList}

Language: ${snapshot.language}
Framework: ${snapshot.framework}

Requirements:
- Add rules for each detected noisy directory
- Add language/framework-appropriate patterns (build output, dependencies, generated code)
- Add common patterns: lock files, IDE configs, OS files, cache directories
- Each rule must have a brief # comment explaining why it's excluded
- Order: specific project rules first, then general patterns
- Be comprehensive but don't exclude source code or config files the AI should read

Tone: practical, production-ready.
Output: .claudeignore content only (no markdown fences).`;
}

export function buildReviewCommandPrompt(): string {
  return `Create a slash command file for code review workflow.

The command should:
- Trigger on: /review or /review <file-or-scope>
- Define a structured code review process with these steps:
  1. Identify changed files (git diff or specified scope)
  2. Check for common issues: security, performance, type safety, error handling
  3. Verify conventions match project CLAUDE.md
  4. Summarize findings with severity levels (critical/warning/info)
  5. Suggest specific fixes with file:line references
- Include flags: --full (deep review), --quick (surface review), --security (security-focused)
- Output format: structured markdown with sections per file

Tone: practical, production-ready.
Output: markdown content for commands/review.md.`;
}

export function buildTestCommandPrompt(): string {
  return `Create a slash command file for running tests.

The command should:
- Trigger on: /test or /test <path-or-scope>
- Define a test workflow with these steps:
  1. Detect test framework from project config (package.json, pyproject.toml, Cargo.toml, etc.)
  2. Run relevant tests based on scope (all, changed files, specific path)
  3. Parse test output for failures
  4. For failures: extract file, line, error message, and suggest likely causes
  5. Summarize: pass/fail counts, coverage estimate, flaky test warnings
- Include flags: --watch (watch mode), --coverage (coverage report), --fix (attempt auto-fix)
- Handle zero-test-found gracefully with setup suggestions

Tone: practical, production-ready.
Output: markdown content for commands/test.md.`;
}

export function buildDeployCommandPrompt(): string {
  return `Create a slash command file for deployment checklist.

The command should:
- Trigger on: /deploy or /deploy <environment>
- Define a deployment workflow with these steps:
  1. Pre-deploy checks: tests pass, no uncommitted changes, branch is up-to-date
  2. Build verification: production build succeeds, bundle size within limits
  3. Environment validation: required env vars present, secrets configured
  4. Deployment steps: build, push, deploy (adapt to detected platform)
  5. Post-deploy verification: health check, smoke test, rollback plan
- Include flags: --dry-run (check without deploying), --force (skip non-critical checks)
- Detect deployment platform from project files (Vercel, Netlify, Docker, etc.)

Tone: practical, production-ready.
Output: markdown content for commands/deploy.md.`;
}

export function buildHookPrompt(): string {
  return `Create a pre-commit hook script for context freshness.

The hook should:
- Check if tracked context files (CLAUDE.md, .claudeignore, commands/*.md) are stale
- Compare file tree hashes against last scan to detect significant changes
- If drift detected: print warning with changed files and suggest running repomemory update
- Exit 0 always (never block a commit — this is advisory only)
- Be POSIX sh compatible (no bash-isms)
- Be fast: skip checks if last scan was < 1 hour ago (use timestamp file)
- Include clear comments explaining each section

Tone: practical, production-ready.
Output: shell script content for hooks/pre-commit.sh (no markdown fences).`;
}

// ---------------------------------------------------------------------------
// Cursor prompt builders
// ---------------------------------------------------------------------------

export const CURSOR_RULES_SYSTEM_PROMPT = `You are a senior engineer writing .cursor/rules.mdc for Cursor AI. Be precise, structured, and practical. Use MDC (Markdown with Directive Comments) format. Include frontmatter with description and globs. Rules must be actionable and specific to the project. No fluff, no filler.`;

export const CURSOR_CONTEXT_SYSTEM_PROMPT = `You are a senior engineer writing a context.md file for Cursor AI. Be precise, structured, and practical. Provide project context that helps Cursor understand the codebase, conventions, and architecture. Use markdown headings and bullet lists. No fluff.`;

export function buildCursorRulesPrompt(snapshot: ProjectSnapshot): string {
  const frameworkNote = snapshot.framework !== 'None' && snapshot.framework !== 'Unknown'
    ? `Framework: ${snapshot.framework}\n`
    : '';

  return `Write .cursor/rules.mdc for the project "${snapshot.repoName}".

Project details:
- Language: ${snapshot.language}
${frameworkNote}- File count: ${snapshot.fileCount}
- Total size: ${(snapshot.totalSizeBytes / 1024).toFixed(0)} KB
- Noisy dirs: ${snapshot.noisyDirs.join(', ') || 'none'}
- Key files: ${snapshot.topFiles.slice(0, 15).join(', ') || 'none'}

Requirements:
- Use MDC format with frontmatter (description, globs)
- Include rules for: code style, naming conventions, import ordering, error handling patterns
- Add project-specific rules based on detected language and framework
- Include file-specific rules where appropriate (e.g., different rules for test files)
- Keep rules concise and actionable
- No vague advice — every rule must be specific and enforceable

Tone: precise, actionable.
Output: MDC content for .cursor/rules.mdc.`;
}

export function buildCursorContextPrompt(snapshot: ProjectSnapshot): string {
  const keyFilesList = snapshot.topFiles.length > 0
    ? snapshot.topFiles.map(f => `- ${f}`).join('\n')
    : 'No key files detected.';

  const frameworkNote = snapshot.framework !== 'None' && snapshot.framework !== 'Unknown'
    ? `Framework: ${snapshot.framework}\n`
    : '';

  return `Write a context.md for the project "${snapshot.repoName}".

Project details:
- Language: ${snapshot.language}
${frameworkNote}- File count: ${snapshot.fileCount}
- Total size: ${(snapshot.totalSizeBytes / 1024).toFixed(0)} KB

Key files:
${keyFilesList}

Noisy directories (exclude from context): ${snapshot.noisyDirs.join(', ') || 'none'}

Requirements:
- Provide a concise project overview: what it does, how it's structured
- Document the architecture and key patterns
- List important entry points and their purposes
- Describe the testing strategy and how to run tests
- Include build/dev/deploy commands
- Note any non-obvious conventions or gotchas
- Keep it practical — Cursor uses this to understand the codebase

Tone: precise, structured, practical.
Output: markdown content for .cursor/context.md.`;
}

// ---------------------------------------------------------------------------
// Windsurf prompt builders
// ---------------------------------------------------------------------------

export const WINDSURF_RULES_SYSTEM_PROMPT = `You are a senior engineer writing .windsurf/rules.md for Windsurf AI. Be precise, structured, and practical. Use markdown format with clear sections. Rules must be actionable and specific to the project. No fluff, no filler.`;

export const WINDSURF_CONTEXT_SYSTEM_PROMPT = `You are a senior engineer writing a context.md file for Windsurf AI. Be precise, structured, and practical. Provide project context that helps Windsurf understand the codebase, conventions, and architecture. Use markdown headings and bullet lists. No fluff.`;

export function buildWindsurfRulesPrompt(snapshot: ProjectSnapshot): string {
  const frameworkNote = snapshot.framework !== 'None' && snapshot.framework !== 'Unknown'
    ? `Framework: ${snapshot.framework}\n`
    : '';

  return `Write .windsurf/rules.md for the project "${snapshot.repoName}".

Project details:
- Language: ${snapshot.language}
${frameworkNote}- File count: ${snapshot.fileCount}
- Total size: ${(snapshot.totalSizeBytes / 1024).toFixed(0)} KB
- Noisy dirs: ${snapshot.noisyDirs.join(', ') || 'none'}
- Key files: ${snapshot.topFiles.slice(0, 15).join(', ') || 'none'}

Requirements:
- Use markdown format with clear sections
- Include rules for: code style, naming conventions, import ordering, error handling
- Add project-specific rules based on detected language and framework
- Include rules for testing patterns and file organization
- Keep rules concise and actionable
- No vague advice — every rule must be specific and enforceable

Tone: precise, actionable.
Output: markdown content for .windsurf/rules.md.`;
}

export function buildWindsurfContextPrompt(snapshot: ProjectSnapshot): string {
  const keyFilesList = snapshot.topFiles.length > 0
    ? snapshot.topFiles.map(f => `- ${f}`).join('\n')
    : 'No key files detected.';

  const frameworkNote = snapshot.framework !== 'None' && snapshot.framework !== 'Unknown'
    ? `Framework: ${snapshot.framework}\n`
    : '';

  return `Write a context.md for the project "${snapshot.repoName}".

Project details:
- Language: ${snapshot.language}
${frameworkNote}- File count: ${snapshot.fileCount}
- Total size: ${(snapshot.totalSizeBytes / 1024).toFixed(0)} KB

Key files:
${keyFilesList}

Noisy directories (exclude from context): ${snapshot.noisyDirs.join(', ') || 'none'}

Requirements:
- Provide a concise project overview: what it does, how it's structured
- Document the architecture and key patterns
- List important entry points and their purposes
- Describe the testing strategy and how to run tests
- Include build/dev/deploy commands
- Note any non-obvious conventions or gotchas
- Keep it practical — Windsurf uses this to understand the codebase

Tone: precise, structured, practical.
Output: markdown content for .windsurf/context.md.`;
}

// ---------------------------------------------------------------------------
// Gemini prompt builder
// ---------------------------------------------------------------------------

export const GEMINI_SYSTEM_PROMPT = `You are a senior engineer writing a GEMINI.md project context file for Google Gemini Code Assist. Be precise, structured, and practical. Use markdown headings, bullet lists, and code blocks. Every section must contain actionable, concrete information — not vague advice. Prefer specific commands over descriptions. Prefer file paths over general references. Omit sections that would be empty.`;

export function buildGeminiPrompt(snapshot: ProjectSnapshot): string {
  const keyFilesList = snapshot.topFiles.length > 0
    ? snapshot.topFiles.map(f => `- ${f}`).join('\n')
    : 'No key files detected.';

  const existingNote = snapshot.existingClaudeMd
    ? `\nAn existing CLAUDE.md was found. Use it as reference but write for Gemini's conventions.\n`
    : '';

  const frameworkNote = snapshot.framework !== 'None' && snapshot.framework !== 'Unknown'
    ? `Framework: ${snapshot.framework}\n`
    : '';

  return `Write a complete GEMINI.md for the project "${snapshot.repoName}".
${existingNote}
Project details:
- Language: ${snapshot.language}
${frameworkNote}- File count: ${snapshot.fileCount}
- Total size: ${(snapshot.totalSizeBytes / 1024).toFixed(0)} KB

Key files:
${keyFilesList}

Noisy directories (exclude from context): ${snapshot.noisyDirs.join(', ') || 'none'}

Requirements:
- Project overview: what it does, target users, core value proposition
- Architecture: directory structure, key modules, data flow
- Tech stack: language, framework, key dependencies with versions
- Development setup: prerequisites, install commands, env setup
- Build & run: build, dev, test, lint commands
- Code conventions: naming, formatting, import ordering, error handling
- Testing strategy: framework, file location, run commands, coverage
- Common tasks: adding features, debugging, deployment
- Known gotchas: non-obvious behaviors, common mistakes

Tone: precise, structured, practical. No fluff.
Output: markdown content for GEMINI.md.`;
}

// ---------------------------------------------------------------------------
// OpenCode prompt builders
// ---------------------------------------------------------------------------

export const OPENCODE_AGENTS_SYSTEM_PROMPT = `You are a senior engineer writing an AGENTS.md file for OpenCode. Be precise, structured, and practical. Define agent configurations with clear roles, allowed tools, and model preferences. Use YAML frontmatter followed by markdown instructions. No fluff, no filler.`;

export const OPENCODE_INSTRUCTIONS_SYSTEM_PROMPT = `You are a senior engineer writing project instructions for OpenCode (.opencode/instructions.md). Be precise, structured, and practical. Provide project-specific guidance that helps OpenCode agents work effectively. Use markdown headings and bullet lists. No fluff.`;

export function buildOpenCodeAgentsPrompt(snapshot: ProjectSnapshot): string {
  const frameworkNote = snapshot.framework !== 'None' && snapshot.framework !== 'Unknown'
    ? `Framework: ${snapshot.framework}\n`
    : '';

  return `Write an AGENTS.md file for the project "${snapshot.repoName}".

Project details:
- Language: ${snapshot.language}
${frameworkNote}- File count: ${snapshot.fileCount}
- Key files: ${snapshot.topFiles.slice(0, 15).join(', ') || 'none'}

Requirements:
- Define 2-4 specialized agents for this project type
- Each agent needs: name, description, model preference, allowed tools, file access scope
- Include a default/general-purpose agent
- Agents should cover: code review, testing, deployment, and project-specific tasks
- Use YAML frontmatter format for agent definitions
- Follow with markdown instructions for each agent

Tone: precise, actionable.
Output: AGENTS.md content with YAML frontmatter and markdown instructions.`;
}

export function buildOpenCodeInstructionsPrompt(snapshot: ProjectSnapshot): string {
  const keyFilesList = snapshot.topFiles.length > 0
    ? snapshot.topFiles.map(f => `- ${f}`).join('\n')
    : 'No key files detected.';

  const frameworkNote = snapshot.framework !== 'None' && snapshot.framework !== 'Unknown'
    ? `Framework: ${snapshot.framework}\n`
    : '';

  return `Write .opencode/instructions.md for the project "${snapshot.repoName}".

Project details:
- Language: ${snapshot.language}
${frameworkNote}- File count: ${snapshot.fileCount}
- Total size: ${(snapshot.totalSizeBytes / 1024).toFixed(0)} KB

Key files:
${keyFilesList}

Noisy directories: ${snapshot.noisyDirs.join(', ') || 'none'}

Requirements:
- Project overview and architecture
- Code style and conventions
- Testing instructions
- Build and deployment commands
- Common development workflows
- Project-specific gotchas and non-obvious behaviors

Tone: precise, structured, practical.
Output: markdown content for .opencode/instructions.md.`;
}

// ---------------------------------------------------------------------------
// Aider prompt builders
// ---------------------------------------------------------------------------

export const AIDER_CONFIG_SYSTEM_PROMPT = `You are a senior engineer writing an .aider.conf.yml configuration file for Aider AI coding assistant. Be precise and practical. Use valid YAML syntax. Configuration must be immediately usable. No fluff.`;

export const AIDER_CONTEXT_SYSTEM_PROMPT = `You are a senior engineer writing an AIDER.md project context file for Aider AI coding assistant. Be precise, structured, and practical. Use markdown headings, bullet lists, and code blocks. Every section must contain actionable, concrete information. No fluff.`;

export function buildAiderConfigPrompt(snapshot: ProjectSnapshot): string {
  const frameworkNote = snapshot.framework !== 'None' && snapshot.framework !== 'Unknown'
    ? `Framework: ${snapshot.framework}\n`
    : '';

  return `Write an .aider.conf.yml configuration file for the project "${snapshot.repoName}".

Project details:
- Language: ${snapshot.language}
${frameworkNote}- File count: ${snapshot.fileCount}
- Noisy dirs: ${snapshot.noisyDirs.join(', ') || 'none'}
- Key files: ${snapshot.topFiles.slice(0, 15).join(', ') || 'none'}

Requirements:
- Valid YAML configuration
- Set appropriate model for the project language
- Configure file watching patterns (include source, exclude noisy dirs)
- Set linting commands appropriate for the language
- Configure map tokens based on project size
- Set reasonable defaults for the project type
- Include comments explaining non-obvious settings

Tone: precise, practical.
Output: YAML content for .aider.conf.yml (no markdown fences).`;
}

export function buildAiderContextPrompt(snapshot: ProjectSnapshot): string {
  const keyFilesList = snapshot.topFiles.length > 0
    ? snapshot.topFiles.map(f => `- ${f}`).join('\n')
    : 'No key files detected.';

  const frameworkNote = snapshot.framework !== 'None' && snapshot.framework !== 'Unknown'
    ? `Framework: ${snapshot.framework}\n`
    : '';

  return `Write an AIDER.md for the project "${snapshot.repoName}".

Project details:
- Language: ${snapshot.language}
${frameworkNote}- File count: ${snapshot.fileCount}
- Total size: ${(snapshot.totalSizeBytes / 1024).toFixed(0)} KB

Key files:
${keyFilesList}

Noisy directories (exclude from context): ${snapshot.noisyDirs.join(', ') || 'none'}

Requirements:
- Project overview: what it does, architecture, key patterns
- Code conventions: naming, formatting, import style
- Testing: how to run tests, where they live
- Build and dev commands
- Common gotchas and non-obvious behaviors
- Keep it concise — Aider uses this for context window efficiency

Tone: precise, structured, practical. No fluff.
Output: markdown content for AIDER.md.`;
}

// ---------------------------------------------------------------------------
// Smart regeneration — targeted update prompt
// ---------------------------------------------------------------------------

export const SMART_REGEN_SYSTEM_PROMPT = `You are a senior engineer updating a project context file. You will receive the EXISTING content and a list of sections that changed. Your job is to update ONLY the affected sections while preserving all other content exactly as-is. Do NOT rewrite unchanged sections. Do NOT add new sections unless the changes require it. Do NOT remove sections. Output the COMPLETE file with changes applied.`;

export function buildSmartRegenerationPrompt(
  snapshot: ProjectSnapshot,
  existingContent: string,
  changes: ContextChange[],
  targetFile: string
): string {
  const changeDescriptions = changes
    .map(c => `- **${c.section}** (priority: ${c.priority}): ${c.reason}`)
    .join('\n');

  const frameworkNote = snapshot.framework !== 'None' && snapshot.framework !== 'Unknown'
    ? `Framework: ${snapshot.framework}\n`
    : '';

  return `Update the existing ${targetFile} for the project "${snapshot.repoName}".

Project details:
- Language: ${snapshot.language}
${frameworkNote}- File count: ${snapshot.fileCount}
- Total size: ${(snapshot.totalSizeBytes / 1024).toFixed(1)} KB

The following changes were detected in the project:
${changeDescriptions}

INSTRUCTIONS:
1. Read the EXISTING content below carefully
2. Update ONLY the sections listed above — rewrite those sections based on the current project state
3. Preserve ALL other sections exactly as they are — do not rephrase, reorder, or remove them
4. If a changed section doesn't exist yet, add it in an appropriate location
5. Output the COMPLETE file with the targeted changes applied

EXISTING CONTENT:
---
${existingContent}
---

Output the complete ${targetFile} with only the affected sections updated.`;
}