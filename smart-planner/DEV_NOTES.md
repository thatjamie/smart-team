# Dev Notes — Step 6: Sidebar and Extension Activation

## What was implemented
- Sidebar tree data provider (`src/providers/plannerTreeProvider.ts`) — displays planning session state with session info, interview history, and plan outline
- Full extension activation wiring (`src/extension.ts`) — registers chat participant, commands, tree view, and file watchers
- Verified `npm run compile` produces zero errors

## Files changed
- `src/providers/plannerTreeProvider.ts` — `PlannerTreeProvider` class (292 lines):
  - Root items: session info (expanded), interview history (collapsed), plan outline (collapsed)
  - Session details: project root, greenfield/brownfield, question count, pending questions, last activity
  - Interview history: grouped by round, each round expands to Q&A pairs
  - Plan outline: extracts step titles from draft plan with phase-appropriate icons
  - Empty state: "No active planning session" + "Use /plan to start planning"
  - `setProjectRoot()` and `refresh()` for external updates
- `src/extension.ts` — Full activation wiring (130 lines):
  - Resolves project root (setting → workspace root)
  - Creates `ChatHandler` and registers chat participant
  - Creates `PlannerTreeProvider`, registers `TreeView`
  - Registers 5 commands: startPlanning, updatePlan, openProjectRoot (folder picker), refresh, settings
  - File watcher for `.planner-state.json` → auto-refresh tree
  - Configuration change listener for `smart-planner.projectRoot`

## Decisions made
- Sidebar shows plan outline (step titles) rather than full plan content — keeps the sidebar scannable; full plan is visible in the chat
- File watcher uses `vscode.RelativePattern` scoped to project root — only watches the relevant `.planner-state.json`, not all files
- `openProjectRoot` command updates both the VSCode setting and the tree provider — ensures consistency
- Tree refreshes on `.planner-state.json` create/change/delete — covers all state transitions

## Questions for reviewer
- None
