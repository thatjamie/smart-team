import Anthropic from '@anthropic-ai/sdk';
import { AiProvider, AiMessage, AiResponse, AiChatOptions } from './provider';

/**
 * AI provider using the Anthropic Claude API.
 * Requires an API key stored in VSCode SecretStorage.
 */
export class AnthropicProvider implements AiProvider {
    private client: Anthropic;
    private model: string;

    constructor(apiKey: string, model: string = 'claude-sonnet-4-20250514') {
        this.client = new Anthropic({ apiKey });
        this.model = model;
    }

    async chat(messages: AiMessage[], options?: AiChatOptions): Promise<AiResponse> {
        const { systemPrompt, chatMessages } = this.convertMessages(messages);

        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: options?.maxTokens ?? 4096,
            system: systemPrompt ?? undefined,
            messages: chatMessages,
        });

        const textBlock = response.content.find((block) => block.type === 'text');
        const text = textBlock && textBlock.type === 'text' ? textBlock.text : '';

        return {
            text,
            usage: {
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
            },
        };
    }

    async stream(
        messages: AiMessage[],
        onChunk: (text: string) => void,
        options?: AiChatOptions
    ): Promise<AiResponse> {
        const { systemPrompt, chatMessages } = this.convertMessages(messages);

        const stream = this.client.messages.stream({
            model: this.model,
            max_tokens: options?.maxTokens ?? 4096,
            system: systemPrompt ?? undefined,
            messages: chatMessages,
        });

        stream.on('text', (text) => {
            onChunk(text);
        });

        const finalMessage = await stream.finalMessage();

        const textBlock = finalMessage.content.find((block) => block.type === 'text');
        const text = textBlock && textBlock.type === 'text' ? textBlock.text : '';

        return {
            text,
            usage: {
                inputTokens: finalMessage.usage.input_tokens,
                outputTokens: finalMessage.usage.output_tokens,
            },
        };
    }

    /**
     * Convert AiMessage[] to Anthropic's format.
     * Anthropic requires the system prompt to be a separate parameter,
     * not part of the messages array.
     */
    private convertMessages(messages: AiMessage[]): {
        systemPrompt: string | null;
        chatMessages: Anthropic.MessageParam[];
    } {
        const systemParts: string[] = [];
        const chatMessages: Anthropic.MessageParam[] = [];

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemParts.push(msg.content);
            } else {
                chatMessages.push({
                    role: msg.role,
                    content: msg.content,
                });
            }
        }

        const systemPrompt = systemParts.length > 0 ? systemParts.join('\n\n') : null;
        return { systemPrompt, chatMessages };
    }
}
