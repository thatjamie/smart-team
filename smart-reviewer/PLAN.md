# Smart Reviewer — VSCode Extension Plan

An AI-powered VSCode extension that implements the **review-agent** workflow. The AI reads diffs and shared state files from the dev worktree, reviews code against the plan, and writes `REVIEW_FEEDBACK.md` with the human's approval. The sidebar shows review context; the AI does the actual reviewing.

## Context

This extension IS the review-agent. It:
- Reads `PLAN.md`, `PROGRESS.md`, `DEV_NOTES.md`, `DECISIONS.md` from the dev worktree
- Uses AI to review code diffs against plan requirements
- Writes `REVIEW_FEEDBACK.md` (APPROVED or CHANGES_REQUIRED)
- Updates `PROGRESS.md` with review status
- Works directly in the dev worktree (`../<project-name>-dev/`) — no separate review worktree
- All AI operations happen in a chat panel inside VSCode

The human user approves review results before they are finalized.

## Step 1: Extension Scaffold

Create a VSCode extension:
- `package.json` with manifest
- `tsconfig.json` for TypeScript compilation (target ES2022, module commonjs)
- `.vscodeignore` for clean packaging
- Entry point `src/extension.ts` with activate/deactivate
- `media/icon.svg` — eye/review icon

### Dependencies

- `@anthropic-ai/sdk` — Anthropic Claude provider
- `openai` — OpenAI provider
- Dev: `@types/vscode`, `typescript`

### package.json contributions

- **Activity Bar icon**: "Smart Reviewer" with an eye icon
- **Sidebar TreeView**: `smart-reviewer-overview` — review context dashboard
- **Chat Participant**: `@smart-reviewer` — VSCode chat participant for AI interaction
- **Commands**:
  - `smart-reviewer.reviewStep` — Pick a step → AI reviews it
  - `smart-reviewer.approveStep` — Finalize an APPROVED review → mark step complete
  - `smart-reviewer.requestChanges` — Finalize a CHANGES_REQUIRED review
  - `smart-reviewer.viewDiff` — Show full diff for current step
  - `smart-reviewer.viewDiffLatest` — Show diff for latest commit only
  - `smart-reviewer.openWorktree` — Add dev worktree to VSCode workspace
  - `smart-reviewer.refresh` — Refresh sidebar from disk
  - `smart-reviewer.settings` — Open extension settings

### Settings

- `smart-reviewer.aiProvider` — enum: `copilot` | `anthropic` | `openai` (default: `copilot`)
- `smart-reviewer.anthropicApiKey` — string (secret, use `vscode.SecretStorage`)
- `smart-reviewer.openaiApiKey` — string (secret, use `vscode.SecretStorage`)
- `smart-reviewer.anthropicModel` — string (default: `claude-sonnet-4-20250514`)
- `smart-reviewer.openaiModel` — string (default: `gpt-4o`)

## Step 2: AI Provider Abstraction

`src/ai/provider.ts`:

Same interface as smart-developer:

```typescript
interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AiResponse {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}

interface AiProvider {
  chat(messages: AiMessage[], options?: { maxTokens?: number }): Promise<AiResponse>;
  stream(messages: AiMessage[], onChunk: (text: string) => void, options?: { maxTokens?: number }): Promise<AiResponse>;
}
```

Three implementations:

### CopilotProvider (`src/ai/copilotProvider.ts`)
- `vscode.lm.selectChatModels()` → `vscode.LanguageModelChat`
- No API key needed

### AnthropicProvider (`src/ai/anthropicProvider.ts`)
- `@anthropic-ai/sdk`, streaming support
- API key from SecretStorage

### OpenAIProvider (`src/ai/openaiProvider.ts`)
- `openai` npm package, streaming support
- API key from SecretStorage

### ProviderFactory (`src/ai/providerFactory.ts`)
- Reads `smart-reviewer.aiProvider` setting
- Returns correct provider, validates API keys

## Step 3: System Prompts

`src/prompts/reviewSystemPrompt.ts`:

Build the system prompt for the AI review-agent:

- Role: You are a review-agent reviewing code against PLAN.md
- Rules: Only review the current step, never make code changes, be thorough but fair
- Review against: plan requirements, DEV_NOTES claims, DECISIONS consistency, code quality, tests, edge cases
- Output format: structured REVIEW_FEEDBACK.md with Summary, Approved Items, Changes Required, Suggestions, Questions, Iteration, Status (APPROVED | CHANGES_REQUIRED)

The system prompt is assembled dynamically with context:
- PLAN.md content (current step section)
- PROGRESS.md state
- DEV_NOTES.md content (what the developer claims to have done)
- DECISIONS.md content (past decisions to check consistency against)
- The git diff for the step
- Test results (if available)
- Lint results (if available)

## Step 4: Shared Types

`src/types.ts`:
- `StepStatus` enum: `pending | in-progress | complete`
- `Step` interface: index, title, level, content, status, iteration, lastCommit
- `Plan` interface: name, filePath, steps[]
- `Progress` interface: planName, branch, created, steps[], lastAction
- `ProgressStepEntry`: label, status, iteration, lastCommit
- `ProgressLastAction`: agent, action, timestamp
- `WorktreeInfo`: path, branch, exists
- `ReviewFeedback` interface: stepIndex, stepTitle, summary, approvedItems[], changesRequired[], suggestions[], questions[], iteration, status
- `ChangesRequiredItem`: description, howToFix, resolved

## Step 5: Parsers

`src/parsers/planParser.ts`:
- `parsePlan(planFilePath, progressOverrides?)` → `Plan`
- `findPlanFile(workspaceRoot)` — search PLAN.md locations

`src/parsers/progressParser.ts`:
- `parseProgress(filePath)` → `Progress | undefined`
- Parse table, metadata, Last Action

`src/parsers/devNotesParser.ts`:
- `parseDevNotes(filePath)` → full structured DevNotes or undefined
- Reviewer needs full detail: what was implemented, files changed, decisions, questions, disputes

`src/parsers/reviewFeedbackParser.ts`:
- `parseReviewFeedback(filePath)` → `ReviewFeedback | undefined`
- Parse APPROVED/CHANGES_REQUIRED status, issues list, iteration count

`src/parsers/decisionsParser.ts`:
- `parseDecisions(filePath)` → `Decision[]`

## Step 6: Git Operations

`src/git.ts`:
- `getProjectRoot(dir)` — `git rev-parse --show-toplevel`
- `getProjectName(projectRoot)` — `basename`
- `findDevWorktree(projectRoot)` → `WorktreeInfo`
- `getDiff(dir, base?)` → string — `git diff main...HEAD`
- `getLatestDiff(dir)` → string — `git diff HEAD~1 HEAD`
- `guessBaseBranch(dir)` — main or master

Reviewer does NOT: create worktrees, commit, or modify code.
Only reads diffs and worktree status.

## Step 7: Markdown File Writers

`src/writers/reviewFeedbackWriter.ts`:
- `writeReviewFeedback(filePath, feedback)` — write REVIEW_FEEDBACK.md
- Must match the exact format the dev-agent / Smart Developer expects:
  - Summary, ✅ Approved Items, ❌ Changes Required, 💡 Suggestions, ❓ Questions, Iteration, Status

`src/writers/progressWriter.ts`:
- `writeProgress(filePath, progress)` — update PROGRESS.md
- Reviewer only updates: lastAction, keeps step status as 🔄 In Progress
- Marks ✅ Complete ONLY after user approves an APPROVED review

## Step 8: Sidebar TreeView — Review Context Dashboard

`src/providers/reviewTreeProvider.ts`:

```
📋 Plan: my-feature (feature/plan-my-feature)
📍 Worktree: ../my-project-dev

📌 Current: Step 2: Build API
  Status: 🔄 In Progress — iter 2/5
  Last: review-agent — "Reviewed Step 2: CHANGES_REQUIRED"

📂 Review Files:
  📝 DEV_NOTES.md           — 5 files changed, 2 disputes
  📋 DECISIONS.md            — 3 steps with decisions
  🔍 REVIEW_FEEDBACK.md      — ❌ CHANGES_REQUIRED, 3 issues

📌 All Steps:
  ✅ Step 1: Setup Auth
  🔄 Step 2: Build API
  ⏳ Step 3: Frontend
```

- "Current" section highlights the in-progress step
- File items show summaries and are clickable → open in editor
- Step items clickable → open PLAN.md at heading
- File watchers auto-refresh the tree

## Step 9: Diff Viewer

`src/diffViewer.ts`:
- `getDiffForStep(worktreeDir, iteration)` — returns diff string
  - iteration <= 1: `git diff main...HEAD` (all changes)
  - iteration > 1: `git diff HEAD~1 HEAD` (latest commit only)
- `openDiffEditor(diffContent)` — opens diff in a new tab with `language: 'diff'`

## Step 10: Chat Handler — Core AI Review Workflow

`src/chat/reviewChatHandler.ts`:

Handles the `@smart-reviewer` chat participant. This is where the review-agent logic lives:

### Flow: "Review Step N"

1. Parse PLAN.md → get step N content and requirements
2. Read PROGRESS.md → understand iteration count, last commit
3. Read DEV_NOTES.md → what developer claims to have done
4. Read DECISIONS.md → past decisions for consistency checking
5. Get the diff (`git diff main...HEAD` or `git diff HEAD~1 HEAD`)
6. Optionally run tests and linters in the worktree
7. Build system prompt with all context + the diff
8. Send to AI with streaming → show analysis in chat
9. AI returns: structured REVIEW_FEEDBACK (APPROVED or CHANGES_REQUIRED)
10. Show summary in chat → ask user for approval
11. If user approves:
    - Write REVIEW_FEEDBACK.md to dev worktree
    - Update PROGRESS.md (keep 🔄 In Progress if CHANGES_REQUIRED, mark ✅ Complete if APPROVED)
12. If user requests changes: adjust feedback, re-ask

### Rules enforced in code (not just prompt):
- Never modify source code files — only write REVIEW_FEEDBACK.md and PROGRESS.md
- Never mark ✅ Complete without explicit user approval
- Max 5 iterations per step — warn and escalate after 5

## Step 11: Context Builder

`src/contextBuilder.ts`:

Assembles the full context for the AI review prompt:

```typescript
interface ReviewContext {
  planStep: string;            // Current step from PLAN.md
  planFull?: string;           // Full plan (for cross-step context)
  progressState: string;       // PROGRESS.md content
  devNotes: string;            // DEV_NOTES.md content
  pastDecisions: string;       // DECISIONS.md content
  diff: string;                // Git diff for this step
  testResults?: string;        // Test output (if run)
  lintResults?: string;        // Lint output (if run)
}
```

## Step 12: Extension Activation

`src/extension.ts`:

- Register chat participant `@smart-reviewer`
- Register all commands
- Register TreeView
- Register file watchers (PLAN.md, PROGRESS.md, DEV_NOTES.md, REVIEW_FEEDBACK.md, DECISIONS.md)
- Initialize SecretStorage for API keys
- On activation: find dev worktree from workspace, parse shared state, populate sidebar

## Step 13: Testing & Packaging

- Compile with `tsc`
- Package with `vsce package`
- Manual test: open a project where dev-agent has created a worktree with commits
- Use `@smart-reviewer` in chat to review
- Test all three AI providers (Copilot, Anthropic, OpenAI)
