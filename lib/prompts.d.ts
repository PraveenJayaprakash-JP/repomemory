import type { ProjectSnapshot } from './types';
export declare const CLAUDE_MD_SYSTEM_PROMPT = "You are a senior engineer writing a CLAUDE.md project context file. Be precise, structured, and practical. No fluff, no filler, no hedging. Use markdown headings, bullet lists, and code blocks. Every section must contain actionable, concrete information \u2014 not vague advice. Prefer specific commands over descriptions. Prefer file paths over general references. Omit sections that would be empty.";
export declare const CLAUDE_IGNORE_SYSTEM_PROMPT = "You are a senior engineer writing .claudeignore rules. Be precise and practical. Each rule must have a brief explanatory comment. Rules should cover common noisy/generated directories, lock files, build artifacts, and any project-specific paths that would waste AI context. No fluff.";
export declare const COMMAND_SYSTEM_PROMPT = "You are a senior engineer writing slash command markdown files for Claude Code. Be precise, structured, and practical. Each command must define clear triggers, steps, and expected outcomes. Use markdown headings and bullet lists. No fluff, no filler. Commands should be immediately usable \u2014 copy-paste ready.";
export declare const HOOK_SYSTEM_PROMPT = "You are a senior DevOps engineer writing a pre-commit shell hook. Be precise and practical. The script must be POSIX-compatible (sh, not bash-specific), idempotent, and fast. Include clear comments explaining each check. Exit non-zero only on genuine issues, not warnings. No fluff.";
export declare function buildClaudeMdPrompt(snapshot: ProjectSnapshot): string;
export declare function buildClaudeIgnorePrompt(snapshot: ProjectSnapshot): string;
export declare function buildReviewCommandPrompt(): string;
export declare function buildTestCommandPrompt(): string;
export declare function buildDeployCommandPrompt(): string;
export declare function buildHookPrompt(): string;
//# sourceMappingURL=prompts.d.ts.map