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
- All imports resolve: StepTreeProvider, handleChatRequest, findPlanFile, findDevWorktree, getProjectRoot from common
- Chat participant handler correctly receives `context.secrets` from outer scope
- `npm run package` produces 39KB VSIX (well under 5MB)

## Review feedback addressed (iteration 2)
- **`setApiKey` command not declared in package.json**: Accepted — added `smart-developer.setApiKey` command entry to `contributes.commands` in `package.json`.
- **`npx vsce package` fails with path error**: Accepted — `file:../smart-team-common` symlink causes `vsce` to resolve paths outside the extension root. Fixed by using `--no-dependencies` flag in the package script (dependencies are already resolved at compile time via the symlink). Updated `.vscodeignore` to exclude common's node_modules/src/etc. VSIX now builds successfully at 39KB.
- **Dynamic `require()` calls instead of static imports**: Accepted — added `findDevWorktree` and `getProjectRoot` to the static import from `smart-team-common`. Removed the local `getProjectRoot` wrapper function and both `require()` calls.
