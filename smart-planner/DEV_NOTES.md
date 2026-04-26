# Dev Notes — Step 2: System Prompts

## What was implemented
- Interview + exploration prompt builder (`src/prompts/interviewPrompt.ts`) — encodes codebase exploration guidance, interview technique (2-4 questions, prioritize by impact), 8 key areas to probe, requirements evolution handling, output format, and `[REQUIREMENTS_CLEAR]` signal
- Plan generation prompt builder (`src/prompts/planGenerationPrompt.ts`) — encodes exact PLAN.md template, 6 step design principles, 4 step patterns, testing reminders, 16-item quality checklist, and `[PLAN_START]`/`[PLAN_END]` output markers
- Plan update prompt builder (`src/prompts/planUpdatePrompt.ts`) — encodes update rules per step status (completed/in-progress/pending), 5-step update process, change presentation format, 9-item quality checklist for updated plans, and `[PLAN_START]`/`[PLAN_END]` + `[PROGRESS_START]`/`[PROGRESS_END]` output markers
- Verified `npm run compile` produces zero errors

## Files changed
- `src/prompts/interviewPrompt.ts` — `buildInterviewPrompt(context: PlannerContext)` function with codebase summary and interview history formatting
- `src/prompts/planGenerationPrompt.ts` — `buildPlanGenerationPrompt(context: PlannerContext)` function with full PLAN.md template and quality checklist
- `src/prompts/planUpdatePrompt.ts` — `buildPlanUpdatePrompt(context: PlannerContext)` function with status-aware update rules

## Decisions made
- Used `import type` for `PlannerContext` and `CodebaseSummary` parameters to keep prompts runtime-light
- Did NOT include few-shot example plans in the prompts — the template is detailed enough, and adding examples would bloat token usage significantly
- Interview history in the interview prompt is grouped by round for clearer context flow
- Plan update prompt includes PROGRESS.md output markers since updates may renumber steps

## Questions for reviewer
- None — the plan spec was very detailed and left little ambiguity
