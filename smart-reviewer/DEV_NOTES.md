# Dev Notes — Step 9: Diff Viewer

## What was implemented
- `src/diffViewer.ts` — Diff retrieval and display module (39 lines):
  - `getDiffForStep(worktreeDir, iteration)` — returns full diff for iteration 1, latest commit diff for iteration 2+
  - `openDiffEditor(diffContent, title?)` — opens diff in a new editor tab with syntax highlighting

## Files changed
- `src/diffViewer.ts` — New file (39 lines). Exports `getDiffForStep()` and `openDiffEditor()`

## Decisions made
- `getDiffForStep` delegates to existing `getDiff()` and `getLatestDiff()` from git.ts — no duplicated git logic
- Iteration threshold is `<= 1` for full diff, `> 1` for latest commit only — matches review-agent convention
- `openDiffEditor` uses `vscode.workspace.openTextDocument` with `language: 'diff'` for syntax highlighting
- Opens in `ViewColumn.Beside` so user can see diff alongside the chat or other editors
- `preview: false` keeps the tab persistent (not replaced when next diff opens)
- Title parameter is unused (VSCode untitled docs don't support custom titles) but kept for API clarity

## Questions for reviewer
- The `title` parameter in `openDiffEditor` isn't actually used for the tab name (untitled docs can't be named). Should we remove it, or keep it for potential future use with virtual documents?
