# Dev Notes — Step 3: System Prompts

## What was implemented
- `ReviewPromptContext` interface — defines all context needed for the review prompt
- `buildReviewSystemPrompt(context)` function — assembles a complete system prompt dynamically with:
  - Role definition (review-agent identity and core rules)
  - Review criteria (7 priority-ordered checks)
  - Output format specification (exact REVIEW_FEEDBACK.md structure)
  - Dynamic context injection (PLAN.md step, PROGRESS.md, DEV_NOTES.md, DECISIONS.md, git diff, test/lint results)
  - Final instruction to guide the AI's review process

## Files changed
- `src/prompts/reviewSystemPrompt.ts` — New file. Exports `ReviewPromptContext` interface and `buildReviewSystemPrompt()` function (191 lines)

## Decisions made
- Used XML-style tags (`<plan-full>`, `<progress>`, `<dev-notes>`, etc.) to delimit dynamic context sections — helps the AI distinguish between prompt instructions and injected content
- `planFull` is optional — only included if the caller provides it, to avoid bloating the prompt when cross-step context isn't needed
- Test and lint results default to "No results available" messages when not provided, ensuring the AI always knows these categories exist
- Review criteria are numbered and prioritized — plan requirements come first, code quality later
- The prompt explicitly mirrors the review-agent skill's conventions (same REVIEW_FEEDBACK.md format, same iteration rules, same approval workflow)
- Output format includes instructions that the AI must never mark ✅ Complete — only the human user can finalize

## Questions for reviewer
- Should the system prompt include token budget guidance (e.g., "keep your response under 4000 tokens")? Currently the AI's response length is controlled by `maxTokens` in the provider options, but explicit guidance in the prompt might help.
- The `planFull` field is optional to keep prompt size manageable. Is it worth always including the full plan, or is the current step section sufficient for most reviews?
