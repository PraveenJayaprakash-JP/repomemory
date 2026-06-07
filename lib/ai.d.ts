export interface GenerateTextOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
}
export declare function generateText(prompt: string, systemPrompt?: string, options?: GenerateTextOptions): Promise<string>;
export declare function generateTextStreaming(prompt: string, systemPrompt?: string, options?: GenerateTextOptions): Promise<ReadableStream>;
//# sourceMappingURL=ai.d.ts.map