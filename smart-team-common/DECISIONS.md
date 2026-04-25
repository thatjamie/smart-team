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
