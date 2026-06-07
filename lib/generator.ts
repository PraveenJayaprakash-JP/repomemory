// RepoMemory — Generates AI context pack via configured AI provider

import type { ProjectSnapshot, GeneratedFile, AgentType } from './types';
import { AGENT_FILE_MAP } from './types';
import type { ContextChange } from './drift';
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
  buildCursorRulesPrompt,
  buildCursorContextPrompt,
  CURSOR_RULES_SYSTEM_PROMPT,
  CURSOR_CONTEXT_SYSTEM_PROMPT,
  buildWindsurfRulesPrompt,
  buildWindsurfContextPrompt,
  WINDSURF_RULES_SYSTEM_PROMPT,
  WINDSURF_CONTEXT_SYSTEM_PROMPT,
  buildGeminiPrompt,
  GEMINI_SYSTEM_PROMPT,
  buildOpenCodeAgentsPrompt,
  buildOpenCodeInstructionsPrompt,
  OPENCODE_AGENTS_SYSTEM_PROMPT,
  OPENCODE_INSTRUCTIONS_SYSTEM_PROMPT,
  buildAiderConfigPrompt,
  buildAiderContextPrompt,
  AIDER_CONFIG_SYSTEM_PROMPT,
  AIDER_CONTEXT_SYSTEM_PROMPT,
  buildSmartRegenerationPrompt,
  SMART_REGEN_SYSTEM_PROMPT,
} from './prompts';

export interface GenerateOptions {
  /** Override model per file type */
  claudeMdModel?: string;
  claudeIgnoreModel?: string;
  commandModel?: string;
  hookModel?: string;
  /** Which AI agents to generate context files for. Defaults to ['claude']. */
  agents?: AgentType[];
  /** If provided, do smart regeneration — only update affected sections */
  changes?: ContextChange[];
  /** Existing generated files content for smart regeneration */
  existingFiles?: GeneratedFile[];
}

// ---------------------------------------------------------------------------
// Per-agent generation strategies
// ---------------------------------------------------------------------------

interface AgentGenerationStrategy {
  /** Build all context files for this agent type */
  generate(snapshot: ProjectSnapshot, options: GenerateOptions): Promise<GeneratedFile[]>;
}

const CLAUDE_STRATEGY: AgentGenerationStrategy = {
  async generate(snapshot, options) {
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

    // 3. Commands — can run in parallel
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
  },
};

const CURSOR_STRATEGY: AgentGenerationStrategy = {
  async generate(snapshot, options) {
    const model = options.claudeMdModel;
    const [rules, context] = await Promise.all([
      generateText(buildCursorRulesPrompt(snapshot), CURSOR_RULES_SYSTEM_PROMPT, {
        model, temperature: 0.3, maxTokens: 4000,
      }),
      generateText(buildCursorContextPrompt(snapshot), CURSOR_CONTEXT_SYSTEM_PROMPT, {
        model, temperature: 0.3, maxTokens: 4000,
      }),
    ]);
    return [
      { fileName: '.cursor/rules.mdc', content: rules, applied: false },
      { fileName: '.cursor/context.md', content: context, applied: false },
    ];
  },
};

const WINDSURF_STRATEGY: AgentGenerationStrategy = {
  async generate(snapshot, options) {
    const model = options.claudeMdModel;
    const [rules, context] = await Promise.all([
      generateText(buildWindsurfRulesPrompt(snapshot), WINDSURF_RULES_SYSTEM_PROMPT, {
        model, temperature: 0.3, maxTokens: 4000,
      }),
      generateText(buildWindsurfContextPrompt(snapshot), WINDSURF_CONTEXT_SYSTEM_PROMPT, {
        model, temperature: 0.3, maxTokens: 4000,
      }),
    ]);
    return [
      { fileName: '.windsurf/rules.md', content: rules, applied: false },
      { fileName: '.windsurf/context.md', content: context, applied: false },
    ];
  },
};

const GEMINI_STRATEGY: AgentGenerationStrategy = {
  async generate(snapshot, options) {
    const content = await generateText(
      buildGeminiPrompt(snapshot),
      GEMINI_SYSTEM_PROMPT,
      {
        model: options.claudeMdModel,
        temperature: 0.3,
        maxTokens: 4000,
      }
    );
    return [
      { fileName: 'GEMINI.md', content, applied: false },
    ];
  },
};

const OPENCODE_STRATEGY: AgentGenerationStrategy = {
  async generate(snapshot, options) {
    const model = options.claudeMdModel;
    const [agents, instructions] = await Promise.all([
      generateText(buildOpenCodeAgentsPrompt(snapshot), OPENCODE_AGENTS_SYSTEM_PROMPT, {
        model, temperature: 0.3, maxTokens: 4000,
      }),
      generateText(buildOpenCodeInstructionsPrompt(snapshot), OPENCODE_INSTRUCTIONS_SYSTEM_PROMPT, {
        model, temperature: 0.3, maxTokens: 4000,
      }),
    ]);
    return [
      { fileName: 'AGENTS.md', content: agents, applied: false },
      { fileName: '.opencode/instructions.md', content: instructions, applied: false },
    ];
  },
};

const AIDER_STRATEGY: AgentGenerationStrategy = {
  async generate(snapshot, options) {
    const model = options.claudeMdModel;
    const [config, context] = await Promise.all([
      generateText(buildAiderConfigPrompt(snapshot), AIDER_CONFIG_SYSTEM_PROMPT, {
        model, temperature: 0.2, maxTokens: 3000,
      }),
      generateText(buildAiderContextPrompt(snapshot), AIDER_CONTEXT_SYSTEM_PROMPT, {
        model, temperature: 0.3, maxTokens: 4000,
      }),
    ]);
    return [
      { fileName: '.aider.conf.yml', content: config, applied: false },
      { fileName: 'AIDER.md', content: context, applied: false },
    ];
  },
};

const AGENT_STRATEGIES: Record<AgentType, AgentGenerationStrategy> = {
  claude: CLAUDE_STRATEGY,
  cursor: CURSOR_STRATEGY,
  windsurf: WINDSURF_STRATEGY,
  gemini: GEMINI_STRATEGY,
  opencode: OPENCODE_STRATEGY,
  aider: AIDER_STRATEGY,
};

// ---------------------------------------------------------------------------
// Smart regeneration helpers
// ---------------------------------------------------------------------------

/** Map of section names to the files they affect (per agent type) */
const SECTION_FILE_MAP: Record<string, Record<AgentType, string[]>> = {
  'Commands': {
    claude: ['CLAUDE.md', 'commands/review.md', 'commands/test.md', 'commands/deploy.md'],
    cursor: ['.cursor/context.md'],
    windsurf: ['.windsurf/context.md'],
    gemini: ['GEMINI.md'],
    opencode: ['.opencode/instructions.md'],
    aider: ['AIDER.md'],
  },
  'Architecture': {
    claude: ['CLAUDE.md'],
    cursor: ['.cursor/context.md', '.cursor/rules.mdc'],
    windsurf: ['.windsurf/context.md', '.windsurf/rules.md'],
    gemini: ['GEMINI.md'],
    opencode: ['AGENTS.md', '.opencode/instructions.md'],
    aider: ['AIDER.md', '.aider.conf.yml'],
  },
  'Off-limits': {
    claude: ['CLAUDE.md', '.claudeignore'],
    cursor: ['.cursor/rules.mdc'],
    windsurf: ['.windsurf/rules.md'],
    gemini: ['GEMINI.md'],
    opencode: ['.opencode/instructions.md'],
    aider: ['AIDER.md'],
  },
  'Conventions': {
    claude: ['CLAUDE.md'],
    cursor: ['.cursor/rules.mdc', '.cursor/context.md'],
    windsurf: ['.windsurf/rules.md', '.windsurf/context.md'],
    gemini: ['GEMINI.md'],
    opencode: ['.opencode/instructions.md'],
    aider: ['AIDER.md'],
  },
  'Testing': {
    claude: ['CLAUDE.md', 'commands/test.md'],
    cursor: ['.cursor/context.md'],
    windsurf: ['.windsurf/context.md'],
    gemini: ['GEMINI.md'],
    opencode: ['.opencode/instructions.md'],
    aider: ['AIDER.md'],
  },
  'Deployment': {
    claude: ['CLAUDE.md', 'commands/deploy.md', 'hooks/pre-commit.sh'],
    cursor: ['.cursor/context.md'],
    windsurf: ['.windsurf/context.md'],
    gemini: ['GEMINI.md'],
    opencode: ['.opencode/instructions.md'],
    aider: ['AIDER.md'],
  },
};

/** Determine which files need regeneration based on detected changes */
function getAffectedFiles(changes: ContextChange[], agents: AgentType[]): Set<string> {
  const affected = new Set<string>();
  for (const change of changes) {
    const fileMap = SECTION_FILE_MAP[change.section];
    if (fileMap) {
      for (const agent of agents) {
        const files = fileMap[agent] ?? [];
        for (const f of files) {
          affected.add(f);
        }
      }
    }
    // Also use the change's own affectedFiles list
    for (const f of change.affectedFiles) {
      affected.add(f);
    }
  }
  return affected;
}

/** Find existing file content by name */
function findExistingContent(existingFiles: GeneratedFile[], fileName: string): string | null {
  return existingFiles.find(f => f.fileName === fileName)?.content ?? null;
}

/** Generate a single file using smart regeneration if possible */
async function generateSmartFile(
  snapshot: ProjectSnapshot,
  fileName: string,
  existingContent: string,
  changes: ContextChange[],
  model: string | undefined,
  systemPrompt: string,
  fullPromptBuilder: (snapshot: ProjectSnapshot) => string,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  // If we have existing content and changes, use smart regeneration
  if (existingContent) {
    const smartPrompt = buildSmartRegenerationPrompt(snapshot, existingContent, changes, fileName);
    return generateText(smartPrompt, SMART_REGEN_SYSTEM_PROMPT, {
      model,
      temperature,
      maxTokens,
    });
  }

  // Fallback to full generation
  return generateText(fullPromptBuilder(snapshot), systemPrompt, {
    model,
    temperature,
    maxTokens,
  });
}

/** Generate the full context pack for a scanned repo */
export async function generateContextPack(
  snapshot: ProjectSnapshot,
  options: GenerateOptions = {}
): Promise<GeneratedFile[]> {
  const agents = options.agents ?? ['claude'];
  const { changes, existingFiles } = options;
  const isSmartRegen = changes && changes.length > 0 && existingFiles && existingFiles.length > 0;

  // Determine which files are affected by changes (smart regen)
  const affectedFiles = isSmartRegen
    ? getAffectedFiles(changes, agents)
    : null;

  const files: GeneratedFile[] = [];

  for (const agent of agents) {
    const strategy = AGENT_STRATEGIES[agent];
    if (!strategy) {
      throw new Error(`Unknown agent type: ${agent}. Supported: ${Object.keys(AGENT_FILE_MAP).join(', ')}`);
    }

    // Smart regeneration: skip files not affected by changes
    if (isSmartRegen && affectedFiles) {
      const agentFiles = await strategy.generate(snapshot, options);

      for (const file of agentFiles) {
        if (affectedFiles.has(file.fileName)) {
          // This file is affected — use smart regeneration
          const existing = findExistingContent(existingFiles, file.fileName);
          if (existing) {
            const smartContent = await generateSmartFile(
              snapshot,
              file.fileName,
              existing,
              changes,
              options.claudeMdModel,
              SMART_REGEN_SYSTEM_PROMPT,
              () => file.content, // fallback not needed here
              0.3,
              4000,
            );
            files.push({ fileName: file.fileName, content: smartContent, applied: false });
          } else {
            // No existing content — full regeneration
            files.push(file);
          }
        } else {
          // Not affected — reuse existing content unchanged
          const existing = findExistingContent(existingFiles, file.fileName);
          if (existing) {
            files.push({ fileName: file.fileName, content: existing, applied: false });
          } else {
            // No existing content for this file — must generate fresh
            files.push(file);
          }
        }
      }
    } else {
      // Full regeneration (original behavior)
      const agentFiles = await strategy.generate(snapshot, options);
      files.push(...agentFiles);
    }
  }

  return files;
}