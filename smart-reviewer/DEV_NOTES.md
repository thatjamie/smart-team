# Dev Notes — Step 6: Git Operations

## What was implemented
- `src/git.ts` — Read-only git operations module (192 lines):
  - `getProjectRoot(dir)` — find git toplevel via `git rev-parse --show-toplevel`
  - `getProjectName(projectRoot)` — basename of project root
  - `findDevWorktree(projectRoot)` — locate `../<name>-dev/` worktree per dev-agent convention
  - `getDiff(dir, base?)` — full diff against base branch (auto-detects main/master)
  - `getLatestDiff(dir)` — diff of HEAD~1 vs HEAD (for iteration reviews)
  - `guessBaseBranch(dir)` — detect main or master
  - `getCurrentBranch(dir)` — current branch name
  - `getLatestCommit(dir)` — short commit hash
- All operations are strictly read-only — reviewer never creates worktrees, commits, or modifies code

## Files changed
- `src/git.ts` — New file (192 lines). Exports 7 functions.

## Decisions made
- Used `spawnSync` with 30s timeout and 10MB maxBuffer for large diffs
- All functions return empty string or undefined on error — never throw to callers
- `findDevWorktree` follows dev-agent convention: `../<projectName>-dev/`
- `guessBaseBranch` tries `main` first, then `master`, defaults to `main`
- `getDiff` falls back from `diff main...HEAD` to `diff main HEAD` if triple-dot fails
- Avoided backticks in JSDoc comments and template literals to prevent TS compilation issues with the current tsconfig target
- Added `getCurrentBranch` and `getLatestCommit` helpers beyond plan spec — useful for tree view and context builder

## Questions for reviewer
- `getDiff` tries triple-dot first (shows changes on current branch only), then falls back to double-dot. Is the fallback appropriate, or should we just fail?
- Is 10MB maxBuffer sufficient for large diffs? Alternative: use streaming for very large repos.
