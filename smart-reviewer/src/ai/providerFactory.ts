import * as vscode from 'vscode';
import { AiProvider } from './provider';
import { CopilotProvider } from './copilotProvider';
import { AnthropicProvider } from './anthropicProvider';
import { OpenAIProvider } from './openaiProvider';

/**
 * Factory for creating AI provider instances based on user settings.
 *
 * Reads `smart-reviewer.aiProvider` to determine which provider to use,
 * and validates that required API keys are available for non-Copilot providers.
 */
export class ProviderFactory {
    /**
     * Create an AI provider based on the current configuration.
     *
     * @param secretStorage - VSCode SecretStorage for reading API keys
     * @returns An initialized AiProvider
     * @throws Error if the selected provider requires an API key that is missing
     */
    static async create(secretStorage: vscode.SecretStorage): Promise<AiProvider> {
        const config = vscode.workspace.getConfiguration('smart-reviewer');
        const providerName = config.get<string>('aiProvider', 'copilot');

        switch (providerName) {
            case 'copilot':
                return new CopilotProvider();

            case 'anthropic':
                return await ProviderFactory.createAnthropic(secretStorage, config);

            case 'openai':
                return await ProviderFactory.createOpenai(secretStorage, config);

            default:
                throw new Error(
                    `Unknown AI provider: "${providerName}". ` +
                    'Valid options are: copilot, anthropic, openai.'
                );
        }
    }

    /**
     * Create the Anthropic provider with API key validation.
     */
    private static async createAnthropic(
        secretStorage: vscode.SecretStorage,
        config: vscode.WorkspaceConfiguration
    ): Promise<AnthropicProvider> {
        const apiKey = await secretStorage.get('anthropicApiKey');
        if (!apiKey) {
            throw new Error(
                'Anthropic API key not set. Use the "Smart Reviewer: Set Anthropic API Key" command to configure it.'
            );
        }

        const model = config.get<string>('anthropicModel', 'claude-sonnet-4-20250514');
        const baseUrl = config.get<string>('anthropicBaseUrl', '');
        return new AnthropicProvider(apiKey, model, baseUrl || undefined);
    }

    /**
     * Create the OpenAI provider with API key validation.
     */
    private static async createOpenai(
        secretStorage: vscode.SecretStorage,
        config: vscode.WorkspaceConfiguration
    ): Promise<OpenAIProvider> {
        const apiKey = await secretStorage.get('openaiApiKey');
        if (!apiKey) {
            throw new Error(
                'OpenAI API key not set. Use the "Smart Reviewer: Set OpenAI API Key" command to configure it.'
            );
        }

        const model = config.get<string>('openaiModel', 'gpt-4o');
        const baseUrl = config.get<string>('openaiBaseUrl', '');
        return new OpenAIProvider(apiKey, model, baseUrl || undefined);
    }
}
