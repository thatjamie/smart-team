# Dev Notes — Step 12: Extension Activation (Iteration 2)

## What was implemented
- `src/extension.ts` — Full extension activation wiring (201 lines, was 60 lines of stubs):
  - Plan root detection: scans workspace folders for PLAN.md using `findPlanFile`
  - TreeView registration: creates `ReviewTreeProvider` and `TreeView` with ID `smart-reviewer-overview`
  - Chat participant: registers `@smart-reviewer` with `handleChatRequest`, passes `context.secrets`
  - 8 commands wired to real implementations
  - 5 file watchers: PLAN.md, PROGRESS.md, DEV_NOTES.md, REVIEW_FEEDBACK.md, DECISIONS.md
  - Workspace folder change detection

## Files changed (iteration 2)
- `src/chatHandler.ts` — Refactored to use `buildReviewContext()` from contextBuilder (414 lines, was 440)
- `src/extension.ts` — Unchanged from iteration 1

## Review feedback addressed (iteration 2)
1. **BLOCKING — chatHandler duplicates context assembly**: Fixed. Replaced ~44 lines of inline context assembly (plan parsing, worktree finding, file reading, diff retrieval, promptContext building) with a single call to `buildReviewContext(planRoot, stepIndex, iteration)` from `src/contextBuilder.ts`. The chatHandler now focuses on routing, AI interaction, and user approval. Imports cleaned up — removed `parseDevNotes`, `parseDecisions`, `getDiffForStep`, `ReviewPromptContext` direct imports (now accessed via `reviewContext.promptContext`). Retained `getProjectRoot`/`findDevWorktree` for `handleStatus`.

## Decisions made
- Chat handler delegates context assembly to `buildReviewContext` — single point of change
- Step validation (index range, in-progress detection) still in chatHandler — it's routing logic, not context assembly
- `reviewContext.worktreePath` and `reviewContext.step.lastCommit` used in PROGRESS.md update phase
