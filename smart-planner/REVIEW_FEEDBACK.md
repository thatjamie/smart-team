# Review Feedback — Step 2: System Prompts

## Summary

Step 2 is well-implemented. All three prompt files are present, compile cleanly, and encode the plan-agent knowledge thoroughly. All 9 acceptance criteria from the plan are met. One minor cleanup item — an unnecessary re-export in `planUpdatePrompt.ts` that should be removed.

## ✅ Approved Items

- **`src/prompts/interviewPrompt.ts`**: Complete interview + exploration prompt:
  - ✅ Role definition: "senior architect and technical planner"
  - ✅ Codebase exploration guidance with 7 analysis dimensions (project structure, tech stack, frameworks, entry points, conventions, testing, build tools)
  - ✅ Interview technique: 2-4 focused questions, prioritize by impact, don't ask inferable things, one topic per question, provide context
  - ✅ 8 key areas to probe (scope, behavior, data model, integration, non-functional, patterns, migration, priority)
  - ✅ Requirements evolution handling (acknowledge → assess → integrate → flag)
  - ✅ Output format (summarize → ask → note assumptions)
  - ✅ `[REQUIREMENTS_CLEAR]` signal for phase transition
  - ✅ Phase-aware output (`exploring` vs `interviewing`)
  - ✅ Codebase summary formatting with all CodebaseSummary fields
  - ✅ Interview history grouped by round (matches DECISIONS.md)

- **`src/prompts/planGenerationPrompt.ts`**: Complete plan generation prompt:
  - ✅ Role definition: "generating a PLAN.md consumed by automated agents"
  - ✅ Exact PLAN.md template with all required sections (Overview, Context with subsections, Steps with Goal/Requirements/Notes/Files/Criteria/Decisions)
  - ✅ 6 step design principles (duration, coherent unit, requirements count, dependency ordering, clear boundaries, self-contained)
  - ✅ 4 step patterns (Foundation first, Vertical slice, Scaffold then fill, Interface first)
  - ✅ Testing reminders (auto-test guidance, user verification, test framework integration)
  - ✅ 16-item quality checklist (expanded from plan's 13 — more thorough, all items are valid)
  - ✅ `[PLAN_START]`/`[PLAN_END]` output markers
  - ✅ Codebase and interview data formatted for drafting context

- **`src/prompts/planUpdatePrompt.ts`**: Complete plan update prompt:
  - ✅ Update rules per step status: Completed (don't modify), In-Progress (discuss first), Pending (modify freely)
  - ✅ 5-step update process (analyze → categorize → plan → present → update PROGRESS.md)
  - ✅ Change presentation format with structured summary template
  - ✅ 9-item quality checklist for updated plans
  - ✅ `[PLAN_START]`/`[PLAN_END]` + `[PROGRESS_START]`/`[PROGRESS_END]` output markers
  - ✅ Existing plan and progress sections included when present

- **Compile**: `npm run compile` produces zero errors ✅

- **DECISIONS.md**: 3 decisions properly documented for Step 2:
  - ✅ No few-shot examples (token efficiency rationale)
  - ✅ Group interview history by round
  - ✅ Plan update prompt outputs both PLAN.md and PROGRESS.md

## ❌ Changes Required

- [ ] **Issue 1: Unnecessary `StepStatus` re-export in `planUpdatePrompt.ts`**
  - **Location**: `src/prompts/planUpdatePrompt.ts` line 140
  - **Current**: `export type { StepStatus };`
  - **Problem**: This re-export is unused — nothing imports `StepStatus` from `planUpdatePrompt.ts`. The `StepStatus` type is already properly re-exported from `src/types.ts` (from Step 1). Having it in a prompt file is misleading about the file's responsibility and could confuse future developers.
  - **Fix**: Remove `export type { StepStatus };` from line 140 and remove the `StepStatus` import from line 1 (change `import type { PlannerContext, StepStatus } from '../types';` to `import type { PlannerContext } from '../types';`)

## 💡 Suggestions (Optional)

None — the prompts are thorough and well-structured.

## ❓ Questions

None.

## Iteration
- Iteration: 1/5
- Status: CHANGES_REQUIRED
