# Plan: Smart Developer VSCode Extension

## Overview

Build a VSCode extension that acts as an **AI dev-agent** — reading `PLAN.md`, implementing steps one at a time inside a git worktree, and committing with human approval. This extension depends on the **smart-team-common** shared package for types, parsers, writers, AI providers, and git operations.

## Context

### Existing System

**smart-team-common** (`../smart-team-common/`) provides all shared infrastructure:
- Types (`Step`, `Plan`, `Progress`, `ReviewFeedback`, `Decision`, `DevNotes`, etc.)
- AI providers (`CopilotProvider`, `AnthropicProvider`, `OpenAIProvider`, `ProviderFactory`)
- Parsers (`planParser`, `progressParser`, `devNotesParser`, `reviewFeedbackParser`, `decisionsParser`)
- Writers (`progressWriter`, `devNotesWriter`, `decisionsWriter`, `reviewFeedbackWriter`)
- Git operations (`gitRead` for all reads, `gitWrite` for dev-only writes)
- Diff viewer (`getDiffForStep`, `openDiffEditor`)

This extension adds:
- **Dev-agent system prompt** — instructs AI to implement code, defines XML output format
- **Context builder** — assembles file tree, language detection, existing files for AI context
- **File applier** — parses AI XML output and writes files to worktree
- **Chat handler** — `/implement`, `/commit`, `/feedback`, `/status` flows
- **Sidebar tree view** — dev-centric plan/worktree/step view
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

### Build Order

1. `smart-team-common` must be built first
2. Then `smart-developer` (this plan)

### References

- Common package plan: `../smart-team-common/PLAN.md`
- Smart Reviewer plan: `../smart-reviewer/PLAN.md`
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
- Create `media/icon.svg` — code/terminal icon
- Define dev-agent-specific types in `src/types.ts`

### Implementation Notes

**Package.json** contributions:

Activity Bar & Views:
- Activity bar container: `smart-developer` with code icon
- TreeView: `smart-developer-steps` — step list with status

Chat Participant:
- ID: `smart-developer`, name: `smart-developer`
- Description: "AI dev-agent that implements code from PLAN.md"
- `isSticky: true`
- Commands: `/implement [step]`, `/commit`, `/feedback`, `/status`

Palette Commands:
- `smart-developer.startStep` → opens chat with `/implement`
- `smart-developer.commitStep` → opens chat with `/commit`
- `smart-developer.addressFeedback` → opens chat with `/feedback`
- `smart-developer.openWorktree` → opens dev worktree folder
- `smart-developer.refresh` → refreshes sidebar
- `smart-developer.settings` → opens settings

Settings:
- `smart-developer.aiProvider` — enum: `copilot` | `anthropic` | `openai` (default: `copilot`)
- `smart-developer.planSearchMaxDepth` — number (default: 3, min: 0, max: 10)
- `smart-developer.anthropicBaseUrl` — string (default: `""`)
- `smart-developer.anthropicModel` — string (default: `claude-sonnet-4-20250514`)
- `smart-developer.openaiBaseUrl` — string (default: `""`)
- `smart-developer.openaiModel` — string (default: `gpt-4o`)

Dependencies:
- `"smart-team-common": "file:../smart-team-common"`
- `@anthropic-ai/sdk`: ^0.30.0, `openai`: ^4.52.0
- Dev: `@types/vscode` (^1.90.0), `@types/node` (^20.14.0), `typescript` (^5.5.0)

**Dev-agent-specific types** in `src/types.ts` (these are NOT in common — only the developer needs them):

```typescript
// Re-export all common types for convenience
export { StepStatus, Step, Plan, Progress, ProgressStepEntry, ProgressLastAction,
         WorktreeInfo, ReviewFeedback, ChangesRequiredItem, Decision, DevNotes,
         AiMessage, AiResponse, AiChatOptions, AiProvider } from 'smart-team-common';

/** A single file change produced by the AI. */
export interface FileChange {
    filePath: string;        // Relative path within worktree
    action: 'create' | 'edit';
    content: string;         // Full file content to write
}

/** A decision entry to append to DECISIONS.md. */
export interface DecisionEntry {
    decision: string;
    context: string;
    rationale: string;
}

/** The AI's structured response for a step implementation. */
export interface DevAction {
    summary: string;
    fileChanges: FileChange[];
    devNotesContent: string;
    decisions: DecisionEntry[];
}

/** The full context assembled for an AI prompt. */
export interface DevContext {
    planContent: string;
    progressState: string;
    pastDecisions: string;
    reviewFeedback?: string;
    projectStructure: string;
    languageFramework: string;
    existingFiles: Map<string, string>;
}
```

API keys use `vscode.SecretStorage` — not in settings. Prompt on first use.

### Files to Create

- `package.json`, `tsconfig.json`, `.vscodeignore`, `.gitignore`
- `src/extension.ts` — activate/deactivate stubs
- `src/types.ts` — Re-exports from common + dev-specific types
- `media/icon.svg`

### Acceptance Criteria

- [ ] `npm install` completes (links `smart-team-common` from `../`)
- [ ] `npm run compile` produces no errors
- [ ] Extension activates in Extension Development Host
- [ ] `@smart-developer` chat participant appears with 4 commands
- [ ] All 6 palette commands appear in Command Palette
- [ ] All 6 settings appear in Settings UI
- [ ] `src/types.ts` re-exports all common types AND defines FileChange, DecisionEntry, DevAction, DevContext

### Dev-Agent Decisions

- Icon design
- Exact description text for commands and settings

---

## Step 2: System Prompt

**Goal:** Build the system prompt that instructs the AI to act as a dev-agent, with the exact XML output format contract.

### Requirements

- Define the AI output format as a structured XML contract
- Build the system prompt dynamically with plan context
- Instruct the AI on its role, rules, and output format

### Implementation Notes

**AI OUTPUT FORMAT** — the most critical interface. The AI must produce:

```xml
<dev-response>
<summary>
[Brief summary of what was implemented]
</summary>

<file-change path="relative/path/to/file.ts" action="create">
[Complete file content]
</file-change>

<dev-notes>
[DEV_NOTES.md content in the exact format from common]
</dev-notes>

<decision context="why needed" rationale="why this approach">
[Decision description]
</decision>
</dev-response>
```

Key rules for the output format:
- Uses XML tags (not markdown fences) for reliable parsing
- File content is full replacement (not a diff)
- `<dev-response>` wraps everything
- Multiple `<file-change>` and `<decision>` elements allowed
- `<dev-notes>` contains full DEV_NOTES.md content
- AI outputs ONLY within `<dev-response>` tags

System prompt sections:
1. Role: "You are a dev-agent implementing code from PLAN.md"
2. Core rules: Only implement current step, follow conventions, stay within boundaries
3. Output format: the XML template above
4. Dynamic context (injected at build time): plan step, progress, decisions, review feedback, file tree, existing files

Build function: `buildDevSystemPrompt(context: DevContext): string`

### Files to Create

- `src/prompts/devSystemPrompt.ts` — System prompt builder

### Acceptance Criteria

- [ ] File compiles without errors
- [ ] `buildDevSystemPrompt(context)` returns a complete system prompt string
- [ ] System prompt includes the exact XML output format template
- [ ] System prompt includes role definition and core rules
- [ ] Dynamic context sections are included when provided

### Dev-Agent Decisions

- Exact wording of role definition and rules

---

## Step 3: Context Builder and File Applier

**Goal:** Build the context assembler (file tree, language detection, existing files) and the file applier (parses AI XML output, writes files to worktree).

### Requirements

- Detect project language/framework from config files
- Build file tree of the worktree
- Read key existing files referenced by the step
- Parse AI's XML response into structured `DevAction`
- Apply file changes to the worktree (create dirs, write files)
- Never auto-commit

### Implementation Notes

**Context builder** (`src/contextBuilder.ts`):
- `buildDevContext(planRoot, stepIndex, plan, progress, worktreeDir)` → `DevContext`
- Detect language: check for `package.json` (JS/TS), `Cargo.toml` (Rust), `pyproject.toml` (Python), `go.mod` (Go)
- Build file tree: `fs.readdirSync` recursive to depth 4, skip `node_modules`, `.git`, `out`, `dist`
- Read existing files: if the step mentions specific file paths, read their content
- Include REVIEW_FEEDBACK.md content if iteration > 1

**File applier** (`src/fileApplier.ts`):
- `parseDevResponse(aiText)` → `DevAction | undefined`
  - Extract content between `<dev-response>` and `</dev-response>`
  - Extract `<summary>`, all `<file-change>` elements, `<dev-notes>`, all `<decision>` elements
  - Return `undefined` if `<dev-response>` not found (unparseable output)
- `applyFileChanges(worktreeDir, fileChanges)` → `{ applied: number, paths: string[] }`
  - Create directories with `fs.mkdirSync recursive`
  - Write files to the worktree
  - Return summary of applied changes

### Files to Create

- `src/contextBuilder.ts` — Dev context assembly
- `src/fileApplier.ts` — XML parsing and file application

### Acceptance Criteria

- [ ] Both files compile without errors
- [ ] Context builder detects language from project config files
- [ ] Context builder builds file tree excluding common directories
- [ ] Context builder reads existing files referenced in step content
- [ ] `parseDevResponse` returns `DevAction` for valid XML output
- [ ] `parseDevResponse` returns `undefined` for unparseable output (no crash)
- [ ] `applyFileChanges` creates directories and writes files correctly
- [ ] File applier does NOT auto-commit or modify PROGRESS.md

### Dev-Agent Decisions

- Maximum depth for file tree
- Maximum number of existing files to include in context

---

## Step 4: Sidebar TreeView

**Goal:** Build the sidebar tree view showing plan state, worktree info, and step statuses.

### Requirements

- Show plan name, branch, worktree info
- Show all steps with status icons (⏳/🔄/✅)
- Show dev files (DEV_NOTES.md, DECISIONS.md, REVIEW_FEEDBACK.md) with summaries
- Clickable items open files in editor
- File watchers trigger automatic tree refresh

### Implementation Notes

Layout:
```
📋 Plan: my-feature (feature/plan-my-feature)
📍 Worktree: ../my-project-dev
📌 Current: Step 2: Build API (🔄 In Progress — iter 2/5)
📂 Dev Files
  📝 DEV_NOTES.md — 5 files, 2 decisions
  📋 DECISIONS.md — 3 decisions
  🔍 REVIEW_FEEDBACK.md — ❌ 3 issues
📂 All Steps
  ⏳ Step 1: Setup Auth
  🔄 Step 2: Build API         abc1234
  ⏳ Step 3: Frontend
```

Uses shared parsers from `smart-team-common` to populate data.

### Files to Create

- `src/providers/stepTreeProvider.ts` — Dev-centric sidebar

### Acceptance Criteria

- [ ] Tree view appears in Smart Developer activity bar panel
- [ ] Plan info, worktree, current step, dev files, and all steps display correctly
- [ ] File items are clickable and open in editor
- [ ] Step items open PLAN.md in editor
- [ ] Tree shows "No plan found" when no PLAN.md in workspace
- [ ] File watchers trigger tree refresh

### Dev-Agent Decisions

- Exact label formatting for tree items

---

## Step 5: Chat Handler

**Goal:** Implement the four chat commands — `/implement`, `/commit`, `/feedback`, `/status`.

### Requirements

- `/implement [step]` — AI implements a step: build context → stream to AI → parse response → apply files → write DEV_NOTES/DECISIONS → show diff → user approves
- `/commit` — show diff → user confirms → commit → update PROGRESS.md
- `/feedback` — read REVIEW_FEEDBACK.md → AI addresses issues → apply fixes
- `/status` — show plan state, step statuses, worktree info

### Implementation Notes

All flows use shared modules from `smart-team-common`: parsers, writers, git operations, diff viewer, AI provider factory.

**`/implement` flow**:
1. Parse PLAN.md → get step content
2. Read PROGRESS.md, DECISIONS.md, REVIEW_FEEDBACK.md (if iteration > 1)
3. Ensure worktree exists (`createDevWorktree` from common)
4. Build dev context (Step 3)
5. Build system prompt (Step 2)
6. Stream to AI → parse response → apply file changes
7. Write DEV_NOTES.md and DECISIONS.md (using common writers)
8. Show diff → user approves
9. If approved → commit (common gitWrite) → update PROGRESS.md (common progressWriter)

**`/commit` flow**:
1. Show diff using `getDiffForStep` from common
2. User confirms → `commitChanges` from common
3. Update PROGRESS.md with commit hash and last action
4. Commit message format: `feat(<plan>): step N - <title>`

**`/feedback` flow**:
1. Parse REVIEW_FEEDBACK.md (common parser)
2. If APPROVED → offer to mark step Complete
3. If CHANGES_REQUIRED → re-run implement flow with feedback in context

**`/status` flow**:
1. Parse plan and progress (common parsers)
2. Show formatted status table in chat

### Files to Create

- `src/chatHandler.ts` — All four command handlers

### Acceptance Criteria

- [ ] `/implement 2` starts implementing Step 2 with AI streaming
- [ ] `/implement` with no arg implements current in-progress step
- [ ] File changes are written to worktree (not main project)
- [ ] DEV_NOTES.md and DECISIONS.md are written correctly
- [ ] User must approve before any commit
- [ ] `/commit` shows diff, asks confirmation, commits, updates PROGRESS.md
- [ ] `/feedback` reads REVIEW_FEEDBACK.md and addresses issues
- [ ] `/status` shows plan name, branch, worktree, all step statuses
- [ ] Error cases (no plan, no worktree, AI parse failure) show clear messages
- [ ] PROGRESS.md is NOT modified until commit

### Dev-Agent Decisions

- Whether to show diff inline in chat or in separate editor tab
- How to prompt user to pick a step when none specified

---

## Step 6: Extension Activation and Testing

**Goal:** Wire everything together and verify end-to-end.

### Requirements

- Register chat participant, commands, tree view, file watchers, SecretStorage
- End-to-end test with all three AI providers
- Package as `.vsix`

### Implementation Notes

**Activation wiring** (`src/extension.ts`):
1. `detectPlanRoot()` using `findPlanFile` from common
2. Create `StepTreeProvider`, register TreeView
3. Create chat participant with `chatHandler`
4. Register all 6 commands
5. Register file watchers for all 5 shared state files
6. Register `onDidChangeWorkspaceFolders` handler
7. Initialize SecretStorage for API keys

**SecretStorage flow**: On first AI call with non-Copilot provider, if key is missing → show input dialog → store via `context.secrets.store()`. Add `smart-developer.setApiKey` command for manual updates.

**Manual test scenarios**:
1. Activation + `/status` → verify sidebar and chat work
2. `/implement 1` with Copilot → AI streams, files written, DEV_NOTES/DECISIONS created
3. `/commit` → diff shown, user approves, PROGRESS.md updated
4. `/feedback` with mock REVIEW_FEEDBACK.md → AI addresses issues
5. Test Anthropic and OpenAI providers
6. Error cases: no PLAN.md, no worktree, invalid step
7. `npx vsce package` → `.vsix` produced

**Cross-extension verification**: Use Smart Developer to implement a step → Smart Reviewer to review → verify both agree on PROGRESS.md state.

### Files to Modify

- `src/extension.ts` — Expand from stub to full activation

### Acceptance Criteria

- [ ] `npm run compile` produces zero errors
- [ ] Extension activates on startup with sidebar and chat participant
- [ ] All 6 palette commands and 4 chat commands work
- [ ] File watchers trigger sidebar refresh
- [ ] SecretStorage prompts for API key when needed
- [ ] `/implement` works end-to-end with Copilot provider
- [ ] `/commit` updates PROGRESS.md correctly
- [ ] `/feedback` addresses REVIEW_FEEDBACK.md issues
- [ ] `/status` shows correct plan state
- [ ] Error cases show clear messages
- [ ] `npx vsce package` produces `.vsix` under 5MB
- [ ] Cross-extension cycle works (dev implements → reviewer reviews → state agrees)

### Dev-Agent Decisions

- Whether to prompt for API key proactively or wait until first AI call
- Test PLAN.md content for manual testing
