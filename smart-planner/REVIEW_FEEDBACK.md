# Review Feedback — Step 5: Chat Handler

## Summary

Step 5 implements a comprehensive multi-turn chat handler (616 lines) covering all three commands (`/plan`, `/update`, `/status`) with proper phase-based state machine routing. The `/plan` flow is well-structured with exploring → interviewing → drafting → reviewing → finalized phases. However, there are two code quality issues that need to be addressed: inconsistent `require()` usage instead of ES module imports, and an unused `parseProgress` import.

## ✅ Approved Items

- **Overall architecture**: Clean `ChatHandler` class with lazy AI provider creation, phase-based routing, and proper error handling
- **`/plan` flow**: Full multi-turn state machine:
  - ✅ Project root resolution: chat argument → VSCode setting → workspace root (plan's priority order)
  - ✅ Greenfield detection via `hasSourceCode()` helper
  - ✅ Codebase exploration with `exploreCodebase()` and formatted overview display
  - ✅ Multi-turn interviewing with `[REQUIREMENTS_CLEAR]` signal detection
  - ✅ Max 8 interview rounds safety limit
  - ✅ Drafting phase with `parsePlanFromAiOutput` extraction
  - ✅ Reviewing phase with keyword-based approval detection (11 keywords)
  - ✅ Finalized phase: writes PLAN.md + seeds PROGRESS.md + clears state
  - ✅ Resume support: loads `.planner-state.json`, shows summary, continues from saved phase

- **`/update` flow**: Reads existing PLAN.md via `findPlanFile`, reads PROGRESS.md, builds update prompt
- **`/status` flow**: Shows phase, project root, intent, interview round, question count, draft status

- **AI Provider**: `ProviderFactory.create(secrets, 'smart-planner')` from common — correct usage ✅
- **Imports from previous steps**: Uses `exploreCodebase`, `loadState/saveState/clearState/createInitialState/updatePhase/addInterviewQA/setDraftPlan/setCodebaseSummary`, `writePlan/seedProgress/parsePlanFromAiOutput`, all three prompt builders ✅
- **Error handling**: Invalid path, no workspace, missing PLAN.md, corrupted state, AI extraction failure all show clear messages ✅
- **Compile**: `npm run compile` produces zero errors ✅
- **DECISIONS.md**: 3 decisions properly documented (max 8 rounds, single-turn `/update`, keyword approval) ✅

## ❌ Changes Required

- [ ] **Issue 1: Use ES module `import` for `fs` and `path` instead of inline `require()`**
  - **Location**: Lines 401, 404, 406, 517, 528, 529
  - **Current**: `require('fs').readFileSync(...)`, `require('path').join(...)`
  - **Problem**: The file uses ES module `import` syntax at the top for all other modules but switches to CommonJS `require()` for `fs` and `path`. This is inconsistent, harder to type-check, and may cause issues with bundling/packaging. The rest of the codebase (`codebaseExplorer.ts`, `stateManager.ts`, `planWriter.ts`) all use `import * as fs from 'fs'` and `import * as path from 'path'`.
  - **Fix**: Add `import * as fs from 'fs';` and `import * as path from 'path';` to the top imports, then replace all `require('fs')` with `fs` and `require('path')` with `path`.

- [ ] **Issue 2: `parseProgress` is imported but never used**
  - **Location**: Line 4
  - **Current**: `import { parseProgress } from 'smart-team-common';`
  - **Problem**: `parseProgress` is imported but never called. The `/update` handler reads PROGRESS.md as raw text via `fs.readFileSync` and passes it to the prompt. While this works (the prompt includes the raw text), the import should either be used or removed to avoid confusion.
  - **Fix**: Either (a) remove the unused import, or (b) use `parseProgress` to extract structured step statuses and include them in the prompt context for more reliable status-aware updates. Option (a) is simpler; option (b) would better satisfy acceptance criteria item 13 ("/update reads PROGRESS.md using common's `parseProgress` to respect step statuses").

## 💡 Suggestions (Optional)

- **Interview Q&A placeholder**: Line 178 uses `'Previous question'` as a placeholder for the question text. This is acceptable because the full conversation context is sent to the AI each turn via the prompt, but the stored Q&A data in `.planner-state.json` will have generic question entries. Consider tracking the actual AI-generated questions if the sidebar (Step 6) needs to display them meaningfully.

## ❓ Questions

None.

## Iteration
- Iteration: 1/5
- Status: CHANGES_REQUIRED
