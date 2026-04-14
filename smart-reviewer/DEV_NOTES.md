# Dev Notes — Step 2: AI Provider Abstraction

## What was implemented
- `AiProvider` interface with `chat()` and `stream()` methods
- `CopilotProvider` — VSCode Language Model Chat API (no API key needed)
- `AnthropicProvider` — Anthropic Claude SDK with streaming
- `OpenAIProvider` — OpenAI SDK with streaming
- `ProviderFactory` — reads `smart-reviewer.aiProvider` setting and creates the correct provider with API key validation

## Files changed
- `src/ai/provider.ts` — Core interfaces: `AiMessage`, `AiResponse`, `AiChatOptions`, `AiProvider`
- `src/ai/copilotProvider.ts` — VSCode LM API provider, model selection with Copilot vendor preference, system messages mapped to User role (VSCode LM limitation)
- `src/ai/anthropicProvider.ts` — Anthropic SDK provider, system prompt extracted as separate parameter (Anthropic API requirement), streaming via `client.messages.stream()`
- `src/ai/openaiProvider.ts` — OpenAI SDK provider, streaming via `stream: true`, usage captured from final chunk
- `src/ai/providerFactory.ts` — Static factory, reads config, validates API keys from SecretStorage with helpful error messages

## Decisions made
- CopilotProvider maps system messages to `LanguageModelChatMessage.User()` because VSCode's LM API doesn't have a dedicated system role
- AnthropicProvider extracts system messages from the array into the separate `system` parameter (required by Anthropic's API)
- Default maxTokens set to 4096 for all providers (overridable via options)
- ProviderFactory uses static method pattern for simplicity — no need to instantiate the factory
- API key storage keys in SecretStorage: `anthropicApiKey` and `openaiApiKey`
- Error messages reference a "Set API Key" command that will be implemented when the chat handler is built (Step 10/12)

## Questions for reviewer
- CopilotProvider treats system messages as user messages. This is a VSCode LM API limitation. Is this acceptable, or should we prefix system messages with a "System:" label to help the model distinguish them?
- The `_model` parameter in CopilotProvider's `convertMessages` is unused (kept for potential future model-specific message formatting). Is this okay?
