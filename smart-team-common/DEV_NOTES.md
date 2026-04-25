# Dev Notes — Step 6: Diff Viewer

## What was implemented
- `diffViewer.ts` — `getDiffForStep` and `openDiffEditor`
- Updated `src/index.ts` barrel to export both functions

## Files changed
- `smart-team-common/src/diffViewer.ts` — Diff viewer utilities (50 lines)
- `smart-team-common/src/index.ts` — Added diff viewer exports

## Decisions made
- **No dev-agent decisions** — Plan specified none, implementation follows spec exactly
- **`openDiffEditor` uses `vscode.workspace.openTextDocument`** — creates untitled document with `language: 'diff'` for syntax highlighting; not testable outside VSCode host but compiles cleanly
- **`getDiffForStep` delegates to `getDiff`/`getLatestDiff`** — thin logic layer, fully testable via gitRead functions

## Questions for reviewer
- None
