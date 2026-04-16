# Dev Notes — Step 12: Extension Activation

## What was implemented
- `src/extension.ts` — Full extension activation wiring (201 lines, was 60 lines of stubs):
  - Plan root detection: scans workspace folders for PLAN.md using `findPlanFile`
  - TreeView registration: creates `ReviewTreeProvider` and `TreeView` with ID `smart-reviewer-overview`
  - Chat participant: registers `@smart-reviewer` with `handleChatRequest`, passes `context.secrets`
  - 8 commands wired to real implementations:
    - `reviewStep` → opens chat with `/review`
    - `approveStep` → opens chat with `/review`
    - `requestChanges` → info message directing to chat
    - `viewDiff` → finds worktree, gets full diff, opens in editor
    - `viewDiffLatest` → finds worktree, gets HEAD~1 diff, opens in editor
    - `openWorktree` → opens worktree folder in new window
    - `refresh` → re-detects plan root, refreshes tree
    - `settings` → opens VSCode settings for `smart-reviewer`
  - 5 file watchers: PLAN.md, PROGRESS.md, DEV_NOTES.md, REVIEW_FEEDBACK.md, DECISIONS.md
  - Workspace folder change detection: re-detects plan root on folder changes

## Files changed
- `src/extension.ts` — Rewritten (201 lines). Was 60 lines of stubs, now fully wired.

## Decisions made
- Plan root detected by scanning all workspace folders for PLAN.md — supports monorepo setups
- `planRoot` stored as closure variable, shared between chat handler and tree provider
- File watchers use glob patterns (`**/PLAN.md`, etc.) — catches files in subdirectories
- `onDidCreate` watcher re-detects plan root (new workspace folder added mid-session)
- Commands `reviewStep` and `approveStep` both open chat with `/review` — the chat handler's two-phase approval handles the distinction
- `openWorktree` opens in a new window (`true` flag) to avoid disrupting current workspace
- No backticks anywhere — consistent with project-wide rule
- `detectPlanRoot` defined as inner function to capture closure state

## Questions for reviewer
- The `chatHandler` still assembles context inline rather than using `contextBuilder`. Should it be refactored to use `buildReviewContext` from Step 11? This would reduce duplication but changes the chatHandler's internals.
