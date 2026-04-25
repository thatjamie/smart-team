# Plan: Smart Team Common — Shared Module

## Overview

A shared npm package providing common types, AI providers, markdown parsers/writers, git operations, and diff utilities used by the **Smart Planner**, **Smart Developer**, and **Smart Reviewer** VSCode extensions. This package contains the shared code across all three extensions, ensuring consistent behavior for shared state files (`PLAN.md`, `PROGRESS.md`, `DEV_NOTES.md`, `DECISIONS.md`, `REVIEW_FEEDBACK.md`).

## Context

### Existing System

The `smart-team` monorepo contains three VSCode extensions:
- **Smart Planner** (`../smart-planner/`) — AI plan-agent that creates PLAN.md from user interviews
- **Smart Developer** (`../smart-developer/`) — AI dev-agent that implements code from `PLAN.md`
- **Smart Reviewer** (`../smart-reviewer/`) — AI review-agent that reviews code against `PLAN.md`

All three extensions share the same state file formats, AI provider abstractions, and most parsers/writers. This package extracts the shared code into a single source of truth.

**Consumers**: This package is consumed by all three extensions as a local npm dependency (`"smart-team-common": "file:../smart-team-common"`).

**Note**: Smart Planner uses a subset of common (types, AI providers, planParser, progressParser, progressWriter) but does NOT use git operations, diff viewer, devNotesWriter, decisionsWriter, or reviewFeedbackWriter.

### Tech Stack

- **Language**: TypeScript (strict mode)
- **Module system**: CommonJS (consumed by VSCode extension host which uses Node.js)
- **Build**: `tsc` → `out/`
- **External dependencies** (peer dependencies, provided by consumers):
  - `@anthropic-ai/sdk` (^0.30.0) — if using Anthropic provider
  - `openai` (^4.52.0) — if using OpenAI provider
- **VSCode API**: The AI Copilot provider requires `vscode` types but this package does NOT bundle VSCode — consumers pass `vscode.lm` and `vscode.SecretStorage` at runtime. The package only needs `@types/vscode` as a dev dependency for compilation.

### Conventions

- **File organization**: `src/<domain>/<file>.ts` — group by domain (ai, parsers, writers, git)
- **Naming**: camelCase for files and variables, PascalCase for classes and interfaces
- **JSDoc**: Every exported function and interface has a JSDoc comment
- **Error handling**: try/catch with undefined returns (no thrown exceptions for expected failures)
- **No side effects**: All functions are pure utilities — no global state, no singletons
- **No VSCode runtime dependency**: The package compiles against `@types/vscode` but does NOT import `vscode` at runtime except through provider implementations that are instantiated by consumers

### References

- Smart Planner plan: `../smart-planner/PLAN.md`
- Smart Developer plan: `../smart-developer/PLAN.md`
- Smart Reviewer plan: `../smart-reviewer/PLAN.md`
- VSCode Language Model API: https://code.visualstudio.com/api/extension-guides/language-model

---

## Step 1: Project Scaffold and Types

**Goal:** Set up the npm package structure and define all shared types — the foundation for every other module.

### Requirements

- Create `package.json` as a local npm package (`name: "smart-team-common"`)
- Create `tsconfig.json` (target ES2022, module commonjs, strict, declaration + sourcemaps)
- Create `.gitignore` excluding `node_modules/` and `out/`
- Define ALL shared types in `src/types.ts`
- Export everything from a barrel `src/index.ts`

### Implementation Notes

**Package.json**:
- `name`: `"smart-team-common"`
- `version`: `"0.1.0"`
- `main`: `"./out/index.js"`
- `types`: `"./out/index.d.ts"`
- `scripts`: `compile` (tsc), `watch` (tsc -watch)
- `devDependencies`: `@types/vscode` (^1.90.0), `@types/node` (^20.14.0), `typescript` (^5.5.0)
- `peerDependencies`: `@anthropic-ai/sdk` (^0.30.0), `openai` (^4.52.0)
- No regular `dependencies` — all runtime deps are peer dependencies provided by consumers

**Types** — ALL shared types in `src/types.ts`:

```typescript
// ─── Step Status ───────────────────────────────────────────────────────────────

/** Status of a plan step. Mirrors the emoji-based status in PROGRESS.md. */
export enum StepStatus {
    Pending = 'pending',
    InProgress = 'in-progress',
    Complete = 'complete',
}

// ─── Plan ──────────────────────────────────────────────────────────────────────

/** A single step parsed from PLAN.md. Steps are identified by ## headings. */
export interface Step {
    /** Zero-based index of this step in the plan */
    index: number;
    /** Heading text (e.g., "Extension Scaffold") */
    title: string;
    /** Heading level (2 for ##, 3 for ###) */
    level: number;
    /** Full markdown content of the step (everything until the next heading) */
    content: string;
    /** Current status, may be overridden by PROGRESS.md */
    status: StepStatus;
    /** Review iteration count (from PROGRESS.md) */
    iteration: number;
    /** Last git commit hash for this step (from PROGRESS.md) */
    lastCommit: string;
}

/** A parsed PLAN.md. */
export interface Plan {
    /** Plan name (derived from directory or explicit title) */
    name: string;
    /** Absolute path to PLAN.md */
    filePath: string;
    /** Parsed steps from the plan */
    steps: Step[];
}

// ─── Progress ──────────────────────────────────────────────────────────────────

/** A single step entry in PROGRESS.md. */
export interface ProgressStepEntry {
    /** Step label (e.g., "Step 1: Extension Scaffold") */
    label: string;
    /** Current status */
    status: StepStatus;
    /** Review iteration count */
    iteration: number;
    /** Last git commit hash */
    lastCommit: string;
}

/** Last action recorded in PROGRESS.md. */
export interface ProgressLastAction {
    /** Which agent performed the action (dev-agent or review-agent) */
    agent: string;
    /** Description of the action */
    action: string;
    /** ISO timestamp */
    timestamp: string;
}

/** Parsed PROGRESS.md. */
export interface Progress {
    /** Plan name */
    planName: string;
    /** Git branch name */
    branch: string;
    /** Date the progress was created */
    created: string;
    /** Step entries from the progress table */
    steps: ProgressStepEntry[];
    /** Last action metadata */
    lastAction: ProgressLastAction;
}

// ─── Worktree ──────────────────────────────────────────────────────────────────

/** Information about the dev worktree. */
export interface WorktreeInfo {
    /** Absolute path to the worktree directory */
    path: string;
    /** Git branch name checked out in the worktree */
    branch: string;
    /** Whether the worktree directory exists */
    exists: boolean;
}

// ─── Review Feedback ───────────────────────────────────────────────────────────

/** A single blocking issue in a review. */
export interface ChangesRequiredItem {
    /** Description of the issue */
    description: string;
    /** Suggested fix */
    howToFix: string;
    /** Whether this issue has been resolved (for tracking across iterations) */
    resolved: boolean;
}

/** Parsed REVIEW_FEEDBACK.md. */
export interface ReviewFeedback {
    /** Step index being reviewed */
    stepIndex: number;
    /** Step title */
    stepTitle: string;
    /** Brief overall assessment */
    summary: string;
    /** Items that look good and meet requirements */
    approvedItems: string[];
    /** Blocking issues that must be addressed */
    changesRequired: ChangesRequiredItem[];
    /** Non-blocking improvement suggestions */
    suggestions: string[];
    /** Clarifying questions */
    questions: string[];
    /** Current review iteration */
    iteration: number;
    /** Review status: APPROVED or CHANGES_REQUIRED */
    status: 'APPROVED' | 'CHANGES_REQUIRED';
}

// ─── Decisions ─────────────────────────────────────────────────────────────────

/** A single decision entry from DECISIONS.md. */
export interface Decision {
    /** Which step the decision belongs to (e.g., "Step 1: Extension Scaffold") */
    step: string;
    /** Short description of the decision */
    decision: string;
    /** Why this decision was needed */
    context: string;
    /** Why this approach was chosen */
    rationale: string;
    /** Date of the decision */
    date: string;
}

// ─── Dev Notes ─────────────────────────────────────────────────────────────────

/** Structured representation of DEV_NOTES.md. */
export interface DevNotes {
    /** Raw content of the file */
    raw: string;
    /** Step title from the heading */
    stepTitle: string;
    /** Items listed under "What was implemented" */
    whatWasImplemented: string[];
    /** Files listed under "Files changed" */
    filesChanged: string[];
    /** Decisions listed under "Decisions made" */
    decisions: string[];
    /** Questions for the reviewer */
    questions: string[];
    /** Review feedback that was addressed (if iteration > 1) */
    feedbackAddressed: string[];
    /** Review feedback respectfully disputed */
    feedbackDisputed: string[];
}

// ─── AI Provider ───────────────────────────────────────────────────────────────

/** A single message in a chat conversation. */
export interface AiMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/** Response from an AI provider. */
export interface AiResponse {
    text: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
}

/** Options for AI chat calls. */
export interface AiChatOptions {
    maxTokens?: number;
}

/** Abstract AI provider interface. All providers must implement chat and streaming. */
export interface AiProvider {
    /** Send messages and get a complete response. */
    chat(messages: AiMessage[], options?: AiChatOptions): Promise<AiResponse>;
    /** Send messages and stream the response, calling onChunk for each text fragment. */
    stream(
        messages: AiMessage[],
        onChunk: (text: string) => void,
        options?: AiChatOptions
    ): Promise<AiResponse>;
}
```

**Barrel export** (`src/index.ts`): Re-export everything from all modules so consumers can `import { StepStatus, parsePlan, ... } from 'smart-team-common'`.

### Files to Create

- `package.json` — NPM package manifest
- `tsconfig.json` — TypeScript config
- `.gitignore` — Git exclusions
- `src/types.ts` — All shared types
- `src/index.ts` — Barrel export (initially just types, expanded in later steps)

### Acceptance Criteria

- [ ] `npm install` completes without errors
- [ ] `npm run compile` (tsc) produces no errors and outputs to `out/`
- [ ] `out/index.d.ts` is generated with all type declarations
- [ ] All types listed above are exported from `src/types.ts`
- [ ] `package.json` has peerDependencies for `@anthropic-ai/sdk` and `openai`
- [ ] No `dependencies` in `package.json` (only peerDependencies and devDependencies)

### Dev-Agent Decisions

- Exact version ranges for peer dependencies
- Whether to add `@types/node` as a devDependency

---

## Step 2: AI Provider Implementations

**Goal:** Implement the three AI providers (Copilot, Anthropic, OpenAI) and the factory that creates them based on consumer configuration.

### Requirements

- Implement `CopilotProvider` using VSCode Language Model API
- Implement `AnthropicProvider` using `@anthropic-ai/sdk`
- Implement `OpenAIProvider` using `openai` npm package
- Implement `ProviderFactory` that accepts namespace as parameter (not hardcoded)
- All providers must support both `chat()` and `stream()`

### Implementation Notes

**`copilotProvider.ts`**: Uses `vscode.lm.selectChatModels()` and `vscode.LanguageModelChat`. The `system` role is mapped to `User` since VSCode's LM API has no dedicated system role. The provider receives `vscode.lm` namespace at construction time (passed by consumer).

**`anthropicProvider.ts`**: Uses `@anthropic-ai/sdk`. Extracts system messages separately since the Anthropic API requires the system prompt as a separate parameter. Constructor takes `apiKey`, `model`, and optional `baseUrl`.

**`openaiProvider.ts`**: Uses `openai` npm package. Constructor takes `apiKey`, `model`, and optional `baseUrl`. Captures usage from streaming chunks.

**`providerFactory.ts`**: Key design — the factory takes a **namespace** parameter so it works for both extensions:

```typescript
export class ProviderFactory {
    /**
     * Create an AI provider based on configuration.
     * @param secretStorage - VSCode SecretStorage for API keys
     * @param configNamespace - 'smart-developer' or 'smart-reviewer'
     */
    static async create(
        secretStorage: vscode.SecretStorage,
        configNamespace: string
    ): Promise<AiProvider> {
        const config = vscode.workspace.getConfiguration(configNamespace);
        const providerName = config.get<string>('aiProvider', 'copilot');
        // ... switch on providerName
    }
}
```

This avoids duplicating the factory code — both extensions call the same factory with their own namespace.

### Files to Create

- `src/ai/provider.ts` — AiProvider, AiMessage, AiResponse, AiChatOptions interfaces (re-exported from types or defined here and re-exported)
- `src/ai/copilotProvider.ts` — CopilotProvider class
- `src/ai/anthropicProvider.ts` — AnthropicProvider class
- `src/ai/openaiProvider.ts` — OpenAIProvider class
- `src/ai/providerFactory.ts` — ProviderFactory class with namespace parameter

### Acceptance Criteria

- [ ] All five files compile without errors
- [ ] `ProviderFactory.create(secrets, 'smart-developer')` reads `smart-developer.aiProvider` setting
- [ ] `ProviderFactory.create(secrets, 'smart-reviewer')` reads `smart-reviewer.aiProvider` setting
- [ ] Missing API key for Anthropic/OpenAI throws descriptive error
- [ ] Copilot provider handles case where no models are available
- [ ] Both `chat()` and `stream()` return `AiResponse` with optional `usage`
- [ ] `stream()` calls `onChunk` for each text fragment during streaming

### Dev-Agent Decisions

- Whether to define AI interfaces in `types.ts` or `ai/provider.ts` (recommend: `ai/provider.ts` for cohesion, re-exported from `index.ts`)

---

## Step 3: Parsers

**Goal:** Implement all five markdown file parsers for shared state files.

### Requirements

- Parse PLAN.md into `Plan` with `Step[]`
- Parse PROGRESS.md into `Progress`
- Parse DEV_NOTES.md into structured `DevNotes`
- Parse REVIEW_FEEDBACK.md into `ReviewFeedback`
- Parse DECISIONS.md into `Decision[]`

### Implementation Notes

All parsers read a **shared file format contract** — both extensions must parse identically.

**`planParser.ts`**:
- `parsePlan(planFilePath, progressOverrides?)` → `Plan`
- `findPlanFile(workspaceRoot, maxDepth?)` — breadth-first recursive search, skips `node_modules`, `.git`, `dist`, `out`, `build`, `__pycache__`, etc.

**`progressParser.ts`**:
- `parseProgress(filePath)` → `Progress | undefined`
- Parses emoji status (⏳/🔄/✅), iteration N/5, commit hashes, metadata, Last Action section

**`devNotesParser.ts`**:
- `parseDevNotes(filePath)` → `DevNotes | undefined`
- Extracts: whatWasImplemented, filesChanged, decisions, questions, feedbackAddressed, feedbackDisputed

**`reviewFeedbackParser.ts`**:
- `parseReviewFeedback(filePath)` → `ReviewFeedback | undefined`
- Parses: summary, approvedItems, changesRequired (with description + howToFix), suggestions, questions, iteration, APPROVED/CHANGES_REQUIRED status

**`decisionsParser.ts`**:
- `parseDecisions(filePath)` → `Decision[]`
- Parses: step, decision, context, rationale, date

**Format contracts** — these are the exact formats each parser expects:

**PROGRESS.md format**:
```markdown
# Progress — plan-name

**Plan**: plan-name
**Branch**: branch-name
**Created**: YYYY-MM-DD

| Step | Status | Iteration | Last Commit |
|------|--------|-----------|-------------|
| Step 1: Title | ✅ Complete | 2/5 | abc1234 |

## Last Action
- **Agent**: dev-agent
- **Action**: description
- **Timestamp**: YYYY-MM-DD HH:MM
```

**DEV_NOTES.md format**:
```markdown
# DEV_NOTES — Step N: [Step Title]

## What was implemented
- [item]

## Files changed
- path/to/file — description

## Decisions made
- **Decision name**: rationale

## Questions for reviewer
- [question]

## Review feedback addressed
- [items fixed]

## Review feedback respectfully disputed
- [disputed items with reasoning]
```

**REVIEW_FEEDBACK.md format**:
```markdown
# Review Feedback — Step N: [Step Title]

## Summary
[assessment]

## ✅ Approved Items
- [items] (or "None.")

## ❌ Changes Required
- [ ] **Issue**: how to fix (or "None.")

## 💡 Suggestions (Optional)
- [suggestions] (or "None.")

## ❓ Questions
- [questions] (or "None.")

## Iteration
- Iteration: X/5
- Status: APPROVED | CHANGES_REQUIRED
```

**DECISIONS.md format**:
```markdown
# Decisions Log — plan-name

## Step N: Step Title
- **Decision**: description
  - **Context**: why needed
  - **Rationale**: why this approach
  - **Date**: YYYY-MM-DD
```

### Files to Create

- `src/parsers/planParser.ts`
- `src/parsers/progressParser.ts`
- `src/parsers/devNotesParser.ts`
- `src/parsers/reviewFeedbackParser.ts`
- `src/parsers/decisionsParser.ts`

### Acceptance Criteria

- [ ] All five parsers compile without errors
- [ ] `parsePlan` correctly identifies `##` headings as steps and extracts content between them
- [ ] `findPlanFile` finds PLAN.md at root and in subdirectories up to configurable depth
- [ ] `parseProgress` correctly parses emoji status, iteration, and commit hashes
- [ ] `parseReviewFeedback` correctly parses APPROVED/CHANGES_REQUIRED status
- [ ] `parseDevNotes` extracts all sections including feedback addressed/disputed
- [ ] `parseDecisions` extracts entries with step, context, rationale, and date
- [ ] All parsers return `undefined` or `[]` for missing/unparseable files (no thrown exceptions)
- [ ] Parser output round-trips with writer output (parse → write → parse gives same data)

### Dev-Agent Decisions

- Exact regex patterns for parsing (must match the format contracts above)
- Whether to add extra validation on parsed data

---

## Step 4: Writers

**Goal:** Implement all four markdown file writers for shared state files.

### Requirements

- Write PROGRESS.md with status table and metadata
- Write DEV_NOTES.md from developer context
- Write DECISIONS.md by appending entries (never overwrite)
- Write REVIEW_FEEDBACK.md with the exact review feedback format
- Update individual steps and last action in progress

### Implementation Notes

**`progressWriter.ts`** — used by both extensions:
- `writeProgress(filePath, progress)` — writes full PROGRESS.md
- `updateProgressStep(progress, stepIndex, updates)` → `Progress` — returns new Progress with one step changed
- `updateLastAction(progress, agent, action, timestamp)` → `Progress` — returns new Progress with updated lastAction
- `initProgress(filePath, planName, branch, steps)` — creates initial PROGRESS.md

**`devNotesWriter.ts`** — used by developer only, but lives in common to keep format contract co-located with parser:
- `writeDevNotes(filePath, stepTitle, stepNumber, notes)` — writes DEV_NOTES.md in the exact format that `parseDevNotes` expects

**`decisionsWriter.ts`** — used by developer only:
- `appendDecision(filePath, stepLabel, decision)` — appends a decision entry to DECISIONS.md (never overwrites)

**`reviewFeedbackWriter.ts`** — used by reviewer only:
- `writeReviewFeedback(filePath, feedback)` — writes REVIEW_FEEDBACK.md in the exact format that `parseReviewFeedback` expects

All writers MUST produce output that their corresponding parsers can round-trip correctly.

### Files to Create

- `src/writers/progressWriter.ts`
- `src/writers/devNotesWriter.ts`
- `src/writers/decisionsWriter.ts`
- `src/writers/reviewFeedbackWriter.ts`

### Acceptance Criteria

- [ ] All four writers compile without errors
- [ ] `writeProgress` produces output that `parseProgress` can round-trip parse
- [ ] `writeDevNotes` produces output that `parseDevNotes` can round-trip parse
- [ ] `appendDecision` appends without overwriting existing decisions
- [ ] `writeReviewFeedback` produces output that `parseReviewFeedback` can round-trip parse
- [ ] `updateProgressStep` returns a new Progress with only the specified step changed
- [ ] `updateLastAction` returns a new Progress with updated lastAction
- [ ] All writers use `fs.writeFileSync` (synchronous, consistent with parsers)

### Dev-Agent Decisions

- Whether to add format validation before writing
- Whether `appendDecision` should create the file if it doesn't exist

---

## Step 5: Git Operations

**Goal:** Implement all git operations — read-only (shared by both extensions) and write operations (developer only).

### Requirements

- Read-only operations: get project root, find worktree, get diffs, guess base branch
- Write operations: create worktree, commit, check for uncommitted changes, remove worktree
- All operations use `child_process.spawnSync` — no shell execution

### Implementation Notes

**`gitRead.ts`** — used by both extensions:
- `getProjectRoot(dir)` → `string | undefined`
- `getProjectName(projectRoot)` → `string`
- `findDevWorktree(projectRoot)` → `WorktreeInfo` — looks for `../<name>-dev/`
- `getDiff(dir, base?)` → `string` — `git diff main...HEAD` with fallback to double-dot
- `getLatestDiff(dir)` → `string` — `git diff HEAD~1 HEAD`
- `guessBaseBranch(dir)` → `string` — "main" or "master"
- `getCurrentBranch(dir)` → `string`
- `getLatestCommit(dir)` → `string` — short 7-char hash

**`gitWrite.ts`** — used by developer only:
- `createDevWorktree(projectRoot, planName)` → `WorktreeInfo` — idempotent (returns existing if present)
- `hasUncommittedChanges(dir)` → `boolean`
- `commitChanges(dir, message)` → `string` — stages all, commits, returns short hash
- `removeWorktree(projectRoot, worktreePath)` → `void` — cleanup

Internal helpers (shared):
- `execGit(cwd, args)` → `string` — spawnSync with 30s timeout, 10MB max buffer
- `isDirectory(dirPath)` → `boolean`

### Files to Create

- `src/git/gitRead.ts` — Read-only git operations
- `src/git/gitWrite.ts` — Write git operations (developer only)

### Acceptance Criteria

- [ ] Both files compile without errors
- [ ] All functions use `spawnSync` with no shell execution
- [ ] `findDevWorktree` returns `WorktreeInfo` with `exists: false` when worktree is missing
- [ ] `getDiff` falls back from triple-dot to double-dot syntax on error
- [ ] `createDevWorktree` is idempotent — returns existing worktree if already created
- [ ] `commitChanges` stages all changes and returns a 7-char commit hash
- [ ] All read operations return empty string or undefined on error (no thrown exceptions)

### Dev-Agent Decisions

- Whether to separate `execGit` and `isDirectory` into their own file or keep as internal helpers

---

## Step 6: Diff Viewer

**Goal:** Provide diff viewing utilities for showing code changes.

### Requirements

- Get the appropriate diff based on iteration (full vs. latest-only)
- Open diff content in a syntax-highlighted VSCode editor tab

### Implementation Notes

- `getDiffForStep(worktreeDir, iteration)` — full diff (base...HEAD) for iteration <= 1, latest diff (HEAD~1...HEAD) for iteration > 1
- `openDiffEditor(diffContent, title)` — opens untitled document with `language: 'diff'` in VSCode

### Files to Create

- `src/diffViewer.ts`

### Acceptance Criteria

- [ ] File compiles without errors
- [ ] `getDiffForStep` returns full diff when iteration is 0 or 1
- [ ] `getDiffForStep` returns latest-only diff when iteration > 1
- [ ] `openDiffEditor` opens a new editor tab with diff syntax highlighting

### Dev-Agent Decisions

- None

---

## Step 7: Barrel Exports and Integration Testing

**Goal:** Wire up barrel exports and verify that parsers and writers round-trip correctly.

### Requirements

- `src/index.ts` exports everything from all modules
- Verify parser/writer round-trips for all four file types
- Verify TypeScript compilation with no errors
- Verify the package can be consumed by an external project

### Implementation Notes

`src/index.ts` should export:
- All types from `src/types.ts`
- AI interfaces and classes from `src/ai/*`
- All parsers from `src/parsers/*`
- All writers from `src/writers/*`
- Git operations from `src/git/*`
- Diff viewer from `src/diffViewer.ts`

Integration test approach: create test scripts (or manual verification) that:
1. Write a PROGRESS.md → parse it → compare data
2. Write a DEV_NOTES.md → parse it → compare data
3. Write a REVIEW_FEEDBACK.md → parse it → compare data
4. Append to DECISIONS.md → parse it → compare data

### Files to Modify

- `src/index.ts` — Expand to re-export all modules

### Acceptance Criteria

- [ ] `npm run compile` produces zero errors
- [ ] `out/index.d.ts` is generated with all type declarations
- [ ] `out/index.js` exports all functions and classes
- [ ] PROGRESS.md write → parse round-trip preserves all data
- [ ] DEV_NOTES.md write → parse round-trip preserves all data
- [ ] REVIEW_FEEDBACK.md write → parse round-trip preserves all data
- [ ] DECISIONS.md append → parse round-trip preserves all data
- [ ] Package can be linked from another project via `npm link` or `file:` protocol

### User Verification

Before moving on to the extension plans, verify:
1. `npm run compile` in `smart-team-common/` produces zero errors
2. `npm run compile` in a test consumer that `import { StepStatus, parsePlan } from 'smart-team-common'` works

### Dev-Agent Decisions

- Whether to add automated unit tests or rely on manual round-trip verification
