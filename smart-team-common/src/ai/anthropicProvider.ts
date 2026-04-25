import type { AiProvider, AiMessage, AiResponse, AiChatOptions } from '../types';

/**
 * AI provider backed by the Anthropic API (Claude).
 *
 * System messages are extracted separately since the Anthropic API
 * requires the system prompt as a dedicated parameter rather than
 * as part of the messages array.
 *
 * The `@anthropic-ai/sdk` package is a peer dependency and must be
 * installed by the consumer. It is loaded dynamically at runtime.
 */
export class AnthropicProvider implements AiProvider {
    private readonly apiKey: string;
    private readonly model: string;
    private readonly baseUrl: string | undefined;

    /**
     * @param apiKey - Anthropic API key.
     * @param model - Model identifier (e.g., "claude-sonnet-4-20250514").
     * @param baseUrl - Optional custom base URL for the API.
     */
    constructor(apiKey: string, model: string, baseUrl?: string) {
        this.apiKey = apiKey;
        this.model = model;
        this.baseUrl = baseUrl;
    }

    /** @inheritdoc */
    async chat(messages: AiMessage[], options?: AiChatOptions): Promise<AiResponse> {
        const Anthropic = this.loadSdk();
        const client = new Anthropic.default({
            apiKey: this.apiKey,
            ...(this.baseUrl ? { baseURL: this.baseUrl } : {}),
        });

        const { system, chatMessages } = this.separateSystemMessages(messages);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await client.messages.create({
            model: this.model,
            max_tokens: options?.maxTokens ?? 4096,
            system: system || undefined,
            messages: chatMessages,
        } as any);

        const textBlock = (response.content as Array<{ type: string; text: string }>).find(
            (block) => block.type === 'text'
        );

        return {
            text: textBlock?.text ?? '',
            usage: response.usage
                ? {
                    inputTokens: (response.usage as { input_tokens: number }).input_tokens,
                    outputTokens: (response.usage as { output_tokens: number }).output_tokens,
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
        const Anthropic = this.loadSdk();
        const client = new Anthropic.default({
            apiKey: this.apiKey,
            ...(this.baseUrl ? { baseURL: this.baseUrl } : {}),
        });

        const { system, chatMessages } = this.separateSystemMessages(messages);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stream = client.messages.stream({
            model: this.model,
            max_tokens: options?.maxTokens ?? 4096,
            system: system || undefined,
            messages: chatMessages,
        } as any);

        let text = '';

        stream.on('text', (chunk: string) => {
            text += chunk;
            onChunk(chunk);
        });

        const finalMessage = await stream.finalMessage();

        const usage = finalMessage.usage
            ? {
                inputTokens: (finalMessage.usage as { input_tokens: number }).input_tokens,
                outputTokens: (finalMessage.usage as { output_tokens: number }).output_tokens,
            }
            : undefined;

        return {
            text,
            usage,
        };
    }

    /**
     * Dynamically load the Anthropic SDK.
     * @throws Error if the SDK is not installed.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private loadSdk(): any {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            return require('@anthropic-ai/sdk');
        } catch {
            throw new Error(
                'The "@anthropic-ai/sdk" package is required for the Anthropic provider. ' +
                'Install it as a dependency in the consuming extension.'
            );
        }
    }

    /**
     * Separate system messages from the conversation messages.
     * Anthropic requires system prompts as a separate parameter.
     *
     * @returns An object with `system` (joined system messages) and
     *          `chatMessages` (non-system messages).
     */
    private separateSystemMessages(messages: AiMessage[]): {
        system: string;
        chatMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
    } {
        const systemParts: string[] = [];
        const chatMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemParts.push(msg.content);
            } else {
                chatMessages.push({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content,
                });
            }
        }

        return {
            system: systemParts.join('\n\n'),
            chatMessages,
        };
    }
}
