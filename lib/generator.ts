// RepoMemory — Generates AI context pack via configured AI provider

import type { ProjectSnapshot, GeneratedFile, AgentType } from './types';
import { AGENT_FILE_MAP } from './types';
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
} from './prompts';

export interface GenerateOptions {
  /** Override model per file type */
  claudeMdModel?: string;
  claudeIgnoreModel?: string;
  commandModel?: string;
  hookModel?: string;
  /** Which AI agents to generate context files for. Defaults to ['claude']. */
  agents?: AgentType[];
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

/** Generate the full context pack for a scanned repo */
export async function generateContextPack(
  snapshot: ProjectSnapshot,
  options: GenerateOptions = {}
): Promise<GeneratedFile[]> {
  const agents = options.agents ?? ['claude'];
  const files: GeneratedFile[] = [];

  for (const agent of agents) {
    const strategy = AGENT_STRATEGIES[agent];
    if (!strategy) {
      throw new Error(`Unknown agent type: ${agent}. Supported: ${Object.keys(AGENT_FILE_MAP).join(', ')}`);
    }
    const agentFiles = await strategy.generate(snapshot, options);
    files.push(...agentFiles);
  }

  return files;
}