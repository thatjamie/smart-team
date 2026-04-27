# Review Feedback — Step 6: Extension Activation and Testing

## Summary
Comprehensive activation wiring that connects all components. Chat participant, TreeView, palette commands, file watchers, and SecretStorage are all registered correctly. However, there are two blocking issues: a missing command declaration in `package.json` and VSIX packaging failure due to the `file:../smart-team-common` dependency.

## ✅ Approved Items
- **File modified**: `src/extension.ts` expanded from 25-line stub to 205 lines — matches PLAN.md.
- **TreeView registration** (lines 24-29): Creates `StepTreeProvider` with workspace root, registers as `smart-developer-steps` with `showCollapseAll`. ✅
- **Chat participant** (lines 32-41): Creates participant with `handleChatRequest`, passes `context.secrets`. Icon set from `media/icon.svg`. Chat context parameter renamed to `chatContext` to avoid shadowing. ✅
- **Palette commands** (lines 44-154):
  - `startStep` — input box for step number, opens chat with `/implement` ✅
  - `commitStep` — opens chat with `/commit` ✅
  - `addressFeedback` — opens chat with `/feedback` ✅
  - `openWorktree` — finds worktree, opens in new window via `vscode.openFolder` ✅
  - `refresh` — calls `treeProvider.refresh()` ✅
  - `settings` — opens `smart-developer` settings page ✅
  - `setApiKey` — checks provider, prompts for key, stores via `context.secrets` ✅
- **File watchers** (lines 157-177): Watches all 5 shared state files (PLAN.md, PROGRESS.md, DEV_NOTES.md, DECISIONS.md, REVIEW_FEEDBACK.md) using `RelativePattern` with `**/` glob. All trigger `treeProvider.refresh()`. ✅
- **Workspace folder change handler** (lines 180-184): Refreshes tree on folder changes. ✅
- **`deactivate()`** (line 190-192): Cleanup via `context.subscriptions` disposal. ✅
- **`getProjectRoot` helper** (lines 198-204): Wraps common's `getProjectRoot` with try/catch. ✅
- **Compilation**: `npm run compile` passes with zero errors ✅
- **DECISIONS.md**: 3 well-documented decisions (deferred API key, chat pre-fill, RelativePattern). ✅
- **PROGRESS.md**: Properly committed at HEAD with correct iteration 1/5. ✅
- **Working tree**: Clean ✅

## ❌ Changes Required

- [ ] **`setApiKey` command not declared in `package.json`**: The command `smart-developer.setApiKey` is registered in `extension.ts:118` but has no corresponding entry in `package.json`'s `contributes.commands`. This means VSCode won't show it in the command palette. **Fix: Add the following to `package.json` in the `commands` array:**
  ```json
  {
    "command": "smart-developer.setApiKey",
    "title": "Smart Developer: Set API Key",
    "category": "Smart Developer"
  }
  ```

- [ ] **`npx vsce package` fails with path error**: Running `npx vsce package` produces:
  ```
  ERROR  invalid relative path: extension/../smart-team-common/node_modules/@anthropic-ai/sdk/_shims/auto/runtime-bun.d.ts
  ```
  This happens because `smart-team-common` is linked via `file:../smart-team-common`, and `vsce` tries to include the common package's `node_modules` which contains files outside the extension directory. **Fix: Add `node_modules/smart-team-common/**` to `.vscodeignore`** so `vsce` doesn't try to include the linked common package's nested `node_modules`. The compiled `out/` code already bundles what's needed at runtime. Alternatively, investigate whether `vsce` supports `file:` protocol dependencies or if the common package needs to be published to npm. At minimum, the VSIX must build successfully — **PLAN.md acceptance criteria says "`npx vsce package` produces `.vsix` under 5MB"**.

- [ ] **Dynamic `require()` calls instead of static imports** (`extension.ts:92` and `extension.ts:200`): The `openWorktree` command uses `const { findDevWorktree } = require('smart-team-common')` and `getProjectRoot` helper uses `const { getProjectRoot } = require('smart-team-common')` instead of static imports. While `findPlanFile` is statically imported at line 10, these two are dynamically required. This inconsistency could cause issues with bundling and tree-shaking. **Fix: Add `findDevWorktree` and `getProjectRoot` to the static import at line 10** and remove the `require()` calls.

## 💡 Suggestions (Optional)

- Consider adding a LICENSE file — `vsce` warns about missing LICENSE.
- The extension currently has 4193 files and 863 JS files in the VSIX (per the `vsce` warning). The `.vscodeignore` should exclude `node_modules/**` more aggressively and only include `out/**`. This is related to the packaging fix above.
- Consider using `esbuild` or `webpack` for bundling as recommended by `vsce` — this would also solve the `file:../smart-team-common` packaging issue.

## ❓ Questions

None.

## Iteration
- Iteration: 1/5
- Status: CHANGES_REQUIRED
