# Dev Notes — Step 4: Shared Types

## What was implemented
- `src/types.ts` — All shared type definitions used across the extension (149 lines):
  - `StepStatus` enum: `pending`, `in-progress`, `complete`
  - `Step` interface: index, title, level, content, status, iteration, lastCommit
  - `Plan` interface: name, filePath, steps[]
  - `ProgressStepEntry`: label, status, iteration, lastCommit
  - `ProgressLastAction`: agent, action, timestamp
  - `Progress`: planName, branch, created, steps[], lastAction
  - `WorktreeInfo`: path, branch, exists
  - `ChangesRequiredItem`: description, howToFix, resolved
  - `ReviewFeedback`: stepIndex, stepTitle, summary, approvedItems[], changesRequired[], suggestions[], questions[], iteration, status

## Files changed
- `src/types.ts` — New file with all shared types (149 lines)

## Decisions made
- Used `enum` for `StepStatus` instead of string union — enables switch exhaustiveness checking and IDE autocomplete
- `Step.index` is zero-based to match array indices throughout the codebase
- `Step.level` captures heading depth (2 for `##`, 3 for `###`) to support hierarchical plans
- `ReviewFeedback.status` uses string union `'APPROVED' | 'CHANGES_REQUIRED'` instead of enum — only two values, and they appear as literal strings in the markdown
- `ChangesRequiredItem` includes a `resolved` boolean for tracking issue resolution across iterations
- `WorktreeInfo.exists` allows callers to check worktree availability without throwing
- All types are JSDoc-documented for IntelliSense support

## Questions for reviewer
- None. This step is a straightforward type definition file matching the plan spec exactly.
