# Dev Notes — Step 1: Extension Scaffold

## What was implemented
- Full VSCode extension manifest (`package.json`) with chat participant, activity bar, tree view, commands, and settings
- TypeScript build configuration (`tsconfig.json`) matching common package conventions
- Packaging and VCS ignore files (`.vscodeignore`, `.gitignore`)
- Extension entry point (`src/extension.ts`) with activate/deactivate stubs
- Planner-specific types (`src/types.ts`) with re-exports from smart-team-common and new interfaces
- Clipboard/checklist icon (`media/icon.svg`) for activity bar and branding
- Built smart-team-common dependency in the worktree to resolve type declarations
- Verified `npm run compile` produces zero errors

## Files changed
- `package.json` — Extension manifest with all contributes (chat participant, views, commands, configuration)
- `tsconfig.json` — TypeScript config (ES2022, commonjs, strict, matching common conventions)
- `.vscodeignore` — Excludes source/dev files from .vsix packaging
- `.gitignore` — Excludes node_modules, out, .vsix, .planner-state.json
- `src/extension.ts` — Stub activate/deactivate (full wiring in Step 6)
- `src/types.ts` — Re-exports from smart-team-common + PlannerPhase, PlannerState, CodebaseSummary, InterviewQA, PlannerContext
- `media/icon.svg` — Clipboard with checklist SVG icon

## Decisions made
- Used `type` exports for interfaces from common (following common's own barrel export convention)
- Added `.planner-state.json` to `.gitignore` since it's runtime state, not source code
- `.vscodeignore` excludes most of `src/` but keeps `src/extension.ts` and `src/types.ts` for source map support in packaged extension

## Review feedback addressed (iteration 2)
- **Issue 1**: Added `.vscodeignore` packaging concern to `DECISIONS.md` — the reviewer correctly noted that `DEV_NOTES.md` is overwritten between steps, so this decision needs to persist in `DECISIONS.md` for Step 6 awareness. Added as a new decision entry with plan to revisit during `npx vsce package` testing.
