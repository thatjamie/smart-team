# Dev Notes — Step 3: Codebase Explorer and State Manager

## What was implemented
- Codebase exploration engine (`src/codebaseExplorer.ts`) — `exploreCodebase(projectRoot)` detects languages, frameworks, entry points, conventions, test frameworks, config files, and builds a recursive file tree
- Interview state persistence (`src/stateManager.ts`) — `loadState`, `saveState`, `clearState`, `createInitialState`, plus helper functions `updatePhase`, `addInterviewQA`, `setDraftPlan`, `setCodebaseSummary` for immutable state updates
- Verified `npm run compile` produces zero errors

## Files changed
- `src/codebaseExplorer.ts` — Full exploration engine with:
  - Language detection from 12 config file indicators (TS, JS, Rust, Python, Go, Java, Ruby, PHP)
  - Framework detection from package.json deps and Python/Go/Rust config files (22 frameworks)
  - Recursive file tree builder (depth 4, max 200 entries, skips 19 noise directories)
  - Entry point detection from 21 well-known candidates + package.json "main" field
  - Convention detection: naming patterns (kebab, camel, snake, Pascal), organization (by feature vs type), linting config
  - Test framework detection from package.json deps, Python configs, Go/Rust conventions
  - Config file detection (30+ well-known config filenames)
  - Graceful handling for non-existent directories (returns empty summary)
- `src/stateManager.ts` — State persistence with:
  - `loadState` with shape validation (returns undefined for corrupted/missing state)
  - `saveState` writes JSON with pretty-printing
  - `clearState` deletes the state file
  - `createInitialState` creates a fresh idle state
  - Immutable helper functions: `updatePhase`, `addInterviewQA`, `setDraftPlan`, `setCodebaseSummary`

## Decisions made
- Max file tree depth: 4 levels — deep enough to see project structure without overwhelming the AI prompt
- Max file tree entries: 200 — prevents huge trees from large repos, with "... (truncated)" marker
- Only read file contents for config files (package.json, requirements.txt, pyproject.toml) — don't read source file contents during exploration (keeps exploration fast and within reasonable token limits)
- State manager uses immutable update pattern (spread + return new object) — safer for multi-step flows where state is passed through multiple transformations
- All state update helpers also update `lastActivity` timestamp — useful for detecting stale sessions

## Questions for reviewer
- None
