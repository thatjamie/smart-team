# Review Feedback — Step 5: Chat Handler

## Summary

Iteration 1 feedback was addressed: `require()` calls replaced with ES imports, `parseProgress` is now used in `/update` handler, and question tracking was implemented (bonus). However, a new bug was introduced: the `pendingQuestions` field added to `PlannerState` can be `undefined` when loading old state files, causing a crash on access.

## ✅ Approved Items

- **Iteration 1 fixes**:
  - ✅ Issue 1 fixed: All `require('fs')`/`require('path')` replaced with proper ES imports (`import * as fs from 'fs'`, `import * as path from 'path'`)
  - ✅ Issue 2 fixed: `parseProgress` now used in `/update` handler — parses PROGRESS.md into structured step statuses and formats them as a summary (e.g., "Step 1: ✅ Complete") for the AI prompt
  - ✅ Suggestion implemented: Question tracking via `extractQuestions()` helper and `pendingQuestions` field in `PlannerState`

- **Bonus improvements beyond requirements**:
  - ✅ `extractQuestions()` function with 4 extraction strategies (numbered bold, numbered plain, bold, fallback lines ending with `?`)
  - ✅ `pendingQuestions` stored in state → paired with user answers on next turn
  - ✅ Fallback to `'User input'` when no pending questions exist

- **All iteration 1 architecture items remain correct** ✅
- **Compile**: `npm run compile` produces zero errors ✅

## ❌ Changes Required

- [ ] **Issue 1: `pendingQuestions` can be `undefined` when loading old state files — crash on access**
  - **Location**: `src/chatHandler.ts` line 177
  - **Current**: `if (userMessage && state.pendingQuestions.length > 0) {`
  - **Problem**: The new `pendingQuestions` field was added to `PlannerState` and `createInitialState()`, but `loadState()` in `stateManager.ts` does NOT validate or default this field. If a user has an existing `.planner-state.json` from before this change (e.g., mid-interview, closed VSCode, reopened after update), `state.pendingQuestions` will be `undefined`, and `.length` will throw `TypeError: Cannot read properties of undefined (reading 'length')`.
  - **Fix**: Add a default in `loadState()` after the shape validation (around line 45):
    ```typescript
    // Ensure pendingQuestions exists (backwards compatibility)
    if (!Array.isArray(parsed.pendingQuestions)) {
        parsed.pendingQuestions = [];
    }
    ```
    This is the same pattern used for optional fields in deserialization — ensure the field exists before returning.

## 💡 Suggestions (Optional)

None — beyond the required fix, the implementation looks solid.

## ❓ Questions

None.

## Iteration
- Iteration: 2/5
- Status: CHANGES_REQUIRED
