# Dev Notes — Step 5: Git Operations

## What was implemented
- `gitRead.ts` — 10 read-only git functions: `execGit`, `isDirectory`, `getProjectRoot`, `getProjectName`, `findDevWorktree`, `getDiff`, `getLatestDiff`, `guessBaseBranch`, `getCurrentBranch`, `getLatestCommit`
- `gitWrite.ts` — 4 write git functions: `createDevWorktree`, `hasUncommittedChanges`, `commitChanges`, `removeWorktree`
- Updated `src/index.ts` barrel to export all 14 git functions

## Files changed
- `smart-team-common/src/git/gitRead.ts` — Read-only git operations (218 lines)
- `smart-team-common/src/git/gitWrite.ts` — Write git operations (87 lines)
- `smart-team-common/src/index.ts` — Added git operation exports

## Decisions made
- **`execGit` and `isDirectory` kept in `gitRead.ts`** — shared helpers used by both files; exporting them keeps `gitWrite.ts` simple without a separate shared module
- **`execGit` throws on non-zero exit** — callers wrap in try/catch for error-tolerant read ops; write ops let errors propagate
- **All read operations return empty string or undefined on error** — no thrown exceptions per acceptance criteria
- **`createDevWorktree` is idempotent** — checks for existing directory before creating
- **`getDiff` tries triple-dot first** (`base...HEAD`), falls back to double-dot (`base..HEAD`) on error

## Questions for reviewer
- None
