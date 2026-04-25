import * as vscode from 'vscode';
import type { AiProvider } from '../types';
import { CopilotProvider } from './copilotProvider';
import { AnthropicProvider } from './anthropicProvider';
import { OpenAIProvider } from './openaiProvider';

/**
 * Factory for creating AI provider instances based on VSCode configuration.
 *
 * The factory reads the `aiProvider` setting from the given configuration namespace,
 * so it works for both Smart Developer and Smart Reviewer extensions:
 *
 * ```ts
 * // Smart Developer
 * const provider = await ProviderFactory.create(secretStorage, 'smart-developer');
 *
 * // Smart Reviewer
 * const provider = await ProviderFactory.create(secretStorage, 'smart-reviewer');
 * ```
 */
export class ProviderFactory {
    /**
     * Create an AI provider based on configuration.
     *
     * @param secretStorage - VSCode SecretStorage for API keys.
     * @param configNamespace - Configuration namespace (e.g., 'smart-developer' or 'smart-reviewer').
     * @returns An {@link AiProvider} instance matching the configured provider.
     * @throws Error if the configured provider requires an API key that is missing.
     * @throws Error if the configured provider name is not recognized.
     */
    static async create(
        secretStorage: vscode.SecretStorage,
        configNamespace: string
    ): Promise<AiProvider> {
        const config = vscode.workspace.getConfiguration(configNamespace);
        const providerName = config.get<string>('aiProvider', 'copilot');

        switch (providerName) {
            case 'copilot':
                return new CopilotProvider(vscode.lm);

            case 'anthropic': {
                const apiKey = await secretStorage.get(`${configNamespace}.anthropicApiKey`);
                if (!apiKey) {
                    throw new Error(
                        `Anthropic API key not found. Set the API key via "${configNamespace}.anthropicApiKey" in SecretStorage.`
                    );
                }
                const model = config.get<string>('anthropicModel', 'claude-sonnet-4-20250514');
                const baseUrl = config.get<string>('anthropicBaseUrl');
                return new AnthropicProvider(apiKey, model, baseUrl);
            }

            case 'openai': {
                const apiKey = await secretStorage.get(`${configNamespace}.openaiApiKey`);
                if (!apiKey) {
                    throw new Error(
                        `OpenAI API key not found. Set the API key via "${configNamespace}.openaiApiKey" in SecretStorage.`
                    );
                }
                const model = config.get<string>('openaiModel', 'gpt-4o');
                const baseUrl = config.get<string>('openaiBaseUrl');
                return new OpenAIProvider(apiKey, model, baseUrl);
            }

            default:
                throw new Error(
                    `Unknown AI provider "${providerName}". Supported providers: copilot, anthropic, openai.`
                );
        }
    }
}
