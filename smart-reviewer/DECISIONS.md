# Decisions Log — smart-reviewer

## Step 1: Extension Scaffold
- **Decision**: Use `onStartupFinished` activation event
  - **Context**: Plan didn't specify activation events
  - **Rationale**: Extension should be ready when user opens workspace; `onStartupFinished` avoids blocking VSCode startup while ensuring the extension is available
  - **Date**: 2025-04-14

- **Decision**: Register all commands as stubs with info messages
  - **Context**: Step 1 only requires the scaffold; commands are implemented in later steps
  - **Rationale**: Each command (reviewStep, approveStep, etc.) depends on parsers, AI providers, and writers from Steps 2-7. Registering stubs now ensures package.json contributions are correct and the extension loads cleanly.
  - **Date**: 2025-04-14

- **Decision**: Use Feather Icons eye SVG for the icon
  - **Context**: Plan specified "eye/review icon" for `media/icon.svg`
  - **Rationale**: Feather Icons' eye icon is clean, recognizable, and uses `currentColor` so it adapts to VSCode's theme (light/dark)
  - **Date**: 2025-04-14

- **Decision**: Set `@types/vscode` to `^1.90.0` matching `engines.vscode`
  - **Context**: Plan specified VSCode extension
  - **Rationale**: API types should match the minimum engine version to avoid using APIs not available in the target version
  - **Date**: 2025-04-14

- **Decision**: Remove API key settings from contributes.configuration, use SecretStorage only
  - **Context**: Review feedback identified that API keys in contributes.configuration are stored in plaintext settings.json
  - **Rationale**: Plan explicitly says "secret, use vscode.SecretStorage". SecretStorage encrypts keys and keeps them out of settings.json. API keys will be set via a command/UI flow in Step 2.
  - **Date**: 2025-04-14

- **Decision**: Simplify .vscodeignore to avoid conflicting negation patterns
  - **Context**: Review feedback identified that `**/*.ts` undid the `!src/extension.ts` negation
  - **Rationale**: Since `npm run compile` outputs to `out/` (which is not excluded), compiled JS will be packaged. No need to include source files. Clean rules: exclude src, maps, node_modules, dev configs, and markdown; explicitly include media/.
  - **Date**: 2025-04-14

## Step 2: AI Provider Abstraction
- **Decision**: Map system messages to User role in CopilotProvider
  - **Context**: VSCode's Language Model Chat API doesn't have a system message role — only User and Assistant
  - **Rationale**: Sending system instructions as User messages is the standard workaround. The LLM still treats them as instructions. Alternative (prefixing "System:") adds token overhead without clear benefit.
  - **Date**: 2025-04-14

- **Decision**: Extract system messages as separate parameter for Anthropic
  - **Context**: Anthropic's Messages API requires system prompts as a top-level `system` parameter, not in the messages array
  - **Rationale**: This is a hard API requirement, not a choice. The `convertMessages` helper extracts system messages and passes them correctly.
  - **Date**: 2025-04-14

- **Decision**: Default maxTokens of 4096 for all providers
  - **Context**: Plan doesn't specify default token limits
  - **Rationale**: 4096 is sufficient for most review responses while being conservative enough to avoid hitting rate limits. Overrideable via `AiChatOptions.maxTokens`.
  - **Date**: 2025-04-14

- **Decision**: Use static factory method pattern for ProviderFactory
  - **Context**: Need a way to create the right provider based on settings
  - **Rationale**: No state needs to be maintained in the factory — a static `create()` method is simpler than managing a factory instance.
  - **Date**: 2025-04-14
