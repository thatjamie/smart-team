# Plan: Smart Reviewer VSCode Extension

## Overview

Build a VSCode extension that acts as an **AI review-agent** — reading code diffs from a dev worktree, reviewing them against `PLAN.md` requirements, and writing `REVIEW_FEEDBACK.md` (APPROVED or CHANGES_REQUIRED) with the human's approval. The extension integrates with the Smart Developer extension via shared state files.

## Context

### Existing System

The **Smart Developer** extension (`../smart-developer/`) is the counterpart that implements code. Smart Reviewer reviews what Smart Developer produces.

**Shared state file contract** (both extensions read/write these):
- `PLAN.md` — the implementation plan (read by both)
- `PROGRESS.md` — step statuses, iteration counts, last action (written by both)
- `DEV_NOTES.md` — what the dev-agent implemented (written by dev, read by reviewer)
- `DECISIONS.md` — dev-agent's architectural decisions (written by dev, read by reviewer)
- `REVIEW_FEEDBACK.md` — reviewer's feedback (written by reviewer, read by dev)

**Shared worktree convention**: `../<project-name>-dev/` on a `feature/plan-<name>` branch.

The reviewer works directly in the dev worktree — it never creates its own worktree, never modifies source code, and never commits. It only writes `REVIEW_FEEDBACK.md` and updates `PROGRESS.md`.

The two extensions share ~60% of their codebase (types, parsers, writers, AI providers, git read operations). Where modules are identical, the plan marks them as **identical to smart-developer**. Where modules differ (system prompt, chat handler, review-specific writers), the plan specifies new code.

### Tech Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: VSCode Extension Host (Node.js)
- **Build**: `tsc` → `out/`
- **AI SDKs**: `@anthropic-ai/sdk` (^0.30.0), `openai` (^4.52.0)
- **VSCode API**: Chat Participants API, Language Model API (requires VSCode ^1.90.0), TreeView, SecretStorage
- **Package**: `vsce package` → `.vsix`

### Conventions

- **File organization**: `src/<module>/<file>.ts` — group by domain (ai, parsers, writers, providers, prompts)
- **Naming**: camelCase for files and variables, PascalCase for classes and interfaces
- **JSDoc**: Every exported function and interface has a JSDoc comment
- **Section comments**: Use `// ─── Section ───` dividers for readability
- **Imports**: Node builtins first, then VSCode, then local modules
- **Error handling**: try/catch with undefined returns (no thrown exceptions for expected failures)
- **Git operations**: `child_process.spawnSync` — no shell execution, direct git calls only
- **Read-only principle**: The reviewer NEVER modifies source code, NEVER commits, NEVER creates worktrees

### References

- Smart Developer source: `../smart-developer/src/` — counterpart extension
- VSCode Chat API: https://code.visualstudio.com/api/extension-guides/chat
- VSCode Language Model API: https://code.visualstudio.com/api/extension-guides/language-model

---

## Step 1: Extension Scaffold and Types

**Goal:** Set up the VSCode extension project structure with manifest, build config, and all shared types — the foundation everything else builds on.

### Requirements

- Create `package.json` with extension manifest
- Create `tsconfig.json` (target ES2022, module commonjs, strict, declaration + sourcemaps)
- Create `.vscodeignore` for clean packaging
- Create `.gitignore` excluding `node_modules/`, `out/`, `*.vsix`
- Create entry point `src/extension.ts` with `activate()` (logs activation) and `deactivate()`
- Create `media/icon.svg` — an eye/review icon
- Define all shared types in `src/types.ts`

### Implementation Notes

**Package.json** contributions:

Activity Bar & Views:
- Activity bar container: `smart-reviewer` with eye icon
- TreeView: `smart-reviewer-overview` — review context dashboard

Chat Participant:
- ID: `smart-reviewer`, name: `smart-reviewer`
- Description: "AI code review agent that reviews code against PLAN.md requirements"
- `isSticky: true`
- Commands:
  - `/review [step]` — Review a plan step against code changes
  - `/status` — Show current review status and progress

Palette Commands:
- `smart-reviewer.reviewStep` — Opens chat with `@smart-reviewer /review`
- `smart-reviewer.approveStep` — Opens chat with `@smart-reviewer /review`
- `smart-reviewer.requestChanges` — Shows info message directing to chat
- `smart-reviewer.viewDiff` — Shows full diff (base...HEAD) in diff editor
- `smart-reviewer.viewDiffLatest` — Shows latest diff (HEAD~1...HEAD) in diff editor
- `smart-reviewer.openWorktree` — Opens worktree folder in VSCode
- `smart-reviewer.refresh` — Refreshes sidebar from disk
- `smart-reviewer.settings` — Opens extension settings

Settings:
- `smart-reviewer.aiProvider` — enum: `copilot` | `anthropic` | `openai` (default: `copilot`, order: 1)
- `smart-reviewer.planSearchMaxDepth` — number, default: 3, min: 0, max: 10 (order: 2)
- `smart-reviewer.anthropicBaseUrl` — string, default: `""` (order: 3)
- `smart-reviewer.anthropicModel` — string, default: `claude-sonnet-4-20250514` (order: 4)
- `smart-reviewer.openaiBaseUrl` — string, default: `""` (order: 5)
- `smart-reviewer.openaiModel` — string, default: `gpt-4o` (order: 6)

Dependencies:
- `@anthropic-ai/sdk`: ^0.30.0
- `openai`: ^4.52.0
- Dev: `@types/vscode` (^1.90.0), `@types/node` (^20.14.0), `typescript` (^5.5.0)

Scripts:
- `vscode:prepublish`: `npm run compile`
- `compile`: `tsc -p ./`
- `watch`: `tsc -watch -p ./`
- `lint`: `eslint src --ext ts`

**Types** — Define all shared types in `src/types.ts`:

```typescript
/** Status of a plan step. Mirrors emoji status in PROGRESS.md. */
export enum StepStatus {
    Pending = 'pending',
    InProgress = 'in-progress',
    Complete = 'complete',
}

/** A single step parsed from PLAN.md. */
export interface Step {
    index: number;        // Zero-based index
    title: string;        // Heading text
    level: number;        // Heading level (2 for ##, 3 for ###)
    content: string;      // Full markdown content
    status: StepStatus;
    iteration: number;
    lastCommit: string;
}

/** A parsed PLAN.md. */
export interface Plan {
    name: string;
    filePath: string;
    steps: Step[];
}

/** A single step entry in PROGRESS.md. */
export interface ProgressStepEntry {
    label: string;
    status: StepStatus;
    iteration: number;
    lastCommit: string;
}

/** Last action recorded in PROGRESS.md. */
export interface ProgressLastAction {
    agent: string;
    action: string;
    timestamp: string;
}

/** Parsed PROGRESS.md. */
export interface Progress {
    planName: string;
    branch: string;
    created: string;
    steps: ProgressStepEntry[];
    lastAction: ProgressLastAction;
}

/** Dev worktree information. */
export interface WorktreeInfo {
    path: string;
    branch: string;
    exists: boolean;
}

/** A single blocking issue in a review. */
export interface ChangesRequiredItem {
    description: string;
    howToFix: string;
    resolved: boolean;
}

/** Parsed REVIEW_FEEDBACK.md. */
export interface ReviewFeedback {
    stepIndex: number;
    stepTitle: string;
    summary: string;
    approvedItems: string[];
    changesRequired: ChangesRequiredItem[];
    suggestions: string[];
    questions: string[];
    iteration: number;
    status: 'APPROVED' | 'CHANGES_REQUIRED';
}
```

### Files to Create

- `package.json` — Extension manifest
- `tsconfig.json` — TypeScript config
- `.vscodeignore` — Packaging exclusions
- `.gitignore` — Git exclusions
- `src/extension.ts` — Entry point with activate/deactivate stubs
- `src/types.ts` — All shared types
- `media/icon.svg` — Extension icon

### Acceptance Criteria

- [ ] `npm install` completes without errors
- [ ] `npm run compile` (tsc) produces no errors and outputs to `out/`
- [ ] Extension activates in VSCode Extension Development Host (check console log)
- [ ] `@smart-reviewer` chat participant appears in chat UI
- [ ] All 8 palette commands appear in Command Palette (search "Smart Reviewer")
- [ ] All 6 settings appear in Settings UI (search "smart-reviewer")
- [ ] `src/types.ts` exports all types listed above
- [ ] `engines.vscode` is `"^1.90.0"`

### Dev-Agent Decisions

- Icon design (eye/review theme)
- Exact description text for commands and settings

---

## Step 2: AI Provider Abstraction

**Goal:** Create the AI provider layer — a common interface with three implementations (Copilot, Anthropic, OpenAI) and a factory.

### Requirements

- Define `AiProvider`, `AiMessage`, `AiResponse`, `AiChatOptions` interfaces
- Implement `CopilotProvider` using VSCode Language Model API
- Implement `AnthropicProvider` using `@anthropic-ai/sdk` with streaming
- Implement `OpenAIProvider` using `openai` npm package with streaming
- Implement `ProviderFactory` that reads settings and returns the correct provider

### Implementation Notes

**Identical to smart-developer** — both extensions use the exact same AI provider layer. Copy from smart-developer's `src/ai/` and adjust config namespace from `smart-developer` to `smart-reviewer`.

Key implementation details:
- `AiProvider` interface: `chat()` and `stream()` methods
- `CopilotProvider`: maps `system` role to `User` since VSCode LM API has no system role
- `AnthropicProvider`: extracts system messages separately (Anthropic API requires it as a parameter)
- `OpenAIProvider`: captures usage from streaming chunks
- `ProviderFactory`: reads `smart-reviewer.aiProvider`, validates API keys from SecretStorage, supports `baseUrl` overrides

### Files to Create

- `src/ai/provider.ts` — Interfaces (identical to smart-developer)
- `src/ai/copilotProvider.ts` — Copilot (identical to smart-developer)
- `src/ai/anthropicProvider.ts` — Anthropic (adapt config namespace)
- `src/ai/openaiProvider.ts` — OpenAI (adapt config namespace)
- `src/ai/providerFactory.ts` — Factory (adapt config namespace)

### Acceptance Criteria

- [ ] All five files compile without errors
- [ ] `ProviderFactory.create(secretStorage)` returns the correct provider based on `smart-reviewer.aiProvider`
- [ ] Missing API key for Anthropic/OpenAI throws a clear error mentioning "Smart Reviewer"
- [ ] Copilot provider handles missing models gracefully
- [ ] `stream()` calls `onChunk` for each text fragment during streaming
- [ ] Both `chat()` and `stream()` return `AiResponse` with optional `usage`

### Dev-Agent Decisions

- Minor code style during copy

---

## Step 3: Parsers

**Goal:** Implement all markdown file parsers needed to read shared state files.

### Requirements

- Parse PLAN.md into `Plan` with `Step[]`
- Parse PROGRESS.md into `Progress`
- Parse DEV_NOTES.md into structured `DevNotes`
- Parse REVIEW_FEEDBACK.md into `ReviewFeedback`
- Parse DECISIONS.md into `Decision[]`

### Implementation Notes

**Identical to smart-developer** — all five parsers read the same shared file formats. Copy from smart-developer's `src/parsers/` without changes.

Parser details:
- `planParser.ts`: `parsePlan()` parses `##` headings as steps; `findPlanFile()` does breadth-first recursive search up to configurable `maxDepth`, skipping `node_modules`, `.git`, `dist`, `out`, `build`
- `progressParser.ts`: parses emoji status (⏳/🔄/✅), iteration N/5 format, commit hashes, and Last Action section
- `devNotesParser.ts`: returns `DevNotes` with sections (whatWasImplemented, filesChanged, decisions, questions, feedbackAddressed, feedbackDisputed)
- `reviewFeedbackParser.ts`: parses REVIEW_FEEDBACK.md with APPROVED/CHANGES_REQUIRED status, changes required items with description + howToFix
- `decisionsParser.ts`: parses decision entries with step, context, rationale, date; `Decision` interface defined locally in this file

### Files to Create

- `src/parsers/planParser.ts` — Identical to smart-developer
- `src/parsers/progressParser.ts` — Identical to smart-developer
- `src/parsers/devNotesParser.ts` — Identical to smart-developer
- `src/parsers/reviewFeedbackParser.ts` — Identical to smart-developer
- `src/parsers/decisionsParser.ts` — Identical to smart-developer

### Acceptance Criteria

- [ ] All five parsers compile without errors
- [ ] `parsePlan` correctly identifies `##` headings as steps
- [ ] `findPlanFile` finds PLAN.md at root and in subdirectories (respects `planSearchMaxDepth`)
- [ ] `parseProgress` round-trips with `writeProgress` (write then parse gives same data)
- [ ] `parseReviewFeedback` correctly parses APPROVED/CHANGES_REQUIRED status
- [ ] `parseDevNotes` extracts all sections including feedback addressed/disputed
- [ ] `parseDecisions` extracts entries with step, context, rationale, date
- [ ] All parsers return `undefined` or `[]` for missing files (no thrown exceptions)

### Dev-Agent Decisions

- None (copy verbatim)

---

## Step 4: Markdown File Writers

**Goal:** Implement writers for REVIEW_FEEDBACK.md and PROGRESS.md — the two files the reviewer writes.

### Requirements

- Write REVIEW_FEEDBACK.md with the exact format the dev-agent expects
- Write PROGRESS.md with status table and metadata
- Update individual steps and last action in progress
- Never overwrite decisions or dev notes (reviewer doesn't write those)

### Implementation Notes

**Review-specific code** — the reviewer only writes two files:

**`reviewFeedbackWriter.ts`** — writes REVIEW_FEEDBACK.md with this exact format:

```markdown
# Review Feedback — Step N: [Step Title]

## Summary
[Brief overall assessment]

## ✅ Approved Items
- [What looks good and meets requirements]
(or "None.")

## ❌ Changes Required
- [ ] **Issue description**: How to fix it
(or "None.")

## 💡 Suggestions (Optional)
- [Non-blocking improvements]
(or "None.")

## ❓ Questions
- [Clarifying questions]
(or "None.")

## Iteration
- Iteration: X/5
- Status: APPROVED | CHANGES_REQUIRED
```

This format is the **contract** between reviewer and dev-agent. The dev-agent's `reviewFeedbackParser.ts` must be able to parse this exactly.

**`progressWriter.ts`** — identical to smart-developer. Copy without changes. The reviewer uses these functions:
- `writeProgress()` — writes full PROGRESS.md
- `updateProgressStep()` — updates a single step's status/iteration/commit
- `updateLastAction()` — updates the Last Action section

**Reviewer's PROGRESS.md update rules** (enforced in code, not just prompt):
- After writing CHANGES_REQUIRED feedback: keep step as 🔄 In Progress, increment iteration
- After writing APPROVED feedback: keep step as 🔄 In Progress (user must explicitly approve to mark ✅)
- Never mark ✅ Complete without explicit user button click

### Files to Create

- `src/writers/reviewFeedbackWriter.ts` — New code (write REVIEW_FEEDBACK format)
- `src/writers/progressWriter.ts` — Identical to smart-developer

### Acceptance Criteria

- [ ] Both writers compile without errors
- [ ] `writeReviewFeedback` produces output that `parseReviewFeedback` can round-trip parse
- [ ] `writeProgress` produces output that `parseProgress` can round-trip parse
- [ ] `updateProgressStep` returns a new Progress with only the specified step changed
- [ ] `updateLastAction` returns a new Progress with updated lastAction
- [ ] REVIEW_FEEDBACK.md format includes all required sections with emoji headings

### Dev-Agent Decisions

- Whether to add validation that status is only APPROVED or CHANGES_REQUIRED

---

## Step 5: Git Operations (Read-Only)

**Goal:** Implement read-only git operations for finding the worktree and retrieving diffs.

### Requirements

- Get project root, project name
- Find the dev worktree at `../<project-name>-dev/`
- Get full diff (base...HEAD) and latest diff (HEAD~1...HEAD)
- Guess base branch (main or master)
- Get current branch and latest commit hash
- NO write operations — reviewer never creates worktrees, commits, or modifies code

### Implementation Notes

**Subset of smart-developer** — copy only the read-only functions from smart-developer's `src/git.ts`.

Functions to include:
- `getProjectRoot(dir)` → `string | undefined`
- `getProjectName(projectRoot)` → `string`
- `findDevWorktree(projectRoot)` → `WorktreeInfo`
- `getDiff(dir, base?)` → `string`
- `getLatestDiff(dir)` → `string`
- `guessBaseBranch(dir)` → `string`
- `getCurrentBranch(dir)` → `string`
- `getLatestCommit(dir)` → `string`

Functions to EXCLUDE (dev-agent only):
- `createDevWorktree`, `hasUncommittedChanges`, `commitChanges`, `removeWorktree`

Internal helpers: `execGit()` (spawnSync with 30s timeout, 10MB buffer), `isDirectory()`

### Files to Create

- `src/git.ts` — Copy read-only functions from smart-developer

### Acceptance Criteria

- [ ] File compiles without errors
- [ ] All functions use `spawnSync` with no shell execution
- [ ] `findDevWorktree` returns `WorktreeInfo` with `exists: false` when worktree is missing
- [ ] `getDiff` falls back from triple-dot to double-dot syntax on error
- [ ] All git operations return empty string or undefined on error (no thrown exceptions for expected failures)

### Dev-Agent Decisions

- None (copy verbatim)

---

## Step 6: System Prompt

**Goal:** Build the system prompt that instructs the AI to act as a review-agent, with the exact REVIEW_FEEDBACK.md output format.

### Requirements

- Define the REVIEW_FEEDBACK.md output format as an explicit template in the prompt
- Build the system prompt dynamically with review context
- Instruct the AI on its role, rules, review criteria, and output format
- Include context: plan step, full plan, progress state, dev notes, decisions, diff

### Implementation Notes

**Review-specific code** — this is the core of the reviewer's intelligence.

The system prompt has five sections:

**1. Role definition**: "You are a review-agent — an expert code reviewer that reviews code changes against a development plan."

**2. Core rules**:
- Only review the current step
- Never make code changes (reviewer only writes feedback)
- Be thorough but fair
- Maximum 5 iterations per step
- Independent verification — verify claims before flagging
- Respect past decisions from DECISIONS.md

**3. Review criteria** (priority order):
1. Plan requirements — does it fulfill all requirements?
2. DEV_NOTES claims — did the developer actually do what they said?
3. DECISIONS consistency — do choices align with past decisions?
4. Code quality — clean, readable, follows conventions?
5. Testing — appropriate tests? Edge cases covered?
6. Edge cases — error handling, runtime failures?

**4. Output format** — the exact REVIEW_FEEDBACK.md template (as shown in Step 4). The AI is instructed to produce its review in this format ONLY.

**5. Dynamic context** — injected at build time:
- Current step from PLAN.md
- Full PLAN.md (for cross-step reference)
- PROGRESS.md state
- DEV_NOTES.md content
- DECISIONS.md content
- Git diff
- Test/lint results (currently always "not available")

**Prompt context interface**:
```typescript
export interface ReviewPromptContext {
    planStep: string;
    planFull?: string;
    progressState: string;
    devNotes: string;
    pastDecisions: string;
    diff: string;
    testResults?: string;
    lintResults?: string;
}
```

Build function: `buildReviewSystemPrompt(context: ReviewPromptContext): string` — assembles all sections into one system prompt string.

### Files to Create

- `src/prompts/reviewSystemPrompt.ts` — New code (system prompt builder + ReviewPromptContext interface)

### Acceptance Criteria

- [ ] File compiles without errors
- [ ] `buildReviewSystemPrompt(context)` returns a complete system prompt string
- [ ] System prompt includes the exact REVIEW_FEEDBACK.md template
- [ ] System prompt includes the 6 review criteria
- [ ] System prompt includes the 6 core rules
- [ ] Dynamic context sections are injected with XML tags for clear boundaries
- [ ] When test/lint results are undefined, the prompt shows "No results available"

### Dev-Agent Decisions

- Exact wording of the role definition and rules
- Whether to include examples of good and bad reviews

---

## Step 7: Context Builder

**Goal:** Assemble all the context needed for an AI review — plan state, dev notes, decisions, diff.

### Requirements

- Gather all shared state files for a given step
- Find the dev worktree and retrieve the appropriate diff
- Return a structured context result ready for the system prompt
- Provide a convenience function for the current in-progress step

### Implementation Notes

**Review-specific code** — adapts the pattern from smart-developer's context builder but for review context.

The context builder:
1. Parses PLAN.md and PROGRESS.md
2. Finds the dev worktree using `findDevWorktree()`
3. Reads DEV_NOTES.md and DECISIONS.md from plan root
4. Gets the diff using `getDiffForStep()` (full for iter 1, latest for iter > 1)
5. Assembles everything into `ReviewContextResult`

```typescript
export interface ReviewContextResult {
    plan: Plan;
    step: Step;
    stepIndex: number;
    iteration: number;
    progress: Progress | undefined;
    worktreePath: string;
    promptContext: ReviewPromptContext;
}
```

Functions:
- `buildReviewContext(planRoot, stepIndex, iteration)` → `ReviewContextResult | undefined`
- `buildCurrentStepContext(planRoot)` → `ReviewContextResult | undefined` (finds the in-progress step)

Error handling: returns `undefined` if plan not found, worktree missing, or step index out of range.

### Files to Create

- `src/contextBuilder.ts` — New code (review context assembly)

### Acceptance Criteria

- [ ] File compiles without errors
- [ ] `buildReviewContext` returns `undefined` when no plan found
- [ ] `buildReviewContext` returns `undefined` when no worktree found
- [ ] `buildReviewContext` returns `undefined` for invalid step index
- [ ] `buildCurrentStepContext` finds the in-progress step automatically
- [ ] Iteration is calculated correctly from PROGRESS.md (current iteration + 1)
- [ ] Diff is retrieved using `getDiffForStep` with correct iteration logic

### Dev-Agent Decisions

- How to read text files (helper function vs. inline)

---

## Step 8: Diff Viewer

**Goal:** Provide diff viewing utilities for showing code changes in chat and dedicated editor tabs.

### Requirements

- Get the appropriate diff based on iteration (full vs. latest)
- Open diff content in a syntax-highlighted editor tab

### Implementation Notes

**Identical to smart-developer** — copy without changes.

Two functions:
- `getDiffForStep(worktreeDir, iteration)` — full diff (base...HEAD) for iteration <= 1, latest diff (HEAD~1...HEAD) for iteration > 1
- `openDiffEditor(diffContent, title)` — opens untitled document with `language: 'diff'` in a new tab

### Files to Create

- `src/diffViewer.ts` — Identical to smart-developer

### Acceptance Criteria

- [ ] File compiles without errors
- [ ] `getDiffForStep` returns full diff when iteration is 0 or 1
- [ ] `getDiffForStep` returns latest-only diff when iteration > 1
- [ ] `openDiffEditor` opens a new editor tab with diff syntax highlighting

### Dev-Agent Decisions

- None (copy verbatim)

---

## Step 9: Sidebar TreeView — Review Context Dashboard

**Goal:** Build the sidebar tree view showing review context, worktree info, current step, review files, and all step statuses.

### Requirements

- Show plan name and branch in a collapsible section
- Show worktree path and status in a collapsible section
- Show current step with status, iteration, and last action
- Show review files (DEV_NOTES, DECISIONS, REVIEW_FEEDBACK) as clickable items with summaries
- Show all steps with status icons (⏳/🔄/✅)
- File watchers trigger automatic tree refresh

### Implementation Notes

**Review-specific code** — different layout from smart-developer's sidebar.

Layout:
```
📋 Plan: my-feature (feature/plan-my-feature)
  Branch: feature/plan-my-feature
  Created: 2025-01-15
📍 Worktree: ../my-project-dev
  Path: /full/path/to/worktree
  Branch: feature/plan-my-feature
📌 Current: Step 2: Build API (🔄 In Progress — iter 2/5)
  Last: review-agent — "Reviewed Step 2: CHANGES_REQUIRED"
  Time: 2025-01-15 14:30
📂 Review Files
  📝 DEV_NOTES.md — 5 files, 2 disputes
  📋 DECISIONS.md — 3 decisions
  🔍 REVIEW_FEEDBACK.md — ❌ CHANGES_REQUIRED, 3 issues
📂 All Steps
  ✅ Step 1: Setup Auth
  🔄 Step 2: Build API                     abc1234
  ⏳ Step 3: Frontend
```

Tree item types with icons:
- `plan` → notebook icon
- `worktree` → root-folder icon
- `currentStep` → pin icon
- `file` → file-text icon (clickable → opens file)
- `step-complete` → check icon (green)
- `step-inprogress` → sync~spin icon (blue)
- `step-pending` → circle-outline icon
- `step-issues` → error icon (red, for CHANGES_REQUIRED)
- `section` → folder icon

Click behavior:
- File items → `vscode.open` with file URI
- Step items → `vscode.open` with PLAN.md URI

### Files to Create

- `src/providers/reviewTreeProvider.ts` — New code (review-specific sidebar)

### Acceptance Criteria

- [ ] Tree view appears in the Smart Reviewer activity bar panel
- [ ] Plan info shows plan name and branch
- [ ] Worktree section shows path and branch (or "Not found" if missing)
- [ ] Current step shows status icon and iteration count
- [ ] Review Files section shows DEV_NOTES.md, DECISIONS.md, REVIEW_FEEDBACK.md with summaries
- [ ] REVIEW_FEEDBACK.md shows ❌ icon when CHANGES_REQUIRED
- [ ] All Steps section shows every step with correct status icon and commit hash
- [ ] Clicking a file item opens it in the editor
- [ ] Clicking a step item opens PLAN.md in the editor
- [ ] Tree shows "No plan found" message when no PLAN.md in workspace

### Dev-Agent Decisions

- Exact label formatting for tree items
- Whether to show file size or line count in review file items

---

## Step 10: Chat Handler — Core Review Flow

**Goal:** Implement the `/review` command that drives AI to review a plan step — from reading context to producing REVIEW_FEEDBACK.md.

### Requirements

- Handle `/review [step]` and `/status` chat commands
- Parse PLAN.md and determine which step to review
- Build full review context using the context builder
- Send to AI with streaming, display analysis in chat
- Parse AI response into structured `ReviewFeedback`
- Show summary to user and prompt for approval
- Write REVIEW_FEEDBACK.md and update PROGRESS.md on approval
- Enforce: never modify source code, never auto-mark ✅ Complete, max 5 iterations

### Implementation Notes

**Review-specific code** — this is the core of the reviewer.

**`/status` flow** (simple):
1. Parse plan and progress
2. Show formatted status table in chat
3. Show worktree info and REVIEW_FEEDBACK.md status

**`/review [step]` flow** (complex — the main workflow):

1. **Validate**: PLAN.md exists, determine step number (from argument or current in-progress step)
2. **Read context**: call `buildReviewContext(planRoot, stepIndex, iteration)`
3. **Check iteration**: if > 5, warn and escalate to user
4. **Stream to AI**: call `provider.stream()` with system prompt + user message, display chunks in chat
5. **Parse response**: call `parseAiResponse(aiText, stepIndex, stepTitle, iteration)` — extracts:
   - Status (APPROVED/CHANGES_REQUIRED) from Iteration section
   - Summary from Summary section
   - Approved items, changes required, suggestions, questions from bullet sections
6. **Show result**: display status and issue count in chat
7. **Prompt user**: `showInformationMessage` — "Write REVIEW_FEEDBACK.md and update PROGRESS.md?" with "Write & Save" / "Discard"
8. **On "Write & Save"**:
   - Call `writeReviewFeedback()` to write REVIEW_FEEDBACK.md
   - Call `updateProgressStep()` to set iteration and lastCommit
   - Call `updateLastAction()` with "review-agent" and review description
   - Call `writeProgress()` to write updated PROGRESS.md
9. **If APPROVED**: ask user "Mark step as Complete?" → "Mark Complete" / "Keep In Progress"
   - On "Mark Complete": update PROGRESS.md with ✅ Complete
10. **If CHANGES_REQUIRED**: show message directing dev-agent to address feedback

**`parseAiResponse` function** — extracts structured ReviewFeedback from AI text:
- Extracts `## Iteration` section to determine APPROVED/CHANGES_REQUIRED
- Extracts `## Summary`, `## ✅ Approved Items`, `## ❌ Changes Required`, `## 💡 Suggestions`, `## ❓ Questions`
- Uses bullet extraction regex for list items
- Default status is CHANGES_REQUIRED (safe default if parsing fails)

**Error handling**:
- No PLAN.md → "No plan root found. Open a workspace with a PLAN.md file."
- No worktree → "Could not build review context. Ensure dev worktree exists."
- Empty diff → "No diff found. Ensure the dev worktree has commits."
- AI provider error → show error message in chat

### Files to Create

- `src/chatHandler.ts` — New code (main chat handler with review + status flows + AI response parser)

Note: The actual file is `src/chatHandler.ts` (flat, no `chat/` subdirectory), matching the existing codebase structure.

### Acceptance Criteria

- [ ] `/review 2` in chat starts reviewing Step 2
- [ ] `/review` with no argument reviews the current in-progress step (or prompts to specify)
- [ ] `/status` shows plan name, branch, worktree, step table, and review feedback status
- [ ] AI response streams in the chat panel in real-time
- [ ] Review result (APPROVED/CHANGES_REQUIRED) is displayed with issue count
- [ ] User must click "Write & Save" before REVIEW_FEEDBACK.md is written
- [ ] REVIEW_FEEDBACK.md is written with correct step number, iteration, and status
- [ ] PROGRESS.md is updated with iteration count and last action
- [ ] Step is NEVER auto-marked ✅ Complete — user must explicitly approve
- [ ] Iteration > 5 shows warning and stops reviewing
- [ ] CHANGES_REQUIRED reviews prompt dev-agent to address feedback
- [ ] Error cases show clear messages in chat

### Dev-Agent Decisions

- Exact wording of user prompts and error messages
- Whether to show the full AI response or just the summary before approval

---

## Step 11: Extension Activation Wiring

**Goal:** Wire everything together in the extension entry point — register chat participant, commands, tree view, file watchers, and handle workspace changes.

### Requirements

- Register `@smart-reviewer` chat participant with `/review` and `/status` commands
- Register all 8 palette commands
- Register TreeView with the review tree provider
- Register file watchers for all 5 shared state files
- Detect plan root on activation and on workspace changes
- Handle workspace folder additions/removals

### Implementation Notes

**Adapt from smart-developer's pattern** — the activation structure is identical.

Key activation steps:
1. `detectPlanRoot()` — search workspace folders for PLAN.md using `findPlanFile()` with `planSearchMaxDepth`
2. Create `ReviewTreeProvider`, set plan root, register TreeView as `smart-reviewer-overview`
3. Create chat participant with `handleChatRequest` callback, set icon path
4. Register commands:
   - `reviewStep`, `approveStep` → open chat with `@smart-reviewer /review`
   - `requestChanges` → show info message directing to chat
   - `viewDiff` → get diff from worktree, open in diff editor
   - `viewDiffLatest` → get latest diff from worktree, open in diff editor
   - `openWorktree` → open worktree folder in VSCode
   - `refresh` → re-detect plan root, refresh tree
   - `settings` → open settings for `smart-reviewer`
5. Register file watchers for `**/PLAN.md`, `**/PROGRESS.md`, `**/DEV_NOTES.md`, `**/REVIEW_FEEDBACK.md`, `**/DECISIONS.md`
6. Register `onDidChangeWorkspaceFolders` handler

Chat participant creation should be wrapped in try/catch — chat API may not be available in older VSCode versions.

### Files to Modify

- `src/extension.ts` — Expand from stub to full activation wiring

### Acceptance Criteria

- [ ] Extension activates on startup (`onStartupFinished`)
- [ ] Chat participant `@smart-reviewer` is available with `/review` and `/status` commands
- [ ] Sidebar TreeView shows plan state after activation
- [ ] All 8 palette commands are registered and functional
- [ ] File watchers trigger sidebar refresh on any shared state file change
- [ ] Changing workspace folders re-detects plan root
- [ ] `viewDiff` command shows full diff in a diff editor tab
- [ ] `viewDiffLatest` command shows latest commit diff in a diff editor tab
- [ ] Extension deactivates cleanly (no dangling watchers or listeners)
- [ ] Chat participant creation failure is handled gracefully (log warning, don't crash)

### Dev-Agent Decisions

- Whether to prompt for API key on activation or wait until first review

---

## Step 12: Testing and Packaging

**Goal:** Verify the complete extension works end-to-end and package it as a `.vsix` file.

### Requirements

- TypeScript compilation with zero errors
- Extension loads and activates in Extension Development Host
- End-to-end test: review a step, verify REVIEW_FEEDBACK.md, verify PROGRESS.md update
- All three AI providers can be selected and used
- Package as `.vsix`

### Implementation Notes

**Compilation**: Run `npm run compile` (tsc) and verify zero errors.

**Manual test scenarios** (perform in order):

1. **Activation**: Open a workspace with a PLAN.md file and a dev worktree with commits → verify sidebar populates, `@smart-reviewer` appears in chat
2. **Status**: Type `/status` in chat → verify plan info, step statuses, worktree info shown
3. **Review (Copilot)**: Set provider to Copilot, type `/review 1` → verify AI streams analysis, produces APPROVED or CHANGES_REQUIRED, REVIEW_FEEDBACK.md written
4. **View Diff**: Run "Smart Reviewer: View Full Diff" → verify diff opens in editor with syntax highlighting
5. **View Latest Diff**: Run "Smart Reviewer: View Latest Diff" → verify latest commit diff shown
6. **Approve**: If review was APPROVED, verify "Mark Complete" prompt appears, clicking it updates PROGRESS.md with ✅
7. **Review (Anthropic)**: Switch provider to Anthropic, set API key, repeat review → verify works
8. **Review (OpenAI)**: Switch provider to OpenAI, set API key, repeat review → verify works
9. **Sidebar refresh**: Modify PROGRESS.md externally → verify sidebar updates
10. **Error cases**: Test with no PLAN.md, no worktree, empty diff, invalid step number → verify clear error messages
11. **Packaging**: Run `npx vsce package` → verify `.vsix` file is produced

### User Verification

Before considering the extension complete, manually verify the full dev-agent ↔ review-agent cycle:
1. Use Smart Developer to implement a step → commit
2. Use Smart Reviewer to review the step → write REVIEW_FEEDBACK.md
3. If CHANGES_REQUIRED: Use Smart Developer `/feedback` to address issues → commit
4. Use Smart Reviewer to re-review → approve → mark complete
5. Verify both extensions agree on PROGRESS.md state at every step

### Files to Modify

- None (testing only)

### Acceptance Criteria

- [ ] `npm run compile` produces zero errors and zero warnings
- [ ] Extension activates in Extension Development Host without errors
- [ ] `/status` displays correct plan state
- [ ] `/review` with Copilot provider works end-to-end (AI response → REVIEW_FEEDBACK.md → PROGRESS.md updated)
- [ ] `/review` with Anthropic provider works (after setting API key)
- [ ] `/review` with OpenAI provider works (after setting API key)
- [ ] REVIEW_FEEDBACK.md is parseable by the dev-agent's `reviewFeedbackParser`
- [ ] PROGRESS.md is parseable by the dev-agent's `progressParser`
- [ ] Error cases show clear messages (no unhandled exceptions)
- [ ] `npx vsce package` produces a `.vsix` file under 5MB
- [ ] Full dev-agent ↔ review-agent cycle works without state disagreements

### Dev-Agent Decisions

- Whether to add automated tests
- Test PLAN.md content to use for manual testing
