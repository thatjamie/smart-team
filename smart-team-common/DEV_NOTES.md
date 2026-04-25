# Dev Notes — Step 2: AI Provider Implementations

## What was implemented
- `CopilotProvider` — VSCode Language Model API provider using `vscode.lm.selectChatModels()` and `LanguageModelChat.sendRequest()`
- `AnthropicProvider` — Anthropic API (Claude) provider with system message separation and streaming
- `OpenAIProvider` — OpenAI API (GPT) provider with streaming and usage capture
- `ProviderFactory` — Factory that reads `aiProvider` config from a namespace parameter
- `provider.ts` — Re-exports AI type interfaces from `types.ts` for convenience
- Updated `src/index.ts` barrel to export all 4 provider classes

## Files changed
- `smart-team-common/src/ai/provider.ts` — Re-exports AI type interfaces (AiMessage, AiResponse, AiChatOptions, AiProvider)
- `smart-team-common/src/ai/copilotProvider.ts` — CopilotProvider class using VSCode LM API
- `smart-team-common/src/ai/anthropicProvider.ts` — AnthropicProvider class with dynamic SDK loading
- `smart-team-common/src/ai/openaiProvider.ts` — OpenAIProvider class with dynamic SDK loading
- `smart-team-common/src/ai/providerFactory.ts` — ProviderFactory with namespace-based config
- `smart-team-common/src/index.ts` — Expanded barrel export with AI providers

## Decisions made
- **Dynamic require for peer deps**: Anthropic and OpenAI SDKs loaded via `require()` at call time, not at import time. This allows the package to compile without the optional peer dependencies installed, and defers the error to runtime with a descriptive message if the SDK is missing.
- **CopilotProvider receives `vscode.lm` in constructor**: As specified in PLAN, the provider is instantiated with the `vscode.lm` namespace passed by the consumer.
- **Copilot response parsing**: VSCode LM API uses `response.stream` (async iterable of `LanguageModelTextPart`/`LanguageModelToolCallPart`), not `response.text`. Usage info is not available from the VSCode LM API in the current `@types/vscode@1.90.0`.
- **`modelOptions` instead of `maxTokens`**: VSCode's `LanguageModelChatRequestOptions` uses `modelOptions?: Record<string, any>` for provider-specific options, not a direct `maxTokens` property.

## Questions for reviewer
- None

## Review feedback addressed (iteration 2)
- **`loadSdk()` was async but used sync `require()`**: Removed `async` and `Promise<any>` return type. Changed to synchronous `loadSdk(): any`. Removed `await` from all callers in both `anthropicProvider.ts` and `openaiProvider.ts`.
- **Streaming usage defaults to `{ inputTokens: 0, outputTokens: 0 }` instead of `undefined`**: Fixed both providers. `stream()` now returns `usage: undefined` when no usage data is available, consistent with `chat()` methods and the optional `AiResponse.usage` type contract.
