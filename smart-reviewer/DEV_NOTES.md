# Dev Notes — Step 10: Chat Handler

## What was implemented
- `src/chatHandler.ts` — The core review logic (399 lines):
  - `handleChatRequest()` — Routes /review and /status sub-commands
  - `/status` — Shows plan info, step status table, worktree, review feedback
  - `/review [step]` — Full AI review workflow:
    1. Parse step number (defaults to current in-progress step)
    2. Find dev worktree
    3. Gather context (DEV_NOTES, DECISIONS, PROGRESS)
    4. Get diff via diffViewer
    5. Build system prompt with all context
    6. Stream AI response in chat
    7. Parse AI output into structured ReviewFeedback
    8. Ask user for approval (Write & Save / Discard)
    9. Write REVIEW_FEEDBACK.md and update PROGRESS.md
  - Enforced rules: max 5 iterations, never mark Complete without user approval, only writes REVIEW_FEEDBACK.md and PROGRESS.md

## Files changed
- `src/chatHandler.ts` — New file (399 lines). Exports `handleChatRequest()`

## Decisions made
- `secretStorage` passed as parameter from extension.ts (not via request.context — not available on ChatRequest)
- Step number is 1-based in user input, converted to 0-based internally
- Default review target: current in-progress step (user can override with `/review 5`)
- AI response parsed into ReviewFeedback using regex section extraction (similar to parsers)
- User approval via `vscode.window.showInformationMessage` (modal: false)
- On APPROVED + user saves: marks step Complete in PROGRESS.md
- On CHANGES_REQUIRED + user saves: keeps step In Progress, increments iteration
- Progress timestamp formatted as YYYY-MM-DD HH:MM using manual string concat (no backticks)
- `planFull` in prompt context uses step titles only (not full content) to keep prompt size manageable
- Iteration count comes from PROGRESS.md + 1 (existing iteration + this review)

## Questions for reviewer
- Should the user approval be modal (blocking) instead of non-modal? Currently it's a non-modal info message that could be dismissed.
- The AI response parser (`parseAiResponse`) uses the same regex approach as the file parsers. Should we unify these into a shared utility?
- When iteration > 5, the handler warns but doesn't prevent the review. Should it block entirely?
