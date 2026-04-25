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

## Step 3: Parsers
- **Decision**: `parsePlan` returns Plan with empty steps on error instead of throwing
  - **Context**: Plan said parsers should return undefined/[] for missing files; planParser is special because it's the entry point
  - **Rationale**: Consumers can check `steps.length === 0` to detect failure; avoids null-checking on the Plan object itself
  - **Date**: 2025-04-25

- **Decision**: Only `##` headings are treated as steps; `###` and deeper are sub-sections
  - **Context**: PLAN.md uses both `## Step N: Title` and `### Requirements`, `### Implementation Notes` etc.
  - **Rationale**: Steps map to `##` headings as specified in PLAN; sub-sections belong to their parent step's content
  - **Date**: 2025-04-25

- **Decision**: `findPlanFile` checks for PLAN.md at current directory before enqueuing subdirectories (BFS)
  - **Context**: Plan specified "breadth-first recursive search"
  - **Rationale**: BFS ensures we find the shallowest PLAN.md first, which is most likely the correct one
  - **Date**: 2025-04-25

## Step 4: Writers
- **Decision**: `updateProgressStep` and `updateLastAction` are pure functions returning new Progress objects
  - **Context**: Plan didn't specify mutability semantics
  - **Rationale**: Immutable updates prevent accidental mutation of shared state; callers can chain updates then write once
  - **Date**: 2025-04-25

- **Decision**: `appendDecision` creates the file with a header if it doesn't exist
  - **Context**: Plan asked dev-agent to decide this
  - **Rationale**: Simplifies caller code — no need to check file existence before first append
  - **Date**: 2025-04-25

## Step 5: Git Operations
- **Decision**: `execGit` and `isDirectory` kept in `gitRead.ts` as shared helpers
  - **Context**: Plan asked whether to separate into own file
  - **Rationale**: Both files need these helpers; a separate file adds complexity for 2 functions. Exporting from gitRead.ts keeps gitWrite.ts clean.
  - **Date**: 2025-04-25

- **Decision**: `execGit` throws on non-zero exit code; read ops catch internally
  - **Context**: Plan specified "no thrown exceptions" for read operations
  - **Rationale**: Keeps `execGit` simple and testable; each read function wraps in try/catch to return safe defaults. Write ops intentionally let errors propagate.
  - **Date**: 2025-04-25
