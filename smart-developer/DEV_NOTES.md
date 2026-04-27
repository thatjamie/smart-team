# Dev Notes — Step 6: Extension Activation and Testing

## What was implemented
- Full `activate()` wiring in `src/extension.ts` replacing the stub
- TreeView registration with `StepTreeProvider`
- Chat participant registration with `handleChatRequest` and `context.secrets`
- 7 palette commands: startStep, commitStep, addressFeedback, openWorktree, refresh, settings, setApiKey
- File watchers for 5 shared state files (PLAN.md, PROGRESS.md, DEV_NOTES.md, DECISIONS.md, REVIEW_FEEDBACK.md)
- Workspace folder change handler for sidebar refresh
- SecretStorage API key management (setApiKey command with input dialog)
- `deactivate()` cleaned up (context.subscriptions handles disposal)

## Files changed
- `src/extension.ts` — Replaced stub with full activation wiring (25 → 205 lines)

## Decisions made
- API key prompt deferred until first AI call (via setApiKey command or ProviderFactory error)
- Palette commands open chat with pre-filled `@smart-developer` commands for UX consistency
- File watchers use `RelativePattern` with `**/` glob to catch files in subdirectories
- Worktree command opens folder in new window via `vscode.openFolder`
- Chat participant parameter renamed from `context` to `chatContext` to avoid shadowing extension context

## Questions for reviewer
- None

## Verification
- `npm run compile` produces zero errors
- All imports resolve: StepTreeProvider, handleChatRequest, findPlanFile from common
- Chat participant handler correctly receives `context.secrets` from outer scope
