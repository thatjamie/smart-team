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

## Step 2: System Prompts
- **Decision**: No few-shot examples in prompts
  - **Context**: PLAN.md asks whether to include example plans for few-shot guidance
  - **Rationale**: The template is detailed enough for the AI to follow; adding full example plans would significantly increase token usage per request (potentially thousands of extra tokens). If few-shot is needed later, it can be added as an optional enhancement
  - **Date**: 2025-04-26

- **Decision**: Group interview history by round in interview prompt
  - **Context**: Interview QA is stored as a flat list; needs formatting for the prompt
  - **Rationale**: Grouping by round gives the AI clearer context about the progression of the interview and helps it understand which topics have been covered in which conversation turns
  - **Date**: 2025-04-26

- **Decision**: Plan update prompt outputs both PLAN.md and PROGRESS.md
  - **Context**: Plan updates may renumber or add/remove steps, which requires PROGRESS.md to stay in sync
  - **Rationale**: Using `[PROGRESS_START]`/`[PROGRESS_END]` markers lets the chat handler extract both files from a single AI response, ensuring atomicity of the update
  - **Date**: 2025-04-26

## Step 3: Codebase Explorer and State Manager
- **Decision**: Max file tree depth of 4, max 200 entries
  - **Context**: PLAN.md says depth 4; needed to decide on entry limit too
  - **Rationale**: Depth 4 shows enough structure for most projects. 200 entries prevents huge trees from large repos (like monorepos with many packages) from consuming all the AI's context window
  - **Date**: 2025-04-26

- **Decision**: Only read file contents for config files, not source files
  - **Context**: PLAN.md leaves it to the dev-agent to decide whether to read file contents beyond config/entry-point files
  - **Rationale**: Reading source files would dramatically increase exploration time and token usage in the AI prompt. The file tree, config files, and conventions provide enough context for the planner to ask informed questions
  - **Date**: 2025-04-26

- **Decision**: Immutable state update pattern in stateManager
  - **Context**: State is passed through multiple transformations during the planning flow
  - **Rationale**: Immutable updates (spread + return new object) prevent accidental mutation bugs, especially important in a multi-phase flow where state is saved/loaded between turns
  - **Date**: 2025-04-26

## Step 4: Plan Writer
- **Decision**: Non-blocking validation for plan content
  - **Context**: PLAN.md asks how strict validation should be
  - **Rationale**: AI output may vary in formatting (e.g., missing blank lines, slightly different heading styles). Blocking on validation would reject valid plans. Warnings via `console.warn` give visibility without blocking the flow
  - **Date**: 2025-04-26
