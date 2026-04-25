# Plan: Smart Reviewer VSCode Extension

## Overview

Build a VSCode extension that acts as an **AI review-agent** — reading code diffs from a dev worktree, reviewing them against `PLAN.md` requirements, and writing `REVIEW_FEEDBACK.md` (APPROVED or CHANGES_REQUIRED) with the human's approval. This extension depends on the **smart-team-common** shared package for types, parsers, writers, AI providers, and git operations.

## Context

### Existing System

**smart-team-common** (`../smart-team-common/`) provides all shared infrastructure:
- Types (`Step`, `Plan`, `Progress`, `ReviewFeedback`, `Decision`, `DevNotes`, etc.)
- AI providers (`CopilotProvider`, `AnthropicProvider`, `OpenAIProvider`, `ProviderFactory`)
- Parsers (`planParser`, `progressParser`, `devNotesParser`, `reviewFeedbackParser`, `decisionsParser`)
- Writers (`progressWriter`, `reviewFeedbackWriter`)
- Git operations (`gitRead` — reviewer uses only read-only ops)
- Diff viewer (`getDiffForStep`, `openDiffEditor`)

This extension adds:
- **Review-agent system prompt** — instructs AI to review code, defines REVIEW_FEEDBACK.md output format
- **Context builder** — gathers plan state, dev notes, decisions, diff for review
- **Chat handler** — `/review` and `/status` flows with AI response parsing
- **Sidebar tree view** — review-centric plan/worktree/step/file view
- **Extension activation** — wires everything together

### Tech Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: VSCode Extension Host (Node.js)
- **Build**: `tsc` → `out/`
- **Dependencies**: `smart-team-common` (local package), `@anthropic-ai/sdk`, `openai`
- **VSCode API**: Chat Participants API, Language Model API (requires VSCode ^1.90.0), TreeView, SecretStorage
- **Package**: `vsce package` → `.vsix`

### Conventions

Follow the same conventions as smart-team-common:
- **File organization**: `src/<module>/<file>.ts`
- **Naming**: camelCase for files/variables, PascalCase for classes/interfaces
- **JSDoc**: Every exported function and interface
- **Error handling**: try/catch with undefined returns
- **Read-only principle**: The reviewer NEVER modifies source code, NEVER commits, NEVER creates worktrees

### Build Order

1. `smart-team-common` must be built first
2. Then `smart-reviewer` (this plan)
3. Then `smart-developer` (depends on common, not on reviewer)

### References

- Common package plan: `../smart-team-common/PLAN.md`
- Smart Developer plan: `../smart-developer/PLAN.md`
- VSCode Chat API: https://code.visualstudio.com/api/extension-guides/chat

---

## Step 1: Extension Scaffold

**Goal:** Set up the VSCode extension project structure with manifest, build config, and dependency on smart-team-common.

### Requirements

- Create `package.json` with extension manifest
- Create `tsconfig.json` (target ES2022, module commonjs, strict)
- Create `.vscodeignore` for clean packaging
- Create `.gitignore` excluding `node_modules/`, `out/`, `*.vsix`
- Create entry point `src/extension.ts` with `activate()` and `deactivate()`
- Create `media/icon.svg` — eye/review icon
- Define reviewer-specific types in `src/types.ts`

### Implementation Notes

**Package.json** contributions:

Activity Bar & Views:
- Activity bar container: `smart-reviewer` with eye icon
- TreeView: `smart-reviewer-overview` — review context dashboard

Chat Participant:
- ID: `smart-reviewer`, name: `smart-reviewer`
- Description: "AI code review agent that reviews code against PLAN.md requirements"
- `isSticky: true`
- Commands: `/review [step]`, `/status`

Palette Commands:
- `smart-reviewer.reviewStep` → opens chat with `@smart-reviewer /review`
- `smart-reviewer.approveStep` → opens chat with `@smart-reviewer /review`
- `smart-reviewer.requestChanges` → shows info message directing to chat
- `smart-reviewer.viewDiff` → shows full diff in diff editor
- `smart-reviewer.viewDiffLatest` → shows latest diff in diff editor
- `smart-reviewer.openWorktree` → opens worktree folder
- `smart-reviewer.refresh` → refreshes sidebar
- `smart-reviewer.settings` → opens settings

Settings:
- `smart-reviewer.aiProvider` — enum: `copilot` | `anthropic` | `openai` (default: `copilot`)
- `smart-reviewer.planSearchMaxDepth` — number (default: 3, min: 0, max: 10)
- `smart-reviewer.anthropicBaseUrl` — string (default: `""`)
- `smart-reviewer.anthropicModel` — string (default: `claude-sonnet-4-20250514`)
- `smart-reviewer.openaiBaseUrl` — string (default: `""`)
- `smart-reviewer.openaiModel` — string (default: `gpt-4o`)

Dependencies:
- `"smart-team-common": "file:../smart-team-common"`
- `@anthropic-ai/sdk`: ^0.30.0, `openai`: ^4.52.0
- Dev: `@types/vscode` (^1.90.0), `@types/node` (^20.14.0), `typescript` (^5.5.0)

**Reviewer-specific types** in `src/types.ts`:

```typescript
// Re-export all common types for convenience
export { StepStatus, Step, Plan, Progress, ProgressStepEntry, ProgressLastAction,
         WorktreeInfo, ReviewFeedback, ChangesRequiredItem, Decision, DevNotes,
         AiMessage, AiResponse, AiChatOptions, AiProvider } from 'smart-team-common';

/** Context needed to build the review system prompt. */
export interface ReviewPromptContext {
    planStep: string;
    planFull?: string;
    progressState: string;
    devNotes: string;
    pastDecisions: string;
    diff: string;
}

/** Result of building review context. */
export interface ReviewContextResult {
    plan: import('smart-team-common').Plan;
    step: import('smart-team-common').Step;
    stepIndex: number;
    iteration: number;
    progress: import('smart-team-common').Progress | undefined;
    worktreePath: string;
    promptContext: ReviewPromptContext;
}
```

### Files to Create

- `package.json`, `tsconfig.json`, `.vscodeignore`, `.gitignore`
- `src/extension.ts` — activate/deactivate stubs
- `src/types.ts` — Re-exports from common + reviewer-specific types
- `media/icon.svg`

### Acceptance Criteria

- [ ] `npm install` completes (links `smart-team-common` from `../`)
- [ ] `npm run compile` produces no errors
- [ ] Extension activates in Extension Development Host
- [ ] `@smart-reviewer` chat participant appears with 2 commands
- [ ] All 8 palette commands appear in Command Palette
- [ ] All 6 settings appear in Settings UI
- [ ] `src/types.ts` re-exports all common types AND defines ReviewPromptContext, ReviewContextResult

### Dev-Agent Decisions

- Icon design (eye/review theme)
- Exact description text

---

## Step 2: System Prompt

**Goal:** Build the system prompt that instructs the AI to act as a review-agent, with the exact REVIEW_FEEDBACK.md output format.

### Requirements

- Define the REVIEW_FEEDBACK.md output format as an explicit template in the prompt
- Build the system prompt dynamically with review context
- Instruct the AI on its role, rules, review criteria, and output format

### Implementation Notes

**System prompt has five sections:**

1. **Role**: "You are a review-agent — an expert code reviewer reviewing code changes against a development plan."

2. **Core rules**: Only review current step, never make code changes, be thorough but fair, max 5 iterations, verify claims before flagging, respect past decisions.

3. **Review criteria** (priority order): plan requirements → DEV_NOTES claims → DECISIONS consistency → code quality → testing → edge cases.

4. **Output format** — the exact REVIEW_FEEDBACK.md template (as defined in smart-team-common's format contracts). The AI produces its review in this format ONLY.

5. **Dynamic context** — injected at build time: plan step, full plan, progress state, dev notes, decisions, git diff.

Build function: `buildReviewSystemPrompt(context: ReviewPromptContext): string`

### Files to Create

- `src/prompts/reviewSystemPrompt.ts` — System prompt builder

### Acceptance Criteria

- [ ] File compiles without errors
- [ ] `buildReviewSystemPrompt(context)` returns a complete system prompt string
- [ ] System prompt includes the exact REVIEW_FEEDBACK.md template
- [ ] System prompt includes the 6 review criteria
- [ ] System prompt includes the 6 core rules
- [ ] Dynamic context sections use XML tags for clear boundaries

### Dev-Agent Decisions

- Exact wording of role definition and rules

---

## Step 3: Context Builder

**Goal:** Assemble all the context needed for an AI review — plan state, dev notes, decisions, diff.

### Requirements

- Gather all shared state files for a given step
- Find the dev worktree and retrieve the appropriate diff
- Return a structured context result ready for the system prompt
- Provide a convenience function for the current in-progress step

### Implementation Notes

Uses shared modules from `smart-team-common`:
- `parsePlan`, `findPlanFile` — to parse PLAN.md
- `parseProgress` — to read PROGRESS.md
- `parseDevNotes`, `parseDecisions` — to read developer context
- `getProjectRoot`, `findDevWorktree` — to locate worktree
- `getDiffForStep` — to get the right diff based on iteration

Functions:
- `buildReviewContext(planRoot, stepIndex, iteration)` → `ReviewContextResult | undefined`
- `buildCurrentStepContext(planRoot)` → `ReviewContextResult | undefined`

Error handling: returns `undefined` if plan not found, worktree missing, or step index out of range.

### Files to Create

- `src/contextBuilder.ts` — Review context assembly

### Acceptance Criteria

- [ ] File compiles without errors
- [ ] `buildReviewContext` returns `undefined` when no plan found
- [ ] `buildReviewContext` returns `undefined` when no worktree found
- [ ] `buildReviewContext` returns `undefined` for invalid step index
- [ ] `buildCurrentStepContext` finds the in-progress step automatically
- [ ] Iteration is calculated correctly from PROGRESS.md
- [ ] Diff is retrieved using `getDiffForStep` with correct iteration logic

### Dev-Agent Decisions

- How to read text files (helper function vs. inline)

---

## Step 4: Sidebar TreeView — Review Context Dashboard

**Goal:** Build the sidebar tree view showing review context, worktree info, current step, review files, and all step statuses.

### Requirements

- Show plan name, branch, worktree info, current step
- Show review files (DEV_NOTES, DECISIONS, REVIEW_FEEDBACK) with summaries
- Show all steps with status icons (⏳/🔄/✅)
- File watchers trigger automatic tree refresh

### Implementation Notes

Layout:
```
📋 Plan: my-feature (feature/plan-my-feature)
  Branch: feature/plan-my-feature
  Created: 2025-01-15
📍 Worktree: ../my-project-dev
  Path: /full/path/to/worktree
📌 Current: Step 2: Build API (🔄 In Progress — iter 2/5)
  Last: review-agent — "Reviewed Step 2: CHANGES_REQUIRED"
📂 Review Files
  📝 DEV_NOTES.md — 5 files, 2 disputes
  📋 DECISIONS.md — 3 decisions
  🔍 REVIEW_FEEDBACK.md — ❌ CHANGES_REQUIRED, 3 issues
📂 All Steps
  ✅ Step 1: Setup Auth
  🔄 Step 2: Build API         abc1234
  ⏳ Step 3: Frontend
```

Uses shared parsers from `smart-team-common` to populate data.

### Files to Create

- `src/providers/reviewTreeProvider.ts` — Review-specific sidebar

### Acceptance Criteria

- [ ] Tree view appears in Smart Reviewer activity bar panel
- [ ] Plan info, worktree, current step, review files, and all steps display correctly
- [ ] REVIEW_FEEDBACK.md shows ❌ icon when CHANGES_REQUIRED
- [ ] File items are clickable and open in editor
- [ ] Step items open PLAN.md in editor
- [ ] Tree shows "No plan found" when no PLAN.md in workspace

### Dev-Agent Decisions

- Exact label formatting for tree items

---

## Step 5: Chat Handler

**Goal:** Implement the `/review` and `/status` chat commands.

### Requirements

- `/review [step]` — AI reviews a step: build context → stream to AI → parse response → user approves → write REVIEW_FEEDBACK.md → update PROGRESS.md
- `/status` — show current plan state, step statuses, worktree info
- Enforce: never modify source code, never auto-mark ✅ Complete, max 5 iterations

### Implementation Notes

All flows use shared modules from `smart-team-common`.

**`/review [step]` flow**:
1. Parse PLAN.md → get step content
2. Read PROGRESS.md → determine iteration
3. Call `buildReviewContext(planRoot, stepIndex, iteration)`
4. Check iteration ≤ 5
5. Stream to AI → display analysis in chat
6. Parse AI response into structured `ReviewFeedback` (extract sections: summary, approved items, changes required, suggestions, questions, iteration, status)
7. Show result to user → prompt "Write & Save" / "Discard"
8. On "Write & Save": write REVIEW_FEEDBACK.md (common writer), update PROGRESS.md (common writer)
9. If APPROVED: ask user "Mark step as Complete?" → update PROGRESS.md only on explicit approval
10. If CHANGES_REQUIRED: show message directing dev-agent to address feedback

**`/status` flow**:
1. Parse plan and progress (common parsers)
2. Show formatted status table in chat

**Error handling**:
- No PLAN.md → warning in chat
- No worktree → error with instructions
- Empty diff → "No diff found. Ensure dev worktree has commits."
- AI provider error → show error in chat

### Files to Create

- `src/chatHandler.ts` — Review and status command handlers + AI response parser

### Acceptance Criteria

- [ ] `/review 2` starts reviewing Step 2 with AI streaming
- [ ] `/review` with no arg reviews current in-progress step
- [ ] `/status` shows plan name, branch, worktree, step table, and review feedback
- [ ] AI response streams in real-time
- [ ] User must click "Write & Save" before REVIEW_FEEDBACK.md is written
- [ ] PROGRESS.md is updated with iteration and last action
- [ ] Step is NEVER auto-marked ✅ Complete — user must explicitly approve
- [ ] Iteration > 5 shows warning and stops
- [ ] CHANGES_REQUIRED reviews prompt dev-agent to address feedback
- [ ] Error cases show clear messages in chat

### Dev-Agent Decisions

- Exact wording of user prompts and error messages

---

## Step 6: Extension Activation and Testing

**Goal:** Wire everything together and verify end-to-end.

### Requirements

- Register chat participant, commands, tree view, file watchers
- End-to-end test with all three AI providers
- Package as `.vsix`

### Implementation Notes

**Activation wiring** (`src/extension.ts`):
1. `detectPlanRoot()` using `findPlanFile` from common
2. Create `ReviewTreeProvider`, register TreeView
3. Create chat participant with `chatHandler`
4. Register all 8 commands
5. Register file watchers for all 5 shared state files
6. Register `onDidChangeWorkspaceFolders` handler
7. Chat participant creation wrapped in try/catch (API may not be available in older VSCode)

**Manual test scenarios**:
1. Activation + `/status` → verify sidebar and chat work
2. `/review 1` with Copilot → AI streams, produces APPROVED/CHANGES_REQUIRED, REVIEW_FEEDBACK.md written
3. "View Diff" and "View Latest Diff" commands → diff opens with syntax highlighting
4. If APPROVED → "Mark Complete" prompt updates PROGRESS.md with ✅
5. Test Anthropic and OpenAI providers
6. Error cases: no PLAN.md, no worktree, empty diff, invalid step number
7. `npx vsce package` → `.vsix` produced

**Cross-extension verification**: Use Smart Developer to implement a step → Smart Reviewer to review → dev addresses feedback → reviewer re-reviews → both agree on PROGRESS.md state.

### Files to Modify

- `src/extension.ts` — Expand from stub to full activation

### Acceptance Criteria

- [ ] `npm run compile` produces zero errors
- [ ] Extension activates on startup with sidebar and chat participant
- [ ] All 8 palette commands and 2 chat commands work
- [ ] File watchers trigger sidebar refresh
- [ ] `/review` works end-to-end with Copilot provider
- [ ] `/review` works with Anthropic and OpenAI (after setting API keys)
- [ ] REVIEW_FEEDBACK.md is parseable by common's `reviewFeedbackParser`
- [ ] PROGRESS.md is parseable by common's `progressParser`
- [ ] Error cases show clear messages
- [ ] `npx vsce package` produces `.vsix` under 5MB
- [ ] Cross-extension cycle works without state disagreements
- [ ] Chat participant creation failure is handled gracefully (log warning, don't crash)

### Dev-Agent Decisions

- Whether to prompt for API key on activation or wait until first review
- Test PLAN.md content for manual testing
