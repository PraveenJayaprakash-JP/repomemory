"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateText = generateText;
exports.generateTextStreaming = generateTextStreaming;
const openai_1 = __importDefault(require("openai"));
const DEFAULT_BASE_URL = process.env.AI_PROVIDER_BASE_URL ?? 'https://api.opencode.ai/v1';
const DEFAULT_API_KEY = process.env.AI_PROVIDER_API_KEY ?? '';
const DEFAULT_MODEL = process.env.AI_MODEL ?? 'deepseek-v4-flash';
let client = null;
function getClient() {
    if (!DEFAULT_API_KEY) {
        throw new Error('AI provider not configured. Set AI_PROVIDER_API_KEY in .env.local');
    }
    if (!client) {
        client = new openai_1.default({
            baseURL: DEFAULT_BASE_URL,
            apiKey: DEFAULT_API_KEY,
        });
    }
    return client;
}
async function generateText(prompt, systemPrompt, options) {
    const openai = getClient();
    const model = options?.model ?? DEFAULT_MODEL;
    const messages = [];
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    try {
        const response = await openai.chat.completions.create({
            model,
            messages,
            temperature: options?.temperature,
            max_tokens: options?.maxTokens,
        });
        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('AI provider returned an empty response');
        }
        return content;
    }
    catch (error) {
        if (error instanceof openai_1.default.APIError) {
            throw new Error(`AI API error (${error.status ?? 'unknown'}): ${error.message}`);
        }
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(`Unexpected AI error: ${String(error)}`);
    }
}
async function generateTextStreaming(prompt, systemPrompt, options) {
    const text = await generateText(prompt, systemPrompt, options);
    const encoder = new TextEncoder();
    return new ReadableStream({
        pull(controller) {
            controller.enqueue(encoder.encode(text));
            controller.close();
        },
    });
}
//# sourceMappingURL=ai.js.map