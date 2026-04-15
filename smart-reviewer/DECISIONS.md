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

- **Decision**: Return `usage: undefined` from CopilotProvider
  - **Context**: Review feedback identified that `LanguageModelChatResponse` doesn't expose a `usage` property in the current VSCode API types (`@types/vscode@1.115.0`)
  - **Rationale**: The VSCode LM API doesn't expose token counts. Since `AiResponse.usage` is optional, callers already handle `undefined`. If the API adds usage in the future, we can update the provider.
  - **Date**: 2025-04-14

- **Decision**: Use `modelOptions` instead of `maxTokens` in CopilotProvider
  - **Context**: Review feedback identified 8 TSC errors — `maxTokens` is not a valid `LanguageModelChatRequestOptions` property
  - **Rationale**: The correct API is `modelOptions: { maxTokens: N }` — a dictionary of model-specific options. Confirmed against actual type definitions.
  - **Date**: 2025-04-14

- **Decision**: Concatenate multiple system messages in AnthropicProvider
  - **Context**: Review feedback identified that multiple system messages were silently overwritten (only last kept)
  - **Rationale**: Anthropic's API accepts a single `system` string. When the messages array contains multiple system messages (e.g., role instructions + context), they should be joined with `\n\n` rather than discarding earlier ones.
  - **Date**: 2025-04-14

## Step 3: System Prompts
- **Decision**: Use XML-style tags to delimit dynamic context sections
  - **Context**: System prompt injects large blocks of dynamic content (PLAN.md, diff, etc.) alongside instructions
  - **Rationale**: XML tags like `<progress>`, `<dev-notes>`, `<diff>` help the AI distinguish injected content from prompt instructions. This is a common prompting best practice that improves accuracy.
  - **Date**: 2025-04-14

- **Decision**: Make `planFull` optional in ReviewPromptContext
  - **Context**: Full PLAN.md could be very large and bloat the prompt
  - **Rationale**: Most reviews only need the current step's requirements. The full plan is optional for cases where cross-step context matters (e.g., checking if a decision in Step 1 affects Step 5). The caller decides whether to include it.
  - **Date**: 2025-04-14

- **Decision**: Default test/lint results to "No results available" messages
  - **Context**: Test and lint results are optional — they may not be available for every review
  - **Rationale**: Always including these sections ensures the AI knows the categories exist and doesn't wonder whether it missed something. Explicit "not available" is better than absent section.
  - **Date**: 2025-04-14

- **Decision**: Explicitly mirror review-agent skill's REVIEW_FEEDBACK.md format
  - **Context**: The AI needs to produce output compatible with the dev-agent's feedback parsing
  - **Rationale**: Using the exact same format (Summary, ✅ Approved Items, ❌ Changes Required, 💡 Suggestions, ❓ Questions, Iteration, Status) ensures compatibility across the dev-agent/review-agent workflow.
  - **Date**: 2025-04-14

## Step 4: Shared Types
- **Decision**: Use `enum` for `StepStatus` instead of string union
  - **Context**: Need to represent step status (pending, in-progress, complete) across parsers, writers, and tree view
  - **Rationale**: Enum enables switch exhaustiveness checking and IDE autocomplete. String unions are fine for two-value types but `StepStatus` has three values and may grow.
  - **Date**: 2025-04-14

- **Decision**: Zero-based `Step.index` matching array indices
  - **Context**: Steps need a numeric index for reference
  - **Rationale**: Zero-based indices match JavaScript array access patterns used in parsers and tree view. Display can add 1 for user-facing labels.
  - **Date**: 2025-04-14

- **Decision**: `ReviewFeedback.status` as string union, not enum
  - **Context**: Status is either APPROVED or CHANGES_REQUIRED
  - **Context**: Only two values that appear as literal strings in REVIEW_FEEDBACK.md markdown
  - **Rationale**: String union is simpler for a two-value type and matches the literal text parsed from markdown files.
  - **Date**: 2025-04-14

- **Decision**: `ChangesRequiredItem` includes `resolved` boolean
  - **Context**: Need to track which blocking issues have been addressed across review iterations
  - **Rationale**: The `resolved` field allows the tree view to show issue counts and the chat handler to summarize outstanding vs resolved items.
  - **Date**: 2025-04-14

## Step 5: Parsers
- **Decision**: Use regex-based parsing instead of markdown AST library
  - **Context**: Need to parse structured markdown files (PLAN.md, PROGRESS.md, DEV_NOTES.md, etc.)
  - **Rationale**: The markdown formats are simple and well-defined by our own conventions. Adding a markdown AST library (like marked, remark) would add a dependency for minimal benefit. Regex parsing is sufficient and keeps the extension lightweight.
  - **Date**: 2025-04-14

- **Decision**: Graceful degradation — return undefined/empty on missing or malformed files
  - **Context**: Parsers may be called before all workflow files exist
  - **Rationale**: The extension should work even when only some shared state files are present (e.g., PROGRESS.md exists but REVIEW_FEEDBACK.md doesn't). Callers check for undefined rather than handling exceptions.
  - **Date**: 2025-04-14

- **Decision**: Define `DevNotes` and `Decision` interfaces in their respective parser files, not types.ts
  - **Context**: These types are parser-specific output formats, not cross-cutting shared types
  - **Rationale**: `types.ts` contains the canonical data model shared across the whole extension. Parser-specific result types stay co-located with their parsers for discoverability and to avoid bloating types.ts.
  - **Date**: 2025-04-14

- **Decision**: `parsePlan` accepts optional `progressOverrides` Map parameter
  - **Context**: Step statuses come from PROGRESS.md, not PLAN.md itself
  - **Rationale**: The caller reads PROGRESS.md first, then passes status overrides to `parsePlan`. This keeps the plan parser focused on markdown structure while allowing status enrichment.
  - **Date**: 2025-04-14
