# Dev Notes — Step 11: Context Builder

## What was implemented
- `src/contextBuilder.ts` — Context assembly module (145 lines):
  - `ReviewContextResult` interface — bundles plan, step, iteration, progress, worktree path, and assembled prompt context
  - `buildReviewContext(planRoot, stepIndex, iteration)` — full context assembly:
    1. Parse PLAN.md and PROGRESS.md
    2. Find dev worktree
    3. Parse DEV_NOTES.md and DECISIONS.md
    4. Get diff via diffViewer
    5. Assemble `ReviewPromptContext` with all gathered data
  - `buildCurrentStepContext(planRoot)` — convenience function that auto-detects the current in-progress step
  - `readTextFile()` helper with fallback

## Files changed
- `src/contextBuilder.ts` — New file (145 lines). Exports `ReviewContextResult`, `buildReviewContext()`, `buildCurrentStepContext()`

## Decisions made
- Returns `undefined` on any error (no plan found, no worktree, invalid step index) — consistent with parser patterns
- `buildCurrentStepContext` is a convenience wrapper that finds the in-progress step and delegates to `buildReviewContext`
- Iteration is computed from PROGRESS.md (existing iteration + 1)
- `planFull` includes full step content (matching the fix from Step 10 iteration 2)
- `readTextFile` helper centralizes the "read file or return fallback" pattern used previously inline in chatHandler
- This module does NOT depend on VSCode APIs — pure data assembly, testable in isolation

## Questions for reviewer
- Should the chatHandler be refactored to use this module? Currently chatHandler assembles context inline. This module could replace that logic, but that refactor is better done in Step 12 (Extension Activation) when wiring everything together.
