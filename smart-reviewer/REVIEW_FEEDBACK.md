# Review Feedback — Step 3: System Prompts

## Summary
Clean, well-structured implementation that covers every plan requirement for the system prompt builder. The `ReviewPromptContext` interface matches the plan's context fields exactly. The prompt content faithfully mirrors the review-agent skill's conventions. Code compiles and packages cleanly. **No blocking issues.**

## ✅ Approved Items
- **File location**: `src/prompts/reviewSystemPrompt.ts` — matches plan exactly ✅
- **`ReviewPromptContext` interface**: All 8 fields present — `planStep`, `planFull?`, `progressState`, `devNotes`, `pastDecisions`, `diff`, `testResults?`, `lintResults?` — matches plan's ReviewContext structure (and forward-compatible with Step 11) ✅
- **Role definition**: "You are a review-agent reviewing code against PLAN.md" — clear and matches plan ✅
- **Core rules**: All key rules included — only review current step, never make code changes, be thorough but fair, max 5 iterations, independent verification, respect past decisions ✅
- **Review criteria**: 7 priority-ordered checks — plan requirements, DEV_NOTES claims, DECISIONS consistency, code quality, testing, edge cases, TypeScript compilation ✅
- **Output format**: Exact REVIEW_FEEDBACK.md structure specified — Summary, ✅ Approved Items, ❌ Changes Required, 💡 Suggestions, ❓ Questions, Iteration, Status (APPROVED | CHANGES_REQUIRED) ✅
- **Dynamic context injection**: All 7 context sources injected with XML-style delimiters (`<progress>`, `<dev-notes>`, `<diff>`, `<decisions>`, etc.) ✅
- **PLAN.md step section**: Included as primary context ✅
- **Full PLAN.md**: Optional via `planFull` — good decision for prompt size management ✅
- **Test/lint defaults**: "No results available" fallback when not provided ✅
- **Final instruction section**: Clear 5-step guidance for the AI's review process ✅
- **"Never mark ✅ Complete" rule**: Properly enforced in output format rules ✅
- **DECISIONS.md**: 4 decisions logged with context and rationale ✅
- **DEV_NOTES.md**: Complete documentation ✅

## ❌ Changes Required
None.

## 💡 Suggestions (Optional)
- Regarding the developer's question about token budget guidance in the prompt: I'd recommend **not** adding it. The `maxTokens` provider option already caps the response, and adding prompt-level guidance risks the AI truncating useful feedback to hit an arbitrary target. The current approach is correct.

- Regarding `planFull` always vs. optional: The current optional approach is the right call. Most reviews only need the current step. The Context Builder (Step 11) can decide when to include the full plan based on whether cross-step dependencies are detected.

## ❓ Questions
None.

## Verification Results
| Check | Result |
|-------|--------|
| `npm install` | ✅ 0 vulnerabilities |
| `npx tsc` (compile) | ✅ Clean — 0 errors |
| `npx vsce package` | ✅ `smart-reviewer-0.1.0.vsix` (18 files, 16.05KB) |

## Iteration
- Iteration: 1/5
- Status: APPROVED
