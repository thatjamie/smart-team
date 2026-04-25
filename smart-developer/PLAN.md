# Plan: Smart Developer VSCode Extension

## Overview

Build a VSCode extension that acts as an **AI dev-agent** — reading `PLAN.md`, implementing steps one at a time inside a git worktree, and committing with human approval. The extension integrates with the existing Smart Reviewer extension via shared state files (`PROGRESS.md`, `DEV_NOTES.md`, `DECISIONS.md`, `REVIEW_FEEDBACK.md`).

## Context

### Existing System

The **Smart Reviewer** (`../smart-reviewer/`) is a completed VSCode extension that reviews code against `PLAN.md` requirements. Smart Developer is its counterpart — the dev-agent that writes the code the reviewer reviews.

**Shared state file contract** (both extensions read/write these):
- `PLAN.md` — the implementation plan (read by both)
- `PROGRESS.md` — step statuses, iteration counts, last action (written by both)
- `DEV_NOTES.md` — what the dev-agent implemented (written by dev, read by reviewer)
- `DECISIONS.md` — dev-agent's architectural decisions (written by dev, read by reviewer)
- `REVIEW_FEEDBACK.md` — reviewer's feedback (written by reviewer, read by dev)

**Shared worktree convention**: `../<project-name>-dev/` on a `feature/plan-<name>` branch.

The two extensions share ~60% of their codebase (types, parsers, writers, AI providers, git operations). Where modules are identical, the plan marks them as **Adapt from smart-reviewer** — copy the module and adjust namespace/config references. Where modules differ (chat handler, system prompt, git writes), the plan specifies new code.

### Tech Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: VSCode Extension Host (Node.js)
- **Build**: `tsc` → `out/`
- **AI SDKs**: `@anthropic-ai/sdk` (^0.30.0), `openai` (^4.52.0)
- **VSCode API**: Chat Participants API, Language Model API (requires VSCode ^1.90.0), TreeView, SecretStorage
- **Package**: `vsce package` → `.vsix`

### Conventions

Follow the same conventions as smart-reviewer:
- **File organization**: `src/<module>/<file>.ts` — group by domain (ai, parsers, writers, providers, prompts)
- **Naming**: camelCase for files and variables, PascalCase for classes and interfaces
- **JSDoc**: Every exported function and interface has a JSDoc comment
- **Section comments**: Use `// ─── Section ───` dividers for readability
- **Imports**: Node builtins first, then VSCode, then local modules
- **Error handling**: try/catch with undefined returns (no thrown exceptions for expected failures)
- **Git operations**: `child_process.spawnSync` — no shell execution, direct git calls only

### References

- Smart Reviewer source: `../smart-reviewer/src/` — the canonical reference for shared modules
- VSCode Chat API: https://code.visualstudio.com/api/extension-guides/chat
- VSCode Language Model API: https://code.visualstudio.com/api/extension-guides/language-model
- Smart Reviewer `package.json`: extension manifest conventions and settings patterns

---

## Step 1: Extension Scaffold and Types

**Goal:** Set up the VSCode extension project structure with manifest, build config, and shared types — the foundation everything else builds on.

### Requirements

- Create `package.json` with extension manifest (name, publisher, engines, activation events, contributions)
- Create `tsconfig.json` matching smart-reviewer's config (target ES2022, module commonjs, strict, declaration + sourcemaps)
- Create `.vscodeignore` matching smart-reviewer's exclusion patterns
- Create `.gitignore` excluding `node_modules/`, `out/`, `*.vsix`
- Create entry point `src/extension.ts` with `activate()` (logs activation) and `deactivate()`
- Create `media/icon.svg` — a code/terminal icon (can be a copy or adaptation of smart-reviewer's)
- Define all shared types in `src/types.ts`

### Implementation Notes

**Package.json** should be adapted from `../smart-reviewer/package.json` with these changes:
- `name`: `smart-developer`
- `displayName`: `Smart Developer`
- Use `smart-developer` namespace for all config keys, command IDs, and view IDs
- Include `chatParticipants` with commands: `implement`, `commit`, `feedback`, `status`
- Include `configuration` section with all settings listed below
- `engines.vscode` must be `"^1.90.0"` (required for Language Model API)

**Types** — Adapt `../smart-reviewer/src/types.ts` and ADD these dev-agent-specific types:

```typescript
/** A single file change produced by the AI. */
export interface FileChange {
    /** Relative path within the worktree (e.g., "src/ai/provider.ts") */
    filePath: string;
    /** Whether this is a new file or an edit */
    action: 'create' | 'edit';
    /** Full file content to write */
    content: string;
}

/** A decision entry to append to DECISIONS.md. */
export interface DecisionEntry {
    /** Short decision description */
    decision: string;
    /** Why this decision was needed */
    context: string;
    /** Why this approach was chosen */
    rationale: string;
}

/** The AI's structured response for a step implementation. */
export interface DevAction {
    /** Summary of what was implemented (shown to user for approval) */
    summary: string;
    /** File changes to apply */
    fileChanges: FileChange[];
    /** Content for DEV_NOTES.md */
    devNotesContent: string;
    /** Decisions to append to DECISIONS.md (may be empty) */
    decisions: DecisionEntry[];
}

/** The full context assembled for an AI prompt. */
export interface DevContext {
    /** Current step section from PLAN.md */
    planContent: string;
    /** PROGRESS.md content */
    progressState: string;
    /** DECISIONS.md content */
    pastDecisions: string;
    /** REVIEW_FEEDBACK.md content (if exists, for iteration > 1) */
    reviewFeedback?: string;
    /** File tree of the worktree */
    projectStructure: string;
    /** Detected language/framework info */
    languageFramework: string;
    /** Key existing files the AI needs to see (path → content) */
    existingFiles: Map<string, string>;
}
```

**Settings** to declare in `package.json` contributes.configuration:
- `smart-developer.aiProvider` — enum: `copilot` | `anthropic` | `openai` (default: `copilot`)
- `smart-developer.anthropicModel` — string (default: `claude-sonnet-4-20250514`)
- `smart-developer.anthropicBaseUrl` — string (default: `""`, leave empty for default)
- `smart-developer.openaiModel` — string (default: `gpt-4o`)
- `smart-developer.openaiBaseUrl` — string (default: `""`, leave empty for default)

Note: API keys are NOT in settings — they use `vscode.SecretStorage`. The extension prompts for keys on first use if a non-Copilot provider is selected.

**Chat participant commands** to declare in `package.json` contributes.chatParticipants:
- `/implement [step]` — Implement a plan step (e.g., `/implement 2`)
- `/commit` — Review diff and commit changes
- `/feedback` — Address REVIEW_FEEDBACK.md issues
- `/status` — Show current workflow status

**Commands** to declare in `package.json` contributes.commands:
- `smart-developer.startStep` — Opens chat with `/implement`
- `smart-developer.commitStep` — Opens chat with `/commit`
- `smart-developer.addressFeedback` — Opens chat with `/feedback`
- `smart-developer.openWorktree` — Opens dev worktree folder in VSCode
- `smart-developer.refresh` — Refreshes sidebar from disk
- `smart-developer.settings` — Opens extension settings

### Files to Create

- `package.json` — Extension manifest (adapt from smart-reviewer)
- `tsconfig.json` — TypeScript config (copy from smart-reviewer)
- `.vscodeignore` — Packaging exclusions (copy from smart-reviewer)
- `.gitignore` — Git exclusions (add `node_modules/`, `out/`, `*.vsix`)
- `src/extension.ts` — Entry point with activate/deactivate stubs
- `src/types.ts` — All types (adapt from smart-reviewer + add DevAction, FileChange, DecisionEntry, DevContext)
- `media/icon.svg` — Extension icon

### Acceptance Criteria

- [ ] `npm install` completes without errors
- [ ] `npm run compile` (tsc) produces no errors and outputs to `out/`
- [ ] Extension activates in VSCode Extension Development Host (check console log)
- [ ] `@smart-developer` chat participant appears in chat UI
- [ ] All commands appear in Command Palette (search "Smart Developer")
- [ ] All settings appear in Settings UI (search "smart-developer")
- [ ] `src/types.ts` exports: StepStatus, Step, Plan, Progress, ProgressStepEntry, ProgressLastAction, WorktreeInfo, ReviewFeedback, ChangesRequiredItem, Decision, FileChange, DecisionEntry, DevAction, DevContext
- [ ] `package.json` declares 4 chat commands, 6 palette commands, 6 settings

### Dev-Agent Decisions

- Icon design (can copy/adapt smart-reviewer's icon or create a new one)
- Exact description text for commands and settings
- Whether to include `@types/node` in devDependencies

---

## Step 2: AI Provider Abstraction

**Goal:** Create the AI provider layer — a common interface with three implementations (Copilot, Anthropic, OpenAI) and a factory to select the right one.

### Requirements

- Define `AiProvider`, `AiMessage`, `AiResponse`, `AiChatOptions` interfaces
- Implement `CopilotProvider` using VSCode Language Model API
- Implement `AnthropicProvider` using `@anthropic-ai/sdk`
- Implement `OpenAIProvider` using `openai` npm package
- Implement `ProviderFactory` that reads settings and returns the correct provider
- All providers must support both `chat()` (full response) and `stream()` (chunked response)

### Implementation Notes

**Adapt from smart-reviewer**: Copy these four files from `../smart-reviewer/src/ai/` and adjust:
- `provider.ts` → identical (shared interface)
- `copilotProvider.ts` → identical (uses VSCode LM API, no namespace coupling)
- `anthropicProvider.ts` → change config namespace from `smart-reviewer` to `smart-developer`
- `openaiProvider.ts` → change config namespace from `smart-reviewer` to `smart-developer`
- `providerFactory.ts` → change config namespace, error messages, and API key names

The smart-reviewer implementations are well-tested. Focus on the namespace changes. Do NOT rewrite from scratch.

### Files to Create

- `src/ai/provider.ts` — Interfaces (copy from smart-reviewer)
- `src/ai/copilotProvider.ts` — Copilot implementation (copy from smart-reviewer)
- `src/ai/anthropicProvider.ts` — Anthropic implementation (adapt config namespace)
- `src/ai/openaiProvider.ts` — OpenAI implementation (adapt config namespace)
- `src/ai/providerFactory.ts` — Factory (adapt config namespace and error messages)

### Acceptance Criteria

- [ ] All five files compile without errors
- [ ] `ProviderFactory.create(secretStorage)` returns the correct provider based on `smart-developer.aiProvider` setting
- [ ] Missing API key for Anthropic/OpenAI throws a clear error message mentioning the extension name "Smart Developer"
- [ ] Copilot provider gracefully handles case where no models are available (throws descriptive error)

### Dev-Agent Decisions

- Minor code style adjustments during copy

---

## Step 3: Parsers

**Goal:** Implement all markdown file parsers needed to read shared state files.

### Requirements

- `planParser.ts` — parse PLAN.md into `Plan` with `Step[]`
- `progressParser.ts` — parse PROGRESS.md into `Progress`
- `devNotesParser.ts` — parse DEV_NOTES.md into structured `DevNotes`
- `reviewFeedbackParser.ts` — parse REVIEW_FEEDBACK.md into `ReviewFeedback`
- `decisionsParser.ts` — parse DECISIONS.md into `Decision[]`

### Implementation Notes

**Adapt from smart-reviewer**: All five parsers are identical between the two extensions. Copy from `../smart-reviewer/src/parsers/` without changes. These parsers read a shared file format — they must parse identically or the extensions will disagree on state.

Files to copy verbatim:
- `planParser.ts` — parse `##` headings as steps, `findPlanFile()` with breadth-first recursive search
- `progressParser.ts` — parse emoji status table, metadata, Last Action section
- `devNotesParser.ts` — parse sections (what was implemented, files changed, decisions, questions, feedback addressed/disputed)
- `reviewFeedbackParser.ts` — parse review feedback format (summary, approved items, changes required, suggestions, questions, iteration/status)
- `decisionsParser.ts` — parse decision entries with context/rationale/date

### Files to Create

- `src/parsers/planParser.ts` — Copy from smart-reviewer
- `src/parsers/progressParser.ts` — Copy from smart-reviewer
- `src/parsers/devNotesParser.ts` — Copy from smart-reviewer
- `src/parsers/reviewFeedbackParser.ts` — Copy from smart-reviewer
- `src/parsers/decisionsParser.ts` — Copy from smart-reviewer

### Acceptance Criteria

- [ ] All five parsers compile without errors
- [ ] `parsePlan` correctly identifies `##` headings as steps and extracts content between them
- [ ] `findPlanFile` finds `PLAN.md` at root and in subdirectories up to configurable depth
- [ ] `parseProgress` correctly parses emoji status (⏳/🔄/✅), iteration N/5, and commit hashes
- [ ] `parseReviewFeedback` correctly parses APPROVED/CHANGES_REQUIRED status and changes required items
- [ ] `parseDevNotes` extracts all sections including feedback addressed and feedback disputed
- [ ] `parseDecisions` extracts decision entries with step, context, rationale, and date
- [ ] All parsers return `undefined` or `[]` for missing/unparseable files (no thrown exceptions)

### Dev-Agent Decisions

- Whether to add additional parser tests beyond what smart-reviewer has

---

## Step 4: Markdown File Writers

**Goal:** Implement writers for DEV_NOTES.md, DECISIONS.md, and PROGRESS.md.

### Requirements

- `progressWriter.ts` — write PROGRESS.md with status table and metadata; update individual steps and last action
- `devNotesWriter.ts` — write DEV_NOTES.md from AI-generated content
- `decisionsWriter.ts` — append decision entries to DECISIONS.md (never overwrite)

### Implementation Notes

**Adapt from smart-reviewer**: `progressWriter.ts` is identical — copy from `../smart-reviewer/src/writers/progressWriter.ts` without changes. The writer and parser must agree on the exact format.

**New code**: `devNotesWriter.ts` and `decisionsWriter.ts` are dev-agent-specific (the reviewer doesn't write these files). Write them to produce the format that the parsers (Step 3) expect.

DEV_NOTES.md format (must match what `parseDevNotes` expects):
```markdown
# DEV_NOTES — Step N: [Step Title]

## What was implemented
- [item 1]
- [item 2]

## Files changed
- path/to/file1.ts — description
- path/to/file2.ts — description

## Decisions made
- **Decision name**: rationale

## Questions for reviewer
- question

## Review feedback addressed
- [items from REVIEW_FEEDBACK.md that were fixed]

## Review feedback respectfully disputed
- [items the dev-agent disagrees with, with reasoning]
```

DECISIONS.md format (must match what `parseDecisions` expects):
```markdown
# Decisions Log — plan-name

## Step N: Step Title
- **Decision**: description
  - **Context**: why this decision was needed
  - **Rationale**: why this approach was chosen
  - **Date**: YYYY-MM-DD
```

### Files to Create

- `src/writers/progressWriter.ts` — Copy from smart-reviewer
- `src/writers/devNotesWriter.ts` — New code (write DEV_NOTES format)
- `src/writers/decisionsWriter.ts` — New code (append decisions format)

### Acceptance Criteria

- [ ] All three writers compile without errors
- [ ] `writeProgress` produces output that `parseProgress` can round-trip parse correctly
- [ ] `writeDevNotes` produces output that `parseDevNotes` can parse correctly
- [ ] `appendDecision` appends without overwriting existing decisions
- [ ] `updateProgressStep` returns a new Progress with only the specified step changed
- [ ] `updateLastAction` returns a new Progress with updated lastAction

### Dev-Agent Decisions

- How to generate the step title and number in DEV_NOTES.md heading
- Whether to add timestamps to DEV_NOTES.md entries

---

## Step 5: Git Operations

**Goal:** Implement all git operations — both read-only (shared with reviewer) and write operations (dev-agent only).

### Requirements

- All read-only git operations from smart-reviewer (get project root, find worktree, get diffs, guess base branch)
- Write operations: create worktree, commit, check for uncommitted changes, remove worktree
- Idempotent worktree creation (returns existing if present)
- Conventional commit messages with step metadata

### Implementation Notes

**Adapt from smart-reviewer**: Copy `../smart-reviewer/src/git.ts` as the base, then ADD the write operations.

Read-only functions to copy:
- `getProjectRoot(dir)` → `string | undefined`
- `getProjectName(projectRoot)` → `string`
- `findDevWorktree(projectRoot)` → `WorktreeInfo`
- `getDiff(dir, base?)` → `string`
- `getLatestDiff(dir)` → `string`
- `guessBaseBranch(dir)` → `string`
- `getCurrentBranch(dir)` → `string`
- `getLatestCommit(dir)` → `string`
- Internal helpers: `execGit()`, `isDirectory()`

Write functions to ADD:

```typescript
/**
 * Create a dev worktree at ../<projectName>-dev/ on a feature branch.
 * Idempotent — returns existing worktree info if it already exists.
 *
 * Steps:
 * 1. Check if worktree directory already exists → return WorktreeInfo
 * 2. Create branch: git branch feature/plan-<planName> (from base)
 * 3. Add worktree: git worktree add <path> feature/plan-<planName>
 * 4. Return WorktreeInfo
 *
 * Error handling:
 * - If branch already exists: just add worktree pointing to existing branch
 * - If worktree add fails: throw with clear message
 */
export function createDevWorktree(projectRoot: string, planName: string): WorktreeInfo;

/**
 * Check for uncommitted changes in a directory.
 */
export function hasUncommittedChanges(dir: string): boolean;

/**
 * Stage all changes and commit with a conventional commit message.
 * Returns the short commit hash.
 *
 * Commit message format:
 *   feat(<plan>): step N - <step title>
 *
 * Or if iterating:
 *   fix(<plan>): step N iter M - address review feedback
 */
export function commitChanges(dir: string, message: string): string;

/**
 * Remove a git worktree (cleanup at end of plan).
 */
export function removeWorktree(projectRoot: string, worktreePath: string): void;
```

### Files to Create

- `src/git.ts` — Copy read operations from smart-reviewer, add write operations

### Acceptance Criteria

- [ ] All read-only functions work identically to smart-reviewer
- [ ] `createDevWorktree` creates a worktree at `../<name>-dev/` on a `feature/plan-<name>` branch
- [ ] `createDevWorktree` is idempotent — returns existing worktree if already created
- [ ] `hasUncommittedChanges` returns `true` when there are staged or unstaged changes
- [ ] `commitChanges` stages all changes, commits, and returns a 7-char commit hash
- [ ] `removeWorktree` cleans up the worktree without errors
- [ ] All git operations use `spawnSync` with no shell execution
- [ ] All git operations have a 30-second timeout and 10MB max buffer

### Dev-Agent Decisions

- Exact commit message format details
- Whether to support custom branch naming conventions

---

## Step 6: System Prompt and Context Builder

**Goal:** Build the system prompt that instructs the AI how to act as a dev-agent, and the context builder that assembles all the information the AI needs.

### Requirements

- Define the AI output format as a structured, parseable contract
- Build the system prompt dynamically with plan context, progress state, past decisions, and review feedback
- Detect project language/framework from common config files
- Build a file tree of the worktree
- Read key existing files referenced by the current step

### Implementation Notes

**Adapt the pattern from** `../smart-reviewer/src/prompts/reviewSystemPrompt.ts` and `../smart-reviewer/src/contextBuilder.ts`, but build a dev-agent-specific version.

**AI OUTPUT FORMAT** — This is the most critical interface in the system. The AI must produce output in this exact format so the File Applier can parse it:

```
<dev-response>
<summary>
[Brief summary of what was implemented for human review]
</summary>

<file-change path="relative/path/to/file.ts" action="create">
[Complete file content here]
</file-change>

<file-change path="relative/path/to/existing.ts" action="edit">
[Complete file content here - full replacement, not a diff]
</file-change>

<dev-notes>
[DEV_NOTES.md content in the exact format specified in Step 4]
</dev-notes>

<decision context="why needed" rationale="why this approach">
[Decision description]
</decision>
</dev-response>
```

Key design decisions for the output format:
- Uses XML tags (not markdown fences) for reliable parsing
- File content is a full replacement (not a diff) — simpler and more reliable
- `<dev-response>` wraps everything so the parser knows the boundaries
- Multiple `<file-change>` and `<decision>` elements are allowed
- `<dev-notes>` contains the full DEV_NOTES.md content
- The AI is instructed to ONLY output content within `<dev-response>` tags

**System prompt sections** (adapt the reviewer's pattern):
1. Role definition: "You are a dev-agent implementing code from PLAN.md"
2. Core rules: Only implement the current step, follow project conventions, stay within boundaries, output in the exact XML format
3. Output format specification (with the XML template above)
4. Dynamic context injected at prompt-build time (plan step, progress, decisions, review feedback, file tree, existing files, language/framework detection)

**Context builder** (`src/contextBuilder.ts`):
- Adapt from smart-reviewer's `contextBuilder.ts` but for dev-agent context
- Detect language: check for `package.json` (JS/TS), `Cargo.toml` (Rust), `pyproject.toml` (Python), `go.mod` (Go), etc.
- Build file tree: `fs.readdirSync` recursive to depth 4, skipping `node_modules`, `.git`, `out`, `dist`
- Read key files: if the step mentions specific file paths, read their content into `existingFiles`
- Format all context into the `DevContext` interface from Step 1

### Files to Create

- `src/prompts/devSystemPrompt.ts` — New code (system prompt builder + DevPromptContext interface)
- `src/contextBuilder.ts` — Adapt from smart-reviewer's contextBuilder, add language detection and file tree

### Acceptance Criteria

- [ ] Both files compile without errors
- [ ] `buildDevSystemPrompt(context)` returns a complete system prompt string
- [ ] System prompt includes the exact XML output format template
- [ ] System prompt includes the current step content from PLAN.md
- [ ] Context builder detects language from project config files
- [ ] Context builder builds a file tree excluding `node_modules`, `.git`, `out`, `dist`
- [ ] Context builder reads existing files referenced in the step content
- [ ] When REVIEW_FEEDBACK.md exists, its content is included in context for iteration > 1

### Dev-Agent Decisions

- Exact wording of the system prompt role definition
- Which directories to skip in file tree building
- Maximum depth for file tree and maximum number of existing files to include

---

## Step 7: File Applier

**Goal:** Parse the AI's structured XML output and apply file changes to the worktree.

### Requirements

- Parse `<dev-response>` XML blocks from AI output
- Extract `<file-change>` elements with path, action, and content
- Extract `<dev-notes>` and `<decision>` elements
- Create directories as needed and write files to the worktree
- Return a structured `DevAction` with all parsed components
- Never auto-commit — always wait for user approval

### Implementation Notes

Use a simple XML parser approach (regex-based extraction is fine since the format is constrained and controlled by the system prompt). Do NOT use a full XML parser library — the format is simple enough.

Parsing strategy:
1. Extract content between `<dev-response>` and `</dev-response>`
2. Extract `<summary>...</summary>` → DevAction.summary
3. Extract all `<file-change path="..." action="...">...</file-change>` → DevAction.fileChanges[]
4. Extract `<dev-notes>...</dev-notes>` → DevAction.devNotesContent
5. Extract all `<decision context="..." rationale="...">...</decision>` → DevAction.decisions[]

Error handling:
- If `<dev-response>` not found: return undefined and show error in chat ("AI did not produce structured output")
- If a file-change has no path: skip it and log a warning
- If content is empty: still create the file (it might be intentional)

### Files to Create

- `src/fileApplier.ts` — New code (parse XML output, apply file changes)

### Acceptance Criteria

- [ ] `parseDevResponse(aiText)` returns a `DevAction` or `undefined` for unparseable output
- [ ] File changes with relative paths are correctly written to the worktree
- [ ] Directories are created automatically (`mkdirSync recursive`) if they don't exist
- [ ] `applyFileChanges(worktreeDir, fileChanges)` creates/writes all files
- [ ] Returns a summary of applied changes (file count, paths)
- [ ] Handles missing `<dev-response>` gracefully (returns undefined, no crash)
- [ ] Handles empty `<file-change>` content gracefully (creates empty file)
- [ ] Does NOT auto-commit or modify PROGRESS.md

### Dev-Agent Decisions

- Exact regex patterns for XML parsing
- Whether to show a confirmation dialog before applying changes (recommended: show summary but auto-apply, since user approves at commit time)

---

## Step 8: Sidebar TreeView

**Goal:** Build the sidebar tree view showing plan state, worktree info, step statuses, and associated files.

### Requirements

- Show plan name and branch in a collapsible section
- Show worktree path and status in a collapsible section
- Show current step with status and iteration
- Show all steps with status icons (⏳/🔄/✅)
- Show associated files (DEV_NOTES.md, DECISIONS.md, REVIEW_FEEDBACK.md) as clickable items
- Clicking a step opens PLAN.md in the editor
- File watchers trigger automatic tree refresh

### Implementation Notes

**Adapt from smart-reviewer**: Copy `../smart-reviewer/src/providers/reviewTreeProvider.ts` and adjust:

Layout (consistent with smart-reviewer's pattern):
```
📋 Plan: my-feature (feature/plan-my-feature)
  Branch: feature/plan-my-feature
  Created: 2025-01-15
📍 Worktree: ../my-project-dev
  Path: /full/path/to/worktree
  Branch: feature/plan-my-feature
📌 Current: Step 2: Build API (🔄 In Progress — iter 2/5)
  Last: dev-agent — "Implemented API routes"
  Time: 2025-01-15 14:30
📂 Dev Files
  📝 DEV_NOTES.md — 5 files, 2 decisions
  📋 DECISIONS.md — 3 decisions
  🔍 REVIEW_FEEDBACK.md — ❌ 3 issues
📂 All Steps
  ⏳ Step 1: Setup Auth
  🔄 Step 2: Build API                     abc1234
  ⏳ Step 3: Frontend
```

Changes from smart-reviewer's tree:
- Rename "Review Files" → "Dev Files"
- Keep the same collapsible structure with plan, worktree, current step, files, and all steps sections
- Use the same `ReviewTreeItem` pattern (just rename the class to `StepTreeItem`)
- Same icon mapping: plan → notebook, worktree → root-folder, currentStep → pin, file → file-text, etc.

### Files to Create

- `src/providers/stepTreeProvider.ts` — Adapt from smart-reviewer's reviewTreeProvider.ts

### Acceptance Criteria

- [ ] Tree view appears in the Smart Developer activity bar panel
- [ ] Plan info shows plan name and branch
- [ ] Worktree section shows path and branch (or "Not found" if missing)
- [ ] Current step shows with status icon and iteration count
- [ ] Dev Files section shows DEV_NOTES.md, DECISIONS.md, REVIEW_FEEDBACK.md if they exist
- [ ] All Steps section shows every step with correct status icon
- [ ] Clicking a file item opens it in the editor
- [ ] Clicking a step item opens PLAN.md in the editor
- [ ] File changes to PLAN.md, PROGRESS.md, DEV_NOTES.md, DECISIONS.md, REVIEW_FEEDBACK.md trigger tree refresh
- [ ] Tree shows "No plan found" message when no PLAN.md in workspace

### Dev-Agent Decisions

- Exact label formatting for tree items
- Whether to show file size or line count in dev file items

---

## Step 9: Diff Viewer

**Goal:** Provide diff viewing utilities for showing code changes in the chat and in dedicated editor tabs.

### Requirements

- Get the appropriate diff for a step based on iteration (full diff for iter 1, latest commit only for iter > 1)
- Open diff content in a syntax-highlighted editor tab
- Display diffs in the chat panel

### Implementation Notes

**Adapt from smart-reviewer**: Copy `../smart-reviewer/src/diffViewer.ts` without changes. The functions are:
- `getDiffForStep(worktreeDir, iteration)` — full diff for first iteration, latest-only for subsequent
- `openDiffEditor(diffContent, title)` — opens diff in an untitled document with `language: 'diff'`

### Files to Create

- `src/diffViewer.ts` — Copy from smart-reviewer

### Acceptance Criteria

- [ ] File compiles without errors
- [ ] `getDiffForStep` returns full diff when iteration is 0 or 1
- [ ] `getDiffForStep` returns latest diff (HEAD~1 vs HEAD) when iteration > 1
- [ ] `openDiffEditor` opens a new editor tab with diff syntax highlighting

### Dev-Agent Decisions

- None (copy verbatim)

---

## Step 10: Chat Handler — Implement Step Flow

**Goal:** Implement the core `/implement` command that drives AI to implement a plan step — from reading context to applying code changes.

### Requirements

- Handle the `/implement [step]` chat command
- Parse PLAN.md and determine which step to implement
- Build full AI context (plan step, progress, decisions, review feedback, file tree, existing files)
- Send to AI with streaming response displayed in chat
- Parse AI response into `DevAction` using the File Applier
- Apply file changes to the worktree
- Write DEV_NOTES.md and append to DECISIONS.md
- Show summary to user and prompt for commit approval

### Implementation Notes

This is the primary workflow. Structure as a single async function `handleImplement` called from the main chat handler.

Flow:
1. Validate: PLAN.md exists, determine step number (from argument or current in-progress step)
2. Read context: parse plan, progress, decisions, review feedback (if iteration > 1)
3. Ensure worktree exists: call `createDevWorktree()` if not yet created
4. Build context: call context builder to assemble all context
5. Build system prompt: call `buildDevSystemPrompt(context)`
6. Stream to AI: call `provider.stream()` with system prompt + user message, display chunks in chat
7. Parse response: call `parseDevResponse(aiText)` from fileApplier
8. If parse fails: show error in chat with raw AI output, ask user to retry
9. Apply changes: call `applyFileChanges(worktreeDir, devAction.fileChanges)`
10. Write DEV_NOTES.md: call `writeDevNotes()` with `devAction.devNotesContent`
11. Append decisions: for each `devAction.decisions[]`, call `appendDecision()`
12. Show summary: display `devAction.summary` in chat
13. Show diff: call `getDiffForStep(worktreeDir, iteration)` and display in chat
14. Prompt user: ask "Apply these changes?" with "Commit" / "Revise" / "Discard" options
15. If "Commit": transition to commit flow (Step 11 handles this)
16. If "Discard": clean up changes (`git checkout .` in worktree)

Error handling:
- No PLAN.md → show warning in chat
- No worktree and can't create → show error with instructions
- AI output unparseable → show raw output and suggest retry
- AI provider throws (no API key, network error) → show clear error in chat

### Files to Create

- `src/chat/devChatHandler.ts` — New code (main chat handler with `/implement` flow)

### Acceptance Criteria

- [ ] `/implement 2` in chat starts implementing Step 2
- [ ] `/implement` with no argument implements the current in-progress step (or prompts to pick one)
- [ ] AI response streams in the chat panel in real-time
- [ ] File changes are written to the worktree (not the main project)
- [ ] DEV_NOTES.md is written with correct step title and content
- [ ] DECISIONS.md entries are appended (not overwritten)
- [ ] Summary and diff are shown to user before any commit
- [ ] "Discard" option reverts all changes in the worktree
- [ ] Error cases (no plan, no worktree, parse failure) show clear messages in chat
- [ ] PROGRESS.md is NOT modified until the commit step (Step 11)

### Dev-Agent Decisions

- How to prompt the user to pick a step when none is specified (dropdown vs. chat prompt)
- Whether to show the diff inline in chat or open a separate editor tab

---

## Step 11: Chat Handler — Commit and Address Feedback Flows

**Goal:** Implement the `/commit` command (review diff, approve, commit, update progress) and the `/feedback` command (address reviewer feedback).

### Requirements

- `/commit` command: show diff, ask for approval, commit with conventional message, update PROGRESS.md
- `/feedback` command: read REVIEW_FEEDBACK.md, build prompt with feedback context, AI addresses issues, apply fixes
- `/status` command: show current plan state, step statuses, worktree info

### Implementation Notes

**`/commit` flow** (add to `devChatHandler.ts`):
1. Validate: worktree exists, has uncommitted changes
2. Show `git diff` in chat (or open in diff editor)
3. Ask user to confirm: "Commit these changes?" → "Commit" / "Cancel"
4. Generate commit message: `feat(<plan>): step N - <step title>` or `fix(<plan>): step N iter M - address review feedback`
5. Call `commitChanges(worktreeDir, message)` → get commit hash
6. Update PROGRESS.md: mark step as In Progress (or keep status), set iteration, set lastCommit, update lastAction
7. Show confirmation in chat with commit hash

**`/feedback` flow** (add to `devChatHandler.ts`):
1. Validate: REVIEW_FEEDBACK.md exists in plan root
2. Parse feedback: call `parseReviewFeedback()`
3. If feedback is APPROVED: show message, offer to mark step Complete
4. If CHANGES_REQUIRED: build context with feedback included, run through implement flow (reuses Steps 10's logic)
5. The system prompt already handles iteration > 1 by including REVIEW_FEEDBACK.md in context

**`/status` flow** (add to `devChatHandler.ts`):
1. Parse plan and progress
2. Show formatted status table in chat (mirroring the reviewer's `/status` output)
3. Show worktree info and last action

### Files to Modify

- `src/chat/devChatHandler.ts` — Add commit, feedback, and status handlers

### Acceptance Criteria

- [ ] `/commit` shows the current diff in chat
- [ ] `/commit` asks for user confirmation before committing
- [ ] On commit: PROGRESS.md is updated with new commit hash, iteration, and lastAction
- [ ] Commit message follows conventional format: `feat(<plan>): step N - <title>`
- [ ] `/feedback` reads REVIEW_FEEDBACK.md and shows the review status
- [ ] For CHANGES_REQUIRED: AI generates fixes addressing each feedback item
- [ ] For APPROVED: user is offered to mark step as Complete
- [ ] `/status` shows plan name, branch, worktree, all step statuses, and last action
- [ ] `/status` with no plan shows "No plan found" message

### Dev-Agent Decisions

- Whether to open the diff in chat or in a separate editor tab
- Whether to auto-detect if feedback has been addressed or rely on the AI

---

## Step 12: Extension Activation Wiring

**Goal:** Wire everything together in the extension entry point — register chat participant, commands, tree view, file watchers, and SecretStorage.

### Requirements

- Register `@smart-developer` chat participant with all four commands
- Register all six palette commands
- Register TreeView with the step tree provider
- Register file watchers for all five shared state files
- Initialize SecretStorage for API keys
- On activation: scan workspace for PLAN.md, find worktree, populate sidebar
- Handle workspace folder changes (re-detect plan root)

### Implementation Notes

**Adapt from smart-reviewer**: Use `../smart-reviewer/src/extension.ts` as the structural template. The pattern is identical — swap namespaces.

Key activation steps:
1. `detectPlanRoot()` — find PLAN.md in workspace folders (reuses `findPlanFile`)
2. Create `StepTreeProvider`, set plan root, register TreeView
3. Create chat participant with handler function
4. Register commands (most delegate to chat via `workbench.action.chat.open`)
5. Register file watchers for `**/PLAN.md`, `**/PROGRESS.md`, etc.
6. Register `onDidChangeWorkspaceFolders` handler

**SecretStorage flow** (not in smart-reviewer — add this):
- On first AI provider call, if provider is anthropic/openai and key is missing:
  - Show input dialog: "Enter your Anthropic/OpenAI API key"
  - Store via `context.secrets.store('anthropicApiKey', key)`
  - Retrieve via `context.secrets.get('anthropicApiKey')`
- Add a command `smart-developer.setApiKey` to update keys manually

### Files to Modify

- `src/extension.ts` — Expand from stub to full activation wiring

### Acceptance Criteria

- [ ] Extension activates on startup (`onStartupFinished`)
- [ ] Chat participant `@smart-developer` is available with `/implement`, `/commit`, `/feedback`, `/status` commands
- [ ] Sidebar TreeView shows plan state after activation
- [ ] All six palette commands are registered and functional
- [ ] File watchers trigger sidebar refresh on any shared state file change
- [ ] Changing workspace folders re-detects plan root
- [ `SecretStorage` prompts for API key when needed (non-Copilot provider selected)
- [ ] `smart-developer.setApiKey` command allows updating stored API keys
- [ ] Extension deactivates cleanly (no dangling watchers or listeners)

### Dev-Agent Decisions

- Whether to prompt for API key proactively on activation or wait until first AI call
- Whether to validate API key format before storing

---

## Step 13: Testing and Packaging

**Goal:** Verify the complete extension works end-to-end and package it as a `.vsix` file.

### Requirements

- TypeScript compilation with zero errors
- Extension loads and activates in Extension Development Host
- End-to-end test: implement a step, commit, verify state files
- All three AI providers can be selected and used
- Package as `.vsix`

### Implementation Notes

**Compilation**: Run `npm run compile` (tsc) and verify zero errors.

**Manual test scenarios** (perform in order):

1. **Activation**: Open a workspace with a `PLAN.md` file → verify sidebar populates, `@smart-developer` appears in chat
2. **Status**: Type `/status` in chat → verify plan info, step statuses, worktree info shown
3. **Implement (Copilot)**: Set provider to Copilot, type `/implement 1` → verify AI streams response, files are written to worktree, DEV_NOTES.md and DECISIONS.md created
4. **Commit**: Type `/commit` → verify diff shown, user approval prompt, commit hash returned, PROGRESS.md updated
5. **Feedback loop**: Create a mock `REVIEW_FEEDBACK.md` with CHANGES_REQUIRED, type `/feedback` → verify AI addresses feedback
6. **Implement (Anthropic)**: Switch provider to Anthropic, set API key, repeat implement → verify works
7. **Implement (OpenAI)**: Switch provider to OpenAI, set API key, repeat implement → verify works
8. **Sidebar refresh**: Modify PROGRESS.md externally → verify sidebar updates automatically
9. **Error cases**: Test with no PLAN.md, no worktree, invalid step number → verify clear error messages
10. **Packaging**: Run `npx vsce package` → verify `.vsix` file is produced

### Files to Modify

- None (testing only)

### Acceptance Criteria

- [ ] `npm run compile` produces zero errors and zero warnings
- [ ] Extension activates in Extension Development Host without errors
- [ ] `/status` displays correct plan state
- [ ] `/implement` with Copilot provider works end-to-end (AI response → file changes → DEV_NOTES → DECISIONS → commit)
- [ ] `/implement` with Anthropic provider works (after setting API key)
- [ ] `/implement` with OpenAI provider works (after setting API key)
- [ ] `/commit` updates PROGRESS.md with correct commit hash, iteration, and last action
- [ ] `/feedback` reads and addresses REVIEW_FEEDBACK.md issues
- [ ] Error cases show clear messages (no unhandled exceptions)
- [ ] `npx vsce package` produces a `.vsix` file under 5MB
- [ ] All shared state files (PROGRESS.md, DEV_NOTES.md, DECISIONS.md) match the format smart-reviewer expects

### User Verification

Before considering the extension complete, manually verify the full dev-agent ↔ review-agent cycle:
1. Use Smart Developer to implement a step → commit
2. Use Smart Reviewer to review the step → write REVIEW_FEEDBACK.md
3. Use Smart Developer `/feedback` to address the review → commit again
4. Verify both extensions agree on PROGRESS.md state

### Dev-Agent Decisions

- Whether to add automated tests (the plan uses manual testing for now)
- Test PLAN.md content to use for manual testing
