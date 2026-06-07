import OpenAI from 'openai';
import type { AiProviderConfig } from './types';

const DEFAULT_BASE_URL = process.env.AI_PROVIDER_BASE_URL ?? 'https://opencode.ai/zen/go/v1';
const DEFAULT_API_KEY = process.env.AI_PROVIDER_API_KEY ?? '';
const DEFAULT_MODEL = process.env.AI_MODEL ?? 'deepseek-v4-flash';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!DEFAULT_API_KEY) {
    throw new Error(
      'AI provider not configured. Set AI_PROVIDER_API_KEY in .env.local',
    );
  }
  if (!client) {
    client = new OpenAI({
      baseURL: DEFAULT_BASE_URL,
      apiKey: DEFAULT_API_KEY,
    });
  }
  return client;
}

export interface GenerateTextOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function generateText(
  prompt: string,
  systemPrompt?: string,
  options?: GenerateTextOptions,
): Promise<string> {
  const openai = getClient();
  const model = options?.model ?? DEFAULT_MODEL;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  try {
    const createParams: any = {
      model,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    };

    const response = await openai.chat.completions.create(createParams);

    const choice = response.choices?.[0];
    const content = choice?.message?.content;
    const reasoning = (choice?.message as any)?.reasoning_content;
    const finishReason = choice?.finish_reason;

    if (!content && content !== '') {
      throw new Error(
        `AI provider returned an empty response. ` +
        `Finish reason: ${finishReason ?? 'unknown'}. ` +
        `Has reasoning: ${!!reasoning}. ` +
        `Reasoning length: ${reasoning?.length ?? 0}. ` +
        `Base URL: ${DEFAULT_BASE_URL}. Model: ${model}.`
      );
    }
    return content;
  } catch (error: unknown) {
    if (error instanceof OpenAI.APIError) {
      throw new Error(
        `AI API error (${error.status ?? 'unknown'}): ${error.message}`,
      );
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Unexpected AI error: ${String(error)}`);
  }
}

export async function generateTextStreaming(
  prompt: string,
  systemPrompt?: string,
  options?: GenerateTextOptions,
): Promise<ReadableStream> {
  const text = await generateText(prompt, systemPrompt, options);
  const encoder = new TextEncoder();
  return new ReadableStream({
    pull(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}