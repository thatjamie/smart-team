# Dev Notes — Step 2: AI Provider Abstraction (Iteration 2)

## What was implemented
- `AiProvider` interface with `chat()` and `stream()` methods
- `CopilotProvider` — VSCode Language Model Chat API (no API key needed)
- `AnthropicProvider` — Anthropic Claude SDK with streaming
- `OpenAIProvider` — OpenAI SDK with streaming
- `ProviderFactory` — reads `smart-reviewer.aiProvider` setting and creates the correct provider with API key validation

## Files changed
- `src/ai/provider.ts` — Core interfaces: `AiMessage`, `AiResponse`, `AiChatOptions`, `AiProvider`
- `src/ai/copilotProvider.ts` — VSCode LM API provider; fixed `modelOptions` instead of `maxTokens`, removed unavailable `usage`, made `convertMessages` synchronous
- `src/ai/anthropicProvider.ts` — Anthropic SDK provider; fixed system message concatenation for multiple system messages
- `src/ai/openaiProvider.ts` — OpenAI SDK provider, streaming via `stream: true`, usage captured from final chunk
- `src/ai/providerFactory.ts` — Static factory, reads config, validates API keys from SecretStorage with helpful error messages

## Decisions made
- CopilotProvider maps system messages to `LanguageModelChatMessage.User()` because VSCode's LM API doesn't have a dedicated system role
- AnthropicProvider extracts system messages from the array into the separate `system` parameter (required by Anthropic's API)
- Default maxTokens set to 4096 for all providers (overridable via options)
- ProviderFactory uses static method pattern for simplicity — no need to instantiate the factory
- API key storage keys in SecretStorage: `anthropicApiKey` and `openaiApiKey`
- Error messages reference a "Set API Key" command that will be implemented when the chat handler is built (Step 10/12)
- CopilotProvider returns `usage: undefined` since VSCode LM API doesn't expose token counts
- CopilotProvider uses `modelOptions: { maxTokens }` per actual `LanguageModelChatRequestOptions` type

## Review feedback addressed (iteration 2)
1. **BLOCKING — 8 TSC errors in CopilotProvider**: Fixed `maxTokens` → `modelOptions: { maxTokens }` (correct `LanguageModelChatRequestOptions` property). Removed `response.usage` access since `LanguageModelChatResponse` doesn't expose usage. Compilation now passes clean (0 errors).
2. **Bug — Anthropic system message concatenation**: Fixed `convertMessages` to collect all system messages into `systemParts[]` and join with `\n\n` instead of overwriting. Multiple system messages are now properly concatenated.
3. **Suggestion — async convertMessages**: Made `convertMessages` synchronous (removed `async`/`Promise` wrapper since it does no async work). Removed `_model` parameter as it was unused. Updated callers to remove `await`.

## Review feedback respectfully disputed
- None. All issues verified as correct and addressed. Compilation confirmed passing.
