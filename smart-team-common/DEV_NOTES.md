# Dev Notes — Step 3: Parsers

## What was implemented
- `planParser.ts` — `parsePlan()` parses `##` headings as steps, `findPlanFile()` does BFS search
- `progressParser.ts` — `parseProgress()` parses emoji status, iteration N/5, commit hashes, metadata, Last Action
- `devNotesParser.ts` — `parseDevNotes()` extracts all sections (whatWasImplemented, filesChanged, decisions, questions, feedbackAddressed, feedbackDisputed)
- `reviewFeedbackParser.ts` — `parseReviewFeedback()` parses summary, approvedItems, changesRequired with checkboxes, suggestions, questions, iteration, APPROVED/CHANGES_REQUIRED
- `decisionsParser.ts` — `parseDecisions()` extracts entries grouped by step headings with decision/context/rationale/date
- Updated `src/index.ts` barrel to export all 6 parser functions

## Files changed
- `smart-team-common/src/parsers/planParser.ts` — Plan parser (159 lines)
- `smart-team-common/src/parsers/progressParser.ts` — Progress parser (139 lines)
- `smart-team-common/src/parsers/devNotesParser.ts` — Dev notes parser (90 lines)
- `smart-team-common/src/parsers/reviewFeedbackParser.ts` — Review feedback parser (159 lines)
- `smart-team-common/src/parsers/decisionsParser.ts` — Decisions parser (108 lines)
- `smart-team-common/src/index.ts` — Added parser exports

## Decisions made
- **`parsePlan` returns empty steps on error** instead of throwing — consumers can check `steps.length === 0`
- **`findPlanFile` uses BFS** — searches breadth-first, checking for PLAN.md at each level before going deeper
- **StepStatus enum imported as value** — Since `StepStatus` is a TypeScript enum, it must be imported as a value (not `import type`) to use as a runtime value in STATUS_MAP
- **Only `##` headings are steps** — `###` and deeper headings are treated as sub-sections within a step, not as separate steps
- **`parsePlan` accepts optional `progressOverrides`** — merges status/iteration/commit from PROGRESS.md into Plan steps

## Questions for reviewer
- None
