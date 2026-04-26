import type { AiProvider, AiMessage, AiResponse, AiChatOptions } from '../types';
import OpenAI from 'openai';

/**
 * AI provider backed by the OpenAI API (GPT models).
 *
 * Supports both chat completions and streaming responses.
 * Captures usage information from streaming chunks when available.
 *
 * The `openai` package is a peer dependency and must be installed by
 * the consumer. It is loaded dynamically at runtime.
 */
export class OpenAIProvider implements AiProvider {
    private readonly apiKey: string;
    private readonly model: string;
    private readonly baseUrl: string | undefined;

    /**
     * @param apiKey - OpenAI API key.
     * @param model - Model identifier (e.g., "gpt-4o").
     * @param baseUrl - Optional custom base URL for the API.
     */
    constructor(apiKey: string, model: string, baseUrl?: string) {
        this.apiKey = apiKey;
        this.model = model;
        this.baseUrl = baseUrl;
    }

    /** @inheritdoc */
    async chat(messages: AiMessage[], options?: AiChatOptions): Promise<AiResponse> {
        const client = new OpenAI({
            apiKey: this.apiKey,
            ...(this.baseUrl ? { baseURL: this.baseUrl } : {}),
        });

        const response = await client.chat.completions.create({
            model: this.model,
            messages: this.toOpenAIMessages(messages),
            max_tokens: options?.maxTokens,
        });

        return {
            text: response.choices[0]?.message?.content ?? '',
            usage: response.usage
                ? {
                    inputTokens: response.usage.prompt_tokens,
                    outputTokens: response.usage.completion_tokens,
                }
                : undefined,
        };
    }

    /** @inheritdoc */
    async stream(
        messages: AiMessage[],
        onChunk: (text: string) => void,
        options?: AiChatOptions
    ): Promise<AiResponse> {
        const client = new OpenAI({
            apiKey: this.apiKey,
            ...(this.baseUrl ? { baseURL: this.baseUrl } : {}),
        });

        const stream = await client.chat.completions.create({
            model: this.model,
            messages: this.toOpenAIMessages(messages),
            max_tokens: options?.maxTokens,
            stream: true,
            stream_options: { include_usage: true },
        });

        let text = '';
        let usageInputTokens: number | undefined;
        let usageOutputTokens: number | undefined;

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
                text += delta;
                onChunk(delta);
            }

            // Capture usage from the final chunk when available
            if (chunk.usage) {
                usageInputTokens = chunk.usage.prompt_tokens;
                usageOutputTokens = chunk.usage.completion_tokens;
            }
        }

        return {
            text,
            usage: usageInputTokens !== undefined && usageOutputTokens !== undefined
                ? { inputTokens: usageInputTokens, outputTokens: usageOutputTokens }
                : undefined,
        };
    }

    /**
     * Convert {@link AiMessage} array to OpenAI chat completion message format.
     */
    private toOpenAIMessages(
        messages: AiMessage[]
    ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
        return messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
        }));
    }
}
