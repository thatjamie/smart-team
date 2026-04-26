# Dev Notes — Step 5: Chat Handler

## What was implemented
- Chat handler class (`src/chatHandler.ts`) — full multi-turn conversational handler for `/plan`, `/update`, and `/status` commands (616 lines)
- `/plan [path]` flow: resolve project root → explore codebase → interview → draft → review → finalize → write PLAN.md + PROGRESS.md
- `/update` flow: find existing PLAN.md → read plan + progress → AI redrafts → write updated plan
- `/status` flow: load state → show phase, project root, interview progress
- Session resume support: loads `.planner-state.json` and continues from saved phase
- Lazy AI provider creation via `ProviderFactory.create(secrets, 'smart-planner')`
- Verified `npm run compile` produces zero errors

## Files changed
- `src/chatHandler.ts` — `ChatHandler` class with:
  - `handleRequest`: dispatches to `/plan`, `/update`, `/status` handlers
  - `handlePlan`: full `/plan` flow with codebase exploration, multi-turn interview, drafting, reviewing, and finalization
  - `handleUpdate`: reads existing PLAN.md/PROGRESS.md, uses plan update prompt, writes updated plan
  - `handleStatus`: displays current session state
  - `routeByPhase`: phase-based routing for multi-turn state machine
  - `phaseInterviewing`: AI asks 2-4 questions, detects `[REQUIREMENTS_CLEAR]` signal, max 8 rounds
  - `phaseDrafting`: generates full PLAN.md, extracts via `parsePlanFromAiOutput`
  - `phaseReviewing`: iterative revision based on user feedback, approval detection
  - `phaseFinalized`: writes PLAN.md + PROGRESS.md, clears state
  - Helper functions: `resolveProjectRoot`, `isApproval`, `stateToContext`, formatting utilities

## Decisions made
- Max interview rounds: 8 — enough for complex projects, prevents infinite loops
- Approval detection uses keyword matching (11 keywords) — simple and effective for chat UI
- SecretStorage access via extension exports — will be properly injected in Step 6 activation wiring
- `/update` is single-turn (not multi-turn) — simpler UX, user provides all changes in one message
- `/plan` with no argument + no workspace shows error message — forces explicit project root

## Review feedback addressed (iteration 2)
- **Issue 1**: Replaced all inline `require('fs')` and `require('path')` with proper ES module `import * as fs from 'fs'` and `import * as path from 'path'` at the top of the file — consistent with the rest of the codebase (`codebaseExplorer.ts`, `stateManager.ts`, `planWriter.ts`)
- **Issue 2**: `parseProgress` is now actually used in the `/update` handler — it parses PROGRESS.md into structured step statuses and formats them as a summary (e.g., "Step 1: ✅ Complete") for the AI prompt, ensuring status-aware updates per acceptance criteria item 13
- **Suggestion (optional)**: Replaced `'Previous question'` placeholder with actual question extraction from AI responses. Added `pendingQuestions` field to `PlannerState` and `extractQuestions()` helper function. Questions are extracted via regex patterns (numbered `1. **Question?**`, bold `**Question?**`, lines ending with `?`) and stored in state. On the next user turn, answers are paired with the stored questions. This makes `.planner-state.json` data meaningful for the sidebar (Step 6) and improves interview history quality.

## Review feedback addressed (iteration 3)
- **Issue 1**: Added backwards compatibility default for `pendingQuestions` in `loadState()` — older `.planner-state.json` files without this field would crash with `TypeError: Cannot read properties of undefined`. Now defaults to `[]` when the field is missing or not an array.
