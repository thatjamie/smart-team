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

- **Decision**: `.vscodeignore` uses `src/**` exclusion (resolved in Step 6)
  - **Context**: Step 1 used `src/**` + negation whitelisting for `extension.ts` and `types.ts`
  - **Rationale**: Resolved in Step 6 — simplified to `src/**` (exclude all source) since only `out/` is needed at runtime. Also excludes `*.md` except `README.md` to keep the .vsix lean. `media/icon.svg` is included automatically as it's referenced in `package.json`
  - **Date**: 2025-04-25 (updated 2025-04-26)

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

## Step 5: Chat Handler
- **Decision**: Max interview rounds of 8 before forcing plan generation
  - **Context**: PLAN.md asks for maximum interview rounds
  - **Rationale**: 8 rounds (each with 2-4 questions) gives up to 32 questions — enough for complex projects. Prevents infinite interview loops
  - **Date**: 2025-04-26

- **Decision**: `/update` is single-turn, not multi-turn
  - **Context**: PLAN.md describes `/update` as a multi-turn flow but simpler UX is possible
  - **Rationale**: Users typically know what they want to change. Single-turn (describe changes → AI revises → done) is simpler and faster. If users need iteration, they can `/update` again
  - **Date**: 2025-04-26

- **Decision**: Approval detection via keyword matching
  - **Context**: Need to detect when user approves the plan during reviewing phase
  - **Rationale**: Keyword matching against 11 common approval phrases is simple, effective, and doesn't require AI calls. Edge cases where it misses an approval are handled by the user retrying
  - **Date**: 2025-04-26

## Step 6: Sidebar and Extension Activation
- **Decision**: Show plan outline (step titles) in sidebar, not full plan content
  - **Context**: PLAN.md asks whether to show full plan or just outline
  - **Rationale**: Full plan content would make the sidebar too long and hard to scan. Step titles give a quick overview; the full plan is already visible in the chat response. This matches VSCode sidebar conventions (concise, scannable)
  - **Date**: 2025-04-26

- **Decision**: File watcher scoped to project root with RelativePattern
  - **Context**: Need to watch `.planner-state.json` for sidebar auto-refresh
  - **Rationale**: `vscode.RelativePattern` scoped to the project root directory avoids watching state files from other projects or unrelated directories. Only create/change/delete events are needed
  - **Date**: 2025-04-26

- **Decision**: Sidebar layout: 3 sections (session info, interview history, plan outline)
  - **Context**: PLAN.md asks for exact sidebar layout details
  - **Rationale**: Session info is always expanded (most important context). Interview history and plan outline are collapsed by default (user expands when needed). Empty state shows helpful prompts. This gives a clear information hierarchy
  - **Date**: 2025-04-26

- **Decision**: `openProjectRoot` updates both VSCode setting and tree provider
  - **Context**: User changes project root via folder picker command
  - **Rationale**: Updating both the global setting and the tree provider ensures the chat handler (reads setting) and sidebar (reads state file from provider's root) stay consistent. Avoids stale state from mismatched roots
  - **Date**: 2025-04-26

- **Decision**: No test project content included for manual testing
  - **Context**: PLAN.md asks about test project content for manual testing
  - **Rationale**: The extension works on any existing project. Including a test project would add maintenance burden. Users can test with any workspace directory. The greenfield vs. brownfield auto-detection handles both cases
  - **Date**: 2025-04-26
