# Dev Notes — Step 8: Sidebar TreeView

## What was implemented
- `src/providers/reviewTreeProvider.ts` — Full sidebar TreeView provider (415 lines):
  - `ReviewTreeItem` class extending `vscode.TreeItem` with custom itemType and filePath/stepIndex
  - `ReviewTreeProvider` implementing `vscode.TreeDataProvider<ReviewTreeItem>`
  - Root items: Plan info, Worktree info, Current Step, Review Files, All Steps
  - File items are clickable (open in editor via vscode.open command)
  - Step items are clickable (open PLAN.md)
  - Uses `refresh()` and `setPlanRoot()` for manual updates
  - Integrates all parsers (plan, progress, devNotes, reviewFeedback, decisions) and git operations

## Files changed
- `src/providers/reviewTreeProvider.ts` — New file (415 lines). Exports `ReviewTreeItem` and `ReviewTreeProvider`

## Decisions made
- Tree structure has 5 root sections: Plan, Worktree, Current Step, Review Files, All Steps
- Icons use `vscode.ThemeIcon` with semantic colors (charts.green for complete, charts.blue for in-progress, errorForeground for issues)
- File items use `vscode.open` command to open files directly in editor
- Step items also use `vscode.open` to jump to PLAN.md
- REVIEW_FEEDBACK.md item gets `step-issues` icon type when CHANGES_REQUIRED (red error icon)
- `sync~spin` icon for in-progress steps provides visual animation
- `buildProgressOverrides()` helper maps Progress data into the format `parsePlan` expects
- Data is re-parsed on every `getChildren` call (no caching) for simplicity — tree is small and refreshes are user-triggered
- Graceful fallbacks: "No plan found" message when workspace lacks PLAN.md, "not found" for missing files

## Questions for reviewer
- Should the tree provider cache parsed data and only refresh on file watcher events? Currently it re-parses on every expand, which is simple but could be slow for very large plans.
- The `buildProgressOverrides` uses `indexOf` which is O(n) — fine for small step counts but could use a direct index if ProgressStepEntry included stepIndex.
