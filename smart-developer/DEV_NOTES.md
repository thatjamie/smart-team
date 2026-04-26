# Dev Notes — Step 2: System Prompt

## What was implemented
- `buildDevSystemPrompt(context: DevContext): string` — builds the complete system prompt
- Four prompt sections: Role, Core Rules, Output Format, Dynamic Context
- XML output format contract exactly matching PLAN.md spec
- Dynamic context injection for plan content, progress, decisions, review feedback, file tree, and existing files

## Files changed
- `src/prompts/devSystemPrompt.ts` — New file with system prompt builder function

## Decisions made
- System prompt uses markdown headings (#, ##) for AI readability rather than flat text
- Core rules include 9 explicit rules covering step boundaries, conventions, output format, error handling, JSDoc, and secrets
- Dynamic context sections are conditionally included — only non-empty sections appear
- Existing files are wrapped in markdown code fences within the prompt for clear delimiting

## Questions for reviewer
- None

## Verification
- `npm run compile` produces zero errors
- Function signature matches PLAN.md: `buildDevSystemPrompt(context: DevContext): string`
