# Dev Notes — Step 4: Sidebar TreeView

## What was implemented
- `StepTreeProvider` class implementing `vscode.TreeDataProvider` for the sidebar
- Hierarchical tree with 5 root sections: Plan Info, Worktree, Current Step, Dev Files, All Steps
- Dev Files section: DEV_NOTES.md (summary), DECISIONS.md (count), REVIEW_FEEDBACK.md (status)
- All Steps section: each step with status icon (⏳/🔄/✅) and commit hash
- Clickable items: plan/step items open PLAN.md, dev file items open the respective file
- "No plan found" message when PLAN.md is not in workspace
- `refresh()` method for tree refresh triggered by file watchers

## Files changed
- `src/providers/stepTreeProvider.ts` — New file with complete sidebar tree provider

## Decisions made
- Tree uses two-level hierarchy: root items + expandable headers (Dev Files, All Steps)
- All items use emoji icons matching the PROGRESS.md convention (📋📍📌📂📝📋🔍⏳🔄✅)
- File items only have click-to-open commands when the file actually exists
- `planRoot` is cached per refresh cycle to avoid redundant file searches
- Current step detection: prefers in-progress step, falls back to first pending step

## Questions for reviewer
- None — all requirements clearly specified in PLAN.md

## Verification
- `npm run compile` produces zero errors
- Uses all shared parsers from smart-team-common (parsePlan, parseProgress, parseDevNotes, parseDecisions, parseReviewFeedback)
- File watcher wiring deferred to Step 6 (extension activation)
