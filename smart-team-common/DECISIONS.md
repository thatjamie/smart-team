# Decisions Log — smart-team-common

## Step 1: Project Scaffold and Types
- **Decision**: Made peer dependencies optional via `peerDependenciesMeta`
  - **Context**: Consumers may only use one AI provider (e.g., Copilot-only users don't need `@anthropic-ai/sdk`)
  - **Rationale**: Prevents `npm warn peer dep missing` for providers the consumer doesn't use
  - **Date**: 2025-04-25

- **Decision**: Included `@types/node` as devDependency
  - **Context**: Plan left this as a dev-agent decision
  - **Rationale**: Needed for `child_process` types in git operations (Step 5) and general Node.js API types
  - **Date**: 2025-04-25

- **Decision**: Kept AI types in `src/types.ts` rather than separate `ai/provider.ts`
  - **Context**: Plan Step 2 suggested either location
  - **Rationale**: AI interfaces are pure type definitions with no runtime code; grouping with other types keeps imports simpler. Step 2 can re-export from types.ts.
  - **Date**: 2025-04-25

## Step 2: AI Provider Implementations
- **Decision**: Use dynamic `require()` for Anthropic/OpenAI SDKs instead of static imports
  - **Context**: These are optional peer dependencies not installed in this package. TypeScript cannot resolve `import()` for modules without type declarations.
  - **Rationale**: Allows compilation without the peer deps; defers missing-SDK errors to runtime with descriptive messages. Uses `any` return type to avoid needing the SDK types at compile time.
  - **Date**: 2025-04-25

- **Decision**: CopilotProvider does not return usage data
  - **Context**: `@types/vscode@1.90.0` LanguageModelChatResponse does not expose a `usage` property
  - **Rationale**: The VSCode LM API may add usage in future versions; for now, `AiResponse.usage` is undefined for Copilot. This is acceptable since `usage` is optional in the interface.
  - **Date**: 2025-04-25

- **Decision**: Use `modelOptions: { maxTokens }` for Copilot instead of direct `maxTokens`
  - **Context**: VSCode's `LanguageModelChatRequestOptions` has `modelOptions?: Record<string, any>` for provider-specific settings, not a typed `maxTokens` field
  - **Rationale**: Matches the actual `@types/vscode` API surface
  - **Date**: 2025-04-25
