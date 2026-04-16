# Review Feedback — Step 12: Extension Activation

## Summary
Complete extension activation wiring that integrates all previously built modules. Plan root detection, chat participant, TreeView, 8 commands, 5 file watchers, and workspace change detection are all properly registered and disposed. However, the chat handler duplicates context assembly logic that was purpose-built in Step 11's `contextBuilder`. This should be refactored to keep the codebase lean.

## ✅ Approved Items
- **`src/extension.ts`**: Rewritten from 60-line stub to 201 lines of full wiring ✅
- **Chat participant `@smart-reviewer`**: Registered with icon, passes `context.secrets` for API keys ✅
- **TreeView registration**: `ReviewTreeProvider` with `smart-reviewer-overview` ID, `showCollapseAll` ✅
- **Plan root detection**: `detectPlanRoot()` scans all workspace folders via `findPlanFile()` ✅
- **`planRoot` as closure variable**: Shared between chat handler, tree provider, and commands ✅
- **8 commands wired**: reviewStep, approveStep, requestChanges, viewDiff, viewDiffLatest, openWorktree, refresh, settings ✅
- **5 file watchers**: PLAN.md, PROGRESS.md, DEV_NOTES.md, REVIEW_FEEDBACK.md, DECISIONS.md ✅
- **Glob patterns**: `**/PLAN.md` catches files in subdirectories (monorepo support) ✅
- **`onDidCreate` re-detects plan root**: Handles new workspace folders mid-session ✅
- **Workspace folder change detection**: `onDidChangeWorkspaceFolders` triggers re-detection ✅
- **Error handling**: Warning messages for missing plan/worktree/diff in commands ✅
- **`deactivate()` stub**: Clean shutdown ✅
- **DECISIONS.md**: 3 decisions logged ✅
- **DEV_NOTES.md**: Complete and accurate ✅

## ❌ Changes Required

- [ ] **Refactor chatHandler to use `contextBuilder` module** (`src/chatHandler.ts`):

  The chat handler currently has ~60 lines of inline context assembly (plan parsing, progress reading, devNotes reading, decisions reading, diff retrieval) that duplicates the logic in `src/contextBuilder.ts` — a module built specifically for this purpose in Step 11. This violates DRY and defeats the purpose of the context builder module.

  **Fix**: Replace the inline context assembly in `handleChatRequest` (approximately lines 120-200 in the current chatHandler) with a call to `buildReviewContext()` or `buildCurrentStepContext()` from `src/contextBuilder.ts`. The chatHandler should focus on:
  1. Routing `/review` vs `/status`
  2. Calling `buildReviewContext()` to get assembled context
  3. Building the system prompt via `buildReviewSystemPrompt()`
  4. Calling the AI provider
  5. Parsing the response and handling user approval

  This should reduce chatHandler by ~50-60 lines and keep context assembly logic in one place.

## 💡 Suggestions (Optional)
- None beyond the required change above.

## ❓ Questions
None.

## Verification Results
| Check | Result |
|-------|--------|
| `npx tsc` (compile) | ✅ Clean — 0 errors |
| `npx vsce package` | ✅ `smart-reviewer-0.1.0.vsix` (44 files, 53.3KB) |

## Iteration
- Iteration: 1/5
- Status: CHANGES_REQUIRED
