# Dev Notes — Step 1: Project Scaffold and Types

## What was implemented
- Created `package.json` as a local npm package with proper peer dependencies (optional) and dev dependencies
- Created `tsconfig.json` targeting ES2022/CommonJS with strict mode, declarations, and source maps
- Created `.gitignore` excluding `node_modules/` and `out/`
- Defined all 15 shared types in `src/types.ts` (1 enum + 14 interfaces)
- Created `src/index.ts` barrel export re-exporting all types

## Files changed
- `smart-team-common/package.json` — NPM package manifest with no runtime dependencies
- `smart-team-common/tsconfig.json` — TypeScript compiler config
- `smart-team-common/.gitignore` — Git exclusions
- `smart-team-common/src/types.ts` — All shared types (StepStatus, Step, Plan, Progress, WorktreeInfo, ReviewFeedback, Decision, DevNotes, AiMessage, AiResponse, AiChatOptions, AiProvider)
- `smart-team-common/src/index.ts` — Barrel export

## Decisions made
- **Peer deps are optional**: Added `peerDependenciesMeta` to mark `@anthropic-ai/sdk` and `openai` as optional so consumers that only use one provider don't get warnings
- **`@types/node` included**: Added as devDependency since git operations (Step 5) will need `child_process` types and it's standard for Node.js packages
- **AI interfaces in types.ts**: Kept AiMessage/AiResponse/AiChatOptions/AiProvider in `src/types.ts` as specified in the PLAN rather than a separate `ai/provider.ts`, since they're purely type definitions with no runtime code

## Questions for reviewer
- None
