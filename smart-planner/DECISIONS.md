# Decisions Log — smart-planner

## Step 1: Extension Scaffold
- **Decision**: Re-export common types using `type` exports only
  - **Context**: PLAN.md specifies re-exporting all common types for convenience
  - **Rationale**: Matches common's own barrel export convention; `type` exports are erased at runtime, avoiding unnecessary imports in the bundled output
  - **Date**: 2025-04-25

- **Decision**: Added `.planner-state.json` to `.gitignore`
  - **Context**: Planner persists interview state to `.planner-state.json`
  - **Rationale**: Runtime state file should not be committed; it's specific to each user's active session
  - **Date**: 2025-04-25

- **Decision**: Used minimal activate stub with info message
  - **Context**: Full activation wiring is Step 6; Step 1 only needs a valid entry point
  - **Rationale**: Keeps step boundaries clear; the stub compiles and loads without errors
  - **Date**: 2025-04-25

- **Decision**: `.vscodeignore` uses `src/**` + negation pattern — revisit in Step 6
  - **Context**: Current pattern excludes `src/**` but whitelists `src/extension.ts` and `src/types.ts`
  - **Rationale**: Works for Step 1's file set but will need updating as Steps 2–6 add new modules. Since only `out/` is needed at runtime in the packaged extension, consider simplifying to just `src/` exclusion in Step 6 when `npx vsce package` is tested
  - **Date**: 2025-04-25
