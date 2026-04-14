import OpenAI from 'openai';
import { AiProvider, AiMessage, AiResponse, AiChatOptions } from './provider';

/**
 * AI provider using the OpenAI API.
 * Requires an API key stored in VSCode SecretStorage.
 */
export class OpenAIProvider implements AiProvider {
    private client: OpenAI;
    private model: string;

    constructor(apiKey: string, model: string = 'gpt-4o') {
        this.client = new OpenAI({ apiKey });
        this.model = model;
    }

    async chat(messages: AiMessage[], options?: AiChatOptions): Promise<AiResponse> {
        const openaiMessages = this.convertMessages(messages);

        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: openaiMessages,
            max_tokens: options?.maxTokens ?? 4096,
        });

        const choice = response.choices[0];
        const text = choice?.message?.content ?? '';

        return {
            text,
            usage: response.usage
                ? {
                    inputTokens: response.usage.prompt_tokens,
                    outputTokens: response.usage.completion_tokens,
                }
                : undefined,
        };
    }

    async stream(
        messages: AiMessage[],
        onChunk: (text: string) => void,
        options?: AiChatOptions
    ): Promise<AiResponse> {
        const openaiMessages = this.convertMessages(messages);

        const stream = await this.client.chat.completions.create({
            model: this.model,
            messages: openaiMessages,
            max_tokens: options?.maxTokens ?? 4096,
            stream: true,
        });

        let fullText = '';
        let inputTokens = 0;
        let outputTokens = 0;

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
                fullText += delta;
                onChunk(delta);
            }

            // Capture usage from the final chunk if available
            if (chunk.usage) {
                inputTokens = chunk.usage.prompt_tokens;
                outputTokens = chunk.usage.completion_tokens;
            }
        }

        return {
            text: fullText,
            usage: inputTokens > 0 || outputTokens > 0
                ? { inputTokens, outputTokens }
                : undefined,
        };
    }

    /**
     * Convert AiMessage[] to OpenAI's ChatCompletionMessageParam format.
     */
    private convertMessages(messages: AiMessage[]): OpenAI.ChatCompletionMessageParam[] {
        return messages.map((msg) => ({
            role: msg.role as 'system' | 'user' | 'assistant',
            content: msg.content,
        }));
    }
}
