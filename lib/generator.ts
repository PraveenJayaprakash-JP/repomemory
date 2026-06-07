// RepoMemory — Generates AI context pack via configured AI provider

import type { ProjectSnapshot, GeneratedFile } from './types';
import { generateText } from './ai';
import {
  buildClaudeMdPrompt,
  buildClaudeIgnorePrompt,
  buildReviewCommandPrompt,
  buildTestCommandPrompt,
  buildDeployCommandPrompt,
  buildHookPrompt,
  CLAUDE_MD_SYSTEM_PROMPT,
  CLAUDE_IGNORE_SYSTEM_PROMPT,
  COMMAND_SYSTEM_PROMPT,
  HOOK_SYSTEM_PROMPT,
} from './prompts';

export interface GenerateOptions {
  /** Override model per file type */
  claudeMdModel?: string;
  claudeIgnoreModel?: string;
  commandModel?: string;
  hookModel?: string;
}

/** Generate the full context pack for a scanned repo */
export async function generateContextPack(
  snapshot: ProjectSnapshot,
  options: GenerateOptions = {}
): Promise<GeneratedFile[]> {
  const files: GeneratedFile[] = [];

  // 1. CLAUDE.md — the big one, use best model
  const claudeMdContent = await generateText(
    buildClaudeMdPrompt(snapshot),
    CLAUDE_MD_SYSTEM_PROMPT,
    {
      model: options.claudeMdModel,
      temperature: 0.3,
      maxTokens: 4000,
    }
  );
  files.push({ fileName: 'CLAUDE.md', content: claudeMdContent, applied: false });

  // 2. .claudeignore — pattern-based, fast model
  const claudeIgnoreContent = await generateText(
    buildClaudeIgnorePrompt(snapshot),
    CLAUDE_IGNORE_SYSTEM_PROMPT,
    {
      model: options.claudeIgnoreModel,
      temperature: 0.2,
      maxTokens: 3000,
    }
  );
  files.push({ fileName: '.claudeignore', content: claudeIgnoreContent, applied: false });

  // 3. Commands — can run in parallel if we had batching
  const [reviewCmd, testCmd, deployCmd] = await Promise.all([
    generateText(buildReviewCommandPrompt(), COMMAND_SYSTEM_PROMPT, {
      model: options.commandModel, temperature: 0.3, maxTokens: 3000,
    }),
    generateText(buildTestCommandPrompt(), COMMAND_SYSTEM_PROMPT, {
      model: options.commandModel, temperature: 0.3, maxTokens: 3000,
    }),
    generateText(buildDeployCommandPrompt(), COMMAND_SYSTEM_PROMPT, {
      model: options.commandModel, temperature: 0.3, maxTokens: 3000,
    }),
  ]);

  files.push({ fileName: 'commands/review.md', content: reviewCmd, applied: false });
  files.push({ fileName: 'commands/test.md', content: testCmd, applied: false });
  files.push({ fileName: 'commands/deploy.md', content: deployCmd, applied: false });

  // 4. Pre-commit hook
  const hookContent = await generateText(
    buildHookPrompt(),
    HOOK_SYSTEM_PROMPT,
    {
      model: options.hookModel, temperature: 0.2, maxTokens: 3000,
    }
  );
  files.push({ fileName: 'hooks/pre-commit.sh', content: hookContent, applied: false });

  return files;
}
