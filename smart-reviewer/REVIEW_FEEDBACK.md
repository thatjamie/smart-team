# Review Feedback — Step 10: Chat Handler

## Summary
The chat handler implements the full AI review workflow with streaming, context gathering, AI response parsing, and file writing. The overall structure is solid and integrates all previously built modules. However, there are **2 blocking issues** and **1 notable bug** that must be fixed before this step can be approved. The most critical is a violation of the review-agent's core rule: marking a step ✅ Complete without a proper two-phase user approval gate.

## ✅ Approved Items
- **Full review workflow implemented**: `/review [step]` and `/status` sub-commands ✅
- **Context gathering**: Reads PLAN.md, PROGRESS.md, DEV_NOTES.md, DECISIONS.md ✅
- **Diff retrieval via diffViewer**: Iteration-aware (full vs latest) ✅
- **System prompt assembly**: Uses `buildReviewSystemPrompt()` with all context fields ✅
- **AI streaming**: Streams AI response in chat via `provider.stream()` with cancellation support ✅
- **AI response parsing**: `parseAiResponse()` extracts Summary, Approved Items, Changes Required, Suggestions, Questions, Iteration, Status ✅
- **File writing**: Writes REVIEW_FEEDBACK.md and updates PROGRESS.md ✅
- **Iteration enforcement**: Blocks at iteration > 5 ✅
- **Step defaulting**: Defaults to current in-progress step if not specified ✅
- **Error handling**: Catches AI errors, missing plan, missing worktree, empty diff ✅
- **Status command**: Shows plan info, step table, worktree, review feedback ✅
- **`secretStorage` passed as parameter**: Correct approach per DECISIONS.md ✅
- **DECISIONS.md**: 4 decisions logged ✅
- **DEV_NOTES.md**: Complete ✅

## ❌ Changes Required

- [ ] **BLOCKING — Auto-marks step ✅ Complete without proper user approval gate** (`chatHandler.ts:262`):

  ```typescript
  status: feedback.status === 'APPROVED' && iteration >= 1 ? StepStatus.Complete : step.status,
  ```

  This marks the step as `Complete` when the user clicks "Write & Save" — but per the plan and the review-agent skill's core rules, **"Write & Save" ≠ "Approve review"**. The review-agent workflow requires a two-phase approval:

  1. User clicks "Write & Save" → writes REVIEW_FEEDBACK.md, keeps PROGRESS.md as 🔄 In Progress
  2. User **explicitly approves** the APPROVED review → only then marks ✅ Complete

  The current implementation conflates saving feedback with approving the review result into a single button. This violates the plan rule: *"Never mark ✅ Complete without explicit user approval"* and the review-agent skill's Section 8/13 rule: *"Only mark a step as ✅ Complete after the user explicitly approves your APPROVED review."*

  **Fix**: Split into two approval phases:
  - "Write & Save" → writes REVIEW_FEEDBACK.md, updates PROGRESS.md to 🔄 In Progress with review details, shows summary asking "Do you approve this review?"
  - Only if the user then confirms approval of an APPROVED review → update PROGRESS.md to ✅ Complete

- [ ] **Bug — `parseAiResponse` defaults to APPROVED when status is unclear** (`chatHandler.ts:309`):

  ```typescript
  const status = text.includes('CHANGES_REQUIRED') ? 'CHANGES_REQUIRED' as const : 'APPROVED' as const;
  ```

  This is backwards. If the AI's response doesn't clearly state either status, defaulting to APPROVED is dangerous — it could auto-approve a review with unresolved issues. The safer default is CHANGES_REQUIRED. Additionally, a simple `text.includes('CHANGES_REQUIRED')` could false-positive if the AI mentions "CHANGES_REQUIRED" in a question or suggestion context.

  **Fix**: 
  1. Search for the status in the `## Iteration` section specifically (the AI is instructed to put status there), not in the entire text.
  2. Default to `CHANGES_REQUIRED` if no clear status is found:
  ```typescript
  const iterSection = text.match(/##\s*Iteration[\s\S]*?(?=\n##|$)/i);
  const statusText = iterSection ? iterSection[0] : '';
  const status = statusText.includes('CHANGES_REQUIRED') ? 'CHANGES_REQUIRED' as const
      : statusText.includes('APPROVED') ? 'APPROVED' as const
      : 'CHANGES_REQUIRED' as const; // safe default
  ```

- [ ] **`planFull` sends only step titles, not content** (`chatHandler.ts:194`):

  ```typescript
  planFull: plan.steps.map(s => '## ' + s.title).join('\n'),
  ```

  The plan's `ReviewContext` spec says `planFull` is "Full plan (for cross-step context)". Sending only titles gives the AI no content to check cross-step consistency against (e.g., "does this implementation align with what was decided in Step 2?").

  **Fix**: Include step content:
  ```typescript
  planFull: plan.steps.map(s => '## ' + s.title + '\n' + s.content).join('\n\n'),
  ```

## 💡 Suggestions (Optional)

- **File path**: The plan specifies `src/chat/reviewChatHandler.ts` but the implementation is at `src/chatHandler.ts`. This isn't blocking since there's no `src/chat/` directory convention established, but it deviates from the plan. Consider matching the plan's path in a future cleanup.

- **Test/lint execution**: The plan mentions "Optionally run tests and linters in the worktree" (step 6 in the flow). This isn't implemented, which is acceptable since the plan says "optionally." The `testResults` and `lintResults` fields in `ReviewPromptContext` default to "No results available" in the system prompt, so this works. Could be added in a future iteration.

- **Regarding the developer's question about modal approval**: Non-modal is correct for the "Write & Save" phase. However, the second phase (approving the review result) should ideally also be non-modal so the user can scroll up and re-read the AI's analysis. The current approach is fine.

- **Regarding unifying AI response parsing with file parsers**: Not necessary. The AI response has different formatting characteristics than the markdown files (it may include extra markdown, think-aloud text, etc.). A separate parser is appropriate.

- **Regarding iteration > 5**: The current behavior (block entirely) is correct and matches the review-agent skill. "Escalate to the user" is what the `return` with the warning message does.

## ❓ Questions
None.

## Verification Results
| Check | Result |
|-------|--------|
| `npx tsc` (compile) | ✅ Clean — 0 errors |
| `npx vsce package` | ✅ `smart-reviewer-0.1.0.vsix` (42 files, 49.28KB) |

## Iteration
- Iteration: 1/5
- Status: CHANGES_REQUIRED
