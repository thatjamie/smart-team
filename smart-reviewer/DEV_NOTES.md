# Dev Notes — Step 5: Parsers

## What was implemented
- `src/parsers/planParser.ts` — Parse PLAN.md into structured Plan/Step objects; find PLAN.md in workspace or monorepo subdirectories
- `src/parsers/progressParser.ts` — Parse PROGRESS.md: metadata, step table with emoji status, iteration counts, Last Action section
- `src/parsers/devNotesParser.ts` — Parse DEV_NOTES.md: extract sections (what implemented, files changed, decisions, questions, feedback addressed, disputes)
- `src/parsers/reviewFeedbackParser.ts` — Parse REVIEW_FEEDBACK.md: extract step info, summary, approved/required/suggestions/questions, iteration, APPROVED/CHANGES_REQUIRED status
- `src/parsers/decisionsParser.ts` — Parse DECISIONS.md: extract decision entries with step, context, rationale, date
- `Decision` interface exported from decisionsParser.ts

## Files changed
- `src/parsers/planParser.ts` — New file (121 lines). Exports `parsePlan()` and `findPlanFile()`
- `src/parsers/progressParser.ts` — New file (169 lines). Exports `parseProgress()`
- `src/parsers/devNotesParser.ts` — New file (111 lines). Exports `parseDevNotes()` and `DevNotes` interface
- `src/parsers/reviewFeedbackParser.ts` — New file (186 lines). Exports `parseReviewFeedback()`
- `src/parsers/decisionsParser.ts` — New file (105 lines). Exports `parseDecisions()` and `Decision` interface

## Decisions made
- All parsers return `undefined` or empty array when files don't exist (graceful degradation)
- Parsers use regex-based markdown parsing rather than a markdown AST library — lighter weight, no extra dependencies
- `DevNotes` interface defined in `devNotesParser.ts` (not in `types.ts`) since it's only used by the parser and its consumers
- `Decision` interface defined in `decisionsParser.ts` for the same reason
- `parsePlan` accepts optional `progressOverrides` Map to merge PROGRESS.md statuses into steps
- Step index from REVIEW_FEEDBACK.md heading is converted to zero-based
- `parseStatusEmoji` handles ✅/🔄/⏳ emojis to StepStatus enum mapping
- JSDoc comments avoid backticks and `*/` sequences to prevent TS compilation errors

## Questions for reviewer
- Should parsers validate the parsed data more strictly (e.g., throw on malformed PROGRESS.md)? Currently they gracefully return partial results.
- `extractStatus` defaults to `CHANGES_REQUIRED` if neither APPROVED nor CHANGES_REQUIRED is found — is this the right default?
