import * as vscode from 'vscode';
import { AiProvider, AiMessage, AiResponse, AiChatOptions } from './provider';

/**
 * AI provider using VSCode's built-in Language Model API (Copilot).
 * No API key needed — uses the user's Copilot subscription.
 */
export class CopilotProvider implements AiProvider {
    async chat(messages: AiMessage[], options?: AiChatOptions): Promise<AiResponse> {
        const model = await this.selectModel();
        const chatMessages = this.convertMessages(messages);
        const response = await model.sendRequest(chatMessages, {
            modelOptions: { maxTokens: options?.maxTokens },
        });

        let text = '';
        for await (const chunk of response.text) {
            text += chunk;
        }

        return {
            text,
            // VSCode LM API does not expose token usage
            usage: undefined,
        };
    }

    async stream(
        messages: AiMessage[],
        onChunk: (text: string) => void,
        options?: AiChatOptions
    ): Promise<AiResponse> {
        const model = await this.selectModel();
        const chatMessages = this.convertMessages(messages);
        const response = await model.sendRequest(chatMessages, {
            modelOptions: { maxTokens: options?.maxTokens },
        });

        let text = '';
        for await (const chunk of response.text) {
            text += chunk;
            onChunk(chunk);
        }

        return {
            text,
            // VSCode LM API does not expose token usage
            usage: undefined,
        };
    }

    /**
     * Select a language model from VSCode's available models.
     * Prefers models from the Copilot family.
     */
    private async selectModel(): Promise<vscode.LanguageModelChat> {
        const models = await vscode.lm.selectChatModels({
            vendor: 'copilot',
        });

        if (models.length === 0) {
            // Fallback: try without vendor filter
            const allModels = await vscode.lm.selectChatModels();
            if (allModels.length === 0) {
                throw new Error(
                    'No language models available. Ensure GitHub Copilot is installed and enabled.'
                );
            }
            return allModels[0];
        }

        return models[0];
    }

    /**
     * Convert AiMessage[] to vscode.LanguageModelChatMessage[].
     * System messages are mapped to User role since VSCode's LM API
     * doesn't have a dedicated system role.
     */
    private convertMessages(
        messages: AiMessage[]
    ): vscode.LanguageModelChatMessage[] {
        return messages.map((msg) => {
            switch (msg.role) {
                case 'system':
                    return vscode.LanguageModelChatMessage.User(msg.content);
                case 'user':
                    return vscode.LanguageModelChatMessage.User(msg.content);
                case 'assistant':
                    return vscode.LanguageModelChatMessage.Assistant(msg.content);
            }
        });
    }
}
