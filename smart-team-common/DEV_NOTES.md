# Dev Notes — Step 4: Writers

## What was implemented
- `progressWriter.ts` — `writeProgress`, `updateProgressStep`, `updateLastAction`, `initProgress`
- `devNotesWriter.ts` — `writeDevNotes` with all sections including optional feedback sections
- `decisionsWriter.ts` — `appendDecision` (never overwrites, creates file if missing)
- `reviewFeedbackWriter.ts` — `writeReviewFeedback` with exact format matching parser
- Updated `src/index.ts` barrel to export all 7 writer functions

## Files changed
- `smart-team-common/src/writers/progressWriter.ts` — Progress writer (147 lines)
- `smart-team-common/src/writers/devNotesWriter.ts` — Dev notes writer (83 lines)
- `smart-team-common/src/writers/decisionsWriter.ts` — Decisions writer (96 lines)
- `smart-team-common/src/writers/reviewFeedbackWriter.ts` — Review feedback writer (74 lines)
- `smart-team-common/src/index.ts` — Added writer exports

## Decisions made
- **`updateProgressStep` and `updateLastAction` return new Progress objects** — they don't mutate the input, consistent with immutable update patterns
- **`appendDecision` creates file if missing** — writes header + first entry; otherwise appends under existing step heading or creates new step section
- **Writers use `fs.writeFileSync`** — synchronous, consistent with the parsers
- **Round-trip verified** for all 4 writer→parser pairs: Progress, DevNotes, ReviewFeedback, Decisions

## Questions for reviewer
- None
