"use strict";
// RepoMemory — Generates AI context pack via configured AI provider
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateContextPack = generateContextPack;
const ai_1 = require("./ai");
const prompts_1 = require("./prompts");
/** Generate the full context pack for a scanned repo */
async function generateContextPack(snapshot, options = {}) {
    const files = [];
    // 1. CLAUDE.md — the big one, use best model
    const claudeMdContent = await (0, ai_1.generateText)((0, prompts_1.buildClaudeMdPrompt)(snapshot), prompts_1.CLAUDE_MD_SYSTEM_PROMPT, {
        model: options.claudeMdModel,
        temperature: 0.3,
        maxTokens: 2500,
    });
    files.push({ fileName: 'CLAUDE.md', content: claudeMdContent, applied: false });
    // 2. .claudeignore — pattern-based, fast model
    const claudeIgnoreContent = await (0, ai_1.generateText)((0, prompts_1.buildClaudeIgnorePrompt)(snapshot), prompts_1.CLAUDE_IGNORE_SYSTEM_PROMPT, {
        model: options.claudeIgnoreModel,
        temperature: 0.2,
        maxTokens: 1000,
    });
    files.push({ fileName: '.claudeignore', content: claudeIgnoreContent, applied: false });
    // 3. Commands — can run in parallel if we had batching
    const [reviewCmd, testCmd, deployCmd] = await Promise.all([
        (0, ai_1.generateText)((0, prompts_1.buildReviewCommandPrompt)(), prompts_1.COMMAND_SYSTEM_PROMPT, {
            model: options.commandModel, temperature: 0.3, maxTokens: 1000,
        }),
        (0, ai_1.generateText)((0, prompts_1.buildTestCommandPrompt)(), prompts_1.COMMAND_SYSTEM_PROMPT, {
            model: options.commandModel, temperature: 0.3, maxTokens: 1000,
        }),
        (0, ai_1.generateText)((0, prompts_1.buildDeployCommandPrompt)(), prompts_1.COMMAND_SYSTEM_PROMPT, {
            model: options.commandModel, temperature: 0.3, maxTokens: 1000,
        }),
    ]);
    files.push({ fileName: 'commands/review.md', content: reviewCmd, applied: false });
    files.push({ fileName: 'commands/test.md', content: testCmd, applied: false });
    files.push({ fileName: 'commands/deploy.md', content: deployCmd, applied: false });
    // 4. Pre-commit hook
    const hookContent = await (0, ai_1.generateText)((0, prompts_1.buildHookPrompt)(), prompts_1.HOOK_SYSTEM_PROMPT, {
        model: options.hookModel, temperature: 0.2, maxTokens: 800,
    });
    files.push({ fileName: 'hooks/pre-commit.sh', content: hookContent, applied: false });
    return files;
}
//# sourceMappingURL=generator.js.map