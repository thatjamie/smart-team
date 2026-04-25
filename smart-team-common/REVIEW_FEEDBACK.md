# Review Feedback — Step 2: AI Provider Implementations

## Summary

Step 2 delivers all three AI providers and the factory as specified in PLAN.md. The implementation is clean, well-documented with JSDoc, and compiles without errors. The dynamic `require()` pattern for optional peer dependencies is a sensible choice. All acceptance criteria are met. One minor issue to address.

## ✅ Approved Items

- **`src/ai/provider.ts`**: Clean re-export of AI type interfaces from `types.ts` for convenience, matching the plan's intent
- **`src/ai/copilotProvider.ts`**: Correctly implements `AiProvider` using `vscode.lm.selectChatModels()` and `LanguageModelChat.sendRequest()`. System messages properly mapped to User messages. Handles no-models-available case with descriptive error. Uses `modelOptions: { maxTokens }` matching the actual VSCode API surface
- **`src/ai/anthropicProvider.ts`**: Correctly separates system messages for the Anthropic API. Dynamic `require()` with descriptive error when SDK missing. Both `chat()` and `stream()` implemented. Usage captured from `finalMessage()` in streaming
- **`src/ai/openaiProvider.ts`**: Correctly implements both `chat()` and `stream()` with streaming usage capture via `stream_options: { include_usage: true }`. Dynamic `require()` with descriptive error when SDK missing
- **`src/ai/providerFactory.ts`**: Accepts `configNamespace` parameter (not hardcoded) so it works for both `smart-developer` and `smart-reviewer`. Reads `aiProvider` config with `copilot` default. Missing API keys throw descriptive errors. Unknown provider name throws descriptive error
- **`src/index.ts`**: Barrel export correctly expanded to include all 4 provider classes
- **Compilation**: `npm run compile` produces zero errors; all `.js`, `.d.ts`, `.map` files generated in `out/ai/`
- **DECISIONS.md**: 3 decisions logged for Step 2 with context and rationale
- **No VSCode runtime dependency in Anthropic/OpenAI providers**: Only `copilotProvider.ts` and `providerFactory.ts` import `vscode`, which is correct — they are instantiated by consumers who provide the VSCode context

## ❌ Changes Required

- [ ] **`loadSdk()` declared `async` but `require()` is synchronous** (`anthropicProvider.ts:111`, `openaiProvider.ts:102`): The `loadSdk()` method is declared as `async` returning `Promise<any>`, but its body only calls synchronous `require()`. This forces callers to `await` unnecessarily. Either:
  - **Option A (preferred)**: Remove `async` and return the value directly — `private loadSdk(): any { ... }`. Then remove `await` from callers (`const Anthropic = this.loadSdk();`).
  - **Option B**: Keep `async` if you anticipate future lazy/async loading (e.g., dynamic `import()`). This is acceptable but add a comment explaining the intent.

## 💡 Suggestions (Optional)

- **Streaming usage defaults to `{ inputTokens: 0, outputTokens: 0 }` instead of `undefined`**: In both `anthropicProvider.ts` (line 100-103) and `openaiProvider.ts` (line 91-94), the `stream()` method always returns `usage: { inputTokens, outputTokens }` even when no usage data is available. The `AiResponse.usage` field is typed as optional (`usage?:`). Consider returning `undefined` when usage data is not available, to be consistent with the `chat()` methods and the type contract. Non-blocking since `0` is semantically close to "no data".

## ❓ Questions

None.

## Iteration
- Iteration: 1/5
- Status: CHANGES_REQUIRED
