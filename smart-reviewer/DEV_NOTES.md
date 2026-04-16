# Dev Notes — Step 10: Chat Handler (Iteration 2)

## What was implemented
- `src/chatHandler.ts` — The core review logic (440 lines):
  - `handleChatRequest()` — Routes /review and /status sub-commands
  - `/status` — Shows plan info, step status table, worktree, review feedback
  - `/review [step]` — Full AI review workflow with two-phase approval:
    1. Parse step number (defaults to current in-progress step)
    2. Find dev worktree
    3. Gather context (DEV_NOTES, DECISIONS, PROGRESS, full plan content)
    4. Get diff via diffViewer
    5. Build system prompt with all context
    6. Stream AI response in chat
    7. Parse AI output into structured ReviewFeedback
    8. Phase 1: "Write & Save" — writes REVIEW_FEEDBACK.md, keeps PROGRESS.md as In Progress
    9. Phase 2: If APPROVED, asks "Mark Complete?" — only then updates PROGRESS.md to Complete
  - Enforced rules: max 5 iterations, two-phase approval, never auto-marks Complete

## Files changed
- `src/chatHandler.ts` — Updated (440 lines, was 399)

## Decisions made
- `secretStorage` passed as parameter from extension.ts (not via request.context)
- Step number is 1-based in user input, converted to 0-based internally
- Default review target: current in-progress step
- AI response parsed into ReviewFeedback using regex section extraction
- Two-phase user approval:
  - Phase 1 (Write & Save): writes REVIEW_FEEDBACK.md, PROGRESS.md stays In Progress
  - Phase 2 (Mark Complete): only for APPROVED reviews, user must explicitly confirm
- Status parsed from Iteration section specifically (not full text), defaults to CHANGES_REQUIRED
- `planFull` now includes full step content (not just titles) for cross-step consistency checking
- Progress timestamp formatted as YYYY-MM-DD HH:MM using string concat
- Iteration count comes from PROGRESS.md + 1

## Review feedback addressed (iteration 2)
1. **BLOCKING — Auto-marks Complete**: Fixed with two-phase approval. Phase 1 (Write & Save) writes files but keeps step In Progress. Phase 2 (Mark Complete) only appears for APPROVED reviews and requires explicit confirmation. Re-reads PROGRESS.md before updating to avoid stale state.
2. **Bug — parseAiResponse defaults to APPROVED**: Fixed. Now searches the `## Iteration` section specifically for status, and defaults to `CHANGES_REQUIRED` when no clear status found. Three-way check: CHANGES_REQUIRED > APPROVED > CHANGES_REQUIRED (safe default).
3. **planFull sends only titles**: Fixed. Now sends `'## ' + s.title + '\n' + s.content` for each step, giving the AI full plan content for cross-step consistency checks.

## Review feedback respectfully disputed
- None. All 3 issues verified as correct and addressed. Compilation confirmed passing (0 errors).
