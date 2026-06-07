"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HOOK_SYSTEM_PROMPT = exports.COMMAND_SYSTEM_PROMPT = exports.CLAUDE_IGNORE_SYSTEM_PROMPT = exports.CLAUDE_MD_SYSTEM_PROMPT = void 0;
exports.buildClaudeMdPrompt = buildClaudeMdPrompt;
exports.buildClaudeIgnorePrompt = buildClaudeIgnorePrompt;
exports.buildReviewCommandPrompt = buildReviewCommandPrompt;
exports.buildTestCommandPrompt = buildTestCommandPrompt;
exports.buildDeployCommandPrompt = buildDeployCommandPrompt;
exports.buildHookPrompt = buildHookPrompt;
// ---------------------------------------------------------------------------
// System prompts — instruct AI behavior for each generation category
// ---------------------------------------------------------------------------
exports.CLAUDE_MD_SYSTEM_PROMPT = `You are a senior engineer writing a CLAUDE.md project context file. Be precise, structured, and practical. No fluff, no filler, no hedging. Use markdown headings, bullet lists, and code blocks. Every section must contain actionable, concrete information — not vague advice. Prefer specific commands over descriptions. Prefer file paths over general references. Omit sections that would be empty.`;
exports.CLAUDE_IGNORE_SYSTEM_PROMPT = `You are a senior engineer writing .claudeignore rules. Be precise and practical. Each rule must have a brief explanatory comment. Rules should cover common noisy/generated directories, lock files, build artifacts, and any project-specific paths that would waste AI context. No fluff.`;
exports.COMMAND_SYSTEM_PROMPT = `You are a senior engineer writing slash command markdown files for Claude Code. Be precise, structured, and practical. Each command must define clear triggers, steps, and expected outcomes. Use markdown headings and bullet lists. No fluff, no filler. Commands should be immediately usable — copy-paste ready.`;
exports.HOOK_SYSTEM_PROMPT = `You are a senior DevOps engineer writing a pre-commit shell hook. Be precise and practical. The script must be POSIX-compatible (sh, not bash-specific), idempotent, and fast. Include clear comments explaining each check. Exit non-zero only on genuine issues, not warnings. No fluff.`;
// ---------------------------------------------------------------------------
// Prompt builders — construct user messages from ProjectSnapshot
// ---------------------------------------------------------------------------
function buildClaudeMdPrompt(snapshot) {
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
function buildClaudeIgnorePrompt(snapshot) {
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
function buildReviewCommandPrompt() {
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
function buildTestCommandPrompt() {
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
function buildDeployCommandPrompt() {
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
function buildHookPrompt() {
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
//# sourceMappingURL=prompts.js.map