import * as vscode from 'vscode';
import type { AiProvider, AiMessage, AiResponse, AiChatOptions } from '../types';

/**
 * AI provider backed by VSCode's Language Model API (GitHub Copilot).
 *
 * The provider receives the `vscode.lm` namespace at construction time,
 * so it does not import `vscode` at runtime — the consumer passes it in.
 * System messages are mapped to User messages since the VSCode LM API
 * has no dedicated system role.
 */
export class CopilotProvider implements AiProvider {
    private readonly lm: typeof vscode.lm;

    /**
     * @param lm - The `vscode.lm` namespace, passed by the consumer.
     */
    constructor(lm: typeof vscode.lm) {
        this.lm = lm;
    }

    /** @inheritdoc */
    async chat(messages: AiMessage[], options?: AiChatOptions): Promise<AiResponse> {
        const chatMessages = this.toChatMessages(messages);
        const model = await this.selectModel();

        const response = await model.sendRequest(chatMessages, {
            modelOptions: options?.maxTokens
                ? { maxTokens: options.maxTokens }
                : undefined,
        });

        let text = '';
        for await (const part of response.stream) {
            if (part instanceof vscode.LanguageModelTextPart) {
                text += part.value;
            }
        }

        return { text };
    }

    /** @inheritdoc */
    async stream(
        messages: AiMessage[],
        onChunk: (text: string) => void,
        options?: AiChatOptions
    ): Promise<AiResponse> {
        const chatMessages = this.toChatMessages(messages);
        const model = await this.selectModel();

        const response = await model.sendRequest(chatMessages, {
            modelOptions: options?.maxTokens
                ? { maxTokens: options.maxTokens }
                : undefined,
        });

        let text = '';
        for await (const part of response.stream) {
            if (part instanceof vscode.LanguageModelTextPart) {
                text += part.value;
                onChunk(part.value);
            }
        }

        return { text };
    }

    /**
     * Select a chat model from the available Copilot models.
     * @throws Error if no models are available.
     */
    private async selectModel(): Promise<vscode.LanguageModelChat> {
        const models = await this.lm.selectChatModels({});
        if (models.length === 0) {
            throw new Error(
                'No Copilot chat models available. Ensure GitHub Copilot is installed and enabled.'
            );
        }
        return models[0];
    }

    /**
     * Convert {@link AiMessage} array to VSCode LanguageModelChatMessage array.
     * System messages are mapped to User messages since VSCode LM has no system role.
     */
    private toChatMessages(
        messages: AiMessage[]
    ): vscode.LanguageModelChatMessage[] {
        return messages.map((msg) => {
            if (msg.role === 'assistant') {
                return vscode.LanguageModelChatMessage.Assistant(msg.content);
            }
            // Both 'user' and 'system' are sent as User messages
            return vscode.LanguageModelChatMessage.User(msg.content);
        });
    }
}
