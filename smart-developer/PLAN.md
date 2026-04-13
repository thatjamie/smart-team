# Smart Developer — VSCode Extension Plan

An AI-powered VSCode extension that implements the **dev-agent** workflow. The AI reads `PLAN.md`, implements steps one at a time inside a git worktree, writes `DEV_NOTES.md` and `DECISIONS.md`, and commits with human approval. The sidebar shows workflow state; the AI does the actual coding.

## Context

This extension IS the dev-agent. It:
- Reads `PLAN.md` and implements steps one at a time
- Creates a git worktree at `../<project-name>-dev/` on a feature branch
- Uses AI to generate code for each step
- Writes `DEV_NOTES.md` and `DECISIONS.md` into the worktree
- Updates `PROGRESS.md` after each commit
- Reads `REVIEW_FEEDBACK.md` (written by the review-agent / Smart Reviewer extension) to address feedback
- All AI operations happen in a chat panel inside VSCode

The human user approves commits and controls step progression.

## Step 1: Extension Scaffold

Create a VSCode extension:
- `package.json` with manifest
- `tsconfig.json` for TypeScript compilation (target ES2022, module commonjs)
- `.vscodeignore` for clean packaging
- Entry point `src/extension.ts` with activate/deactivate
- `media/icon.svg` — code/terminal icon

### Dependencies

- `@anthropic-ai/sdk` — Anthropic Claude provider
- `openai` — OpenAI provider
- Dev: `@types/vscode`, `typescript`

### package.json contributions

- **Activity Bar icon**: "Smart Developer" with a code icon
- **Sidebar TreeView**: `smart-developer-steps` — step list with status
- **Chat Participant**: `@smart-developer` — VSCode chat participant for AI interaction
- **Commands**:
  - `smart-developer.startStep` — Pick a step → AI implements it
  - `smart-developer.commitStep` — Review diff → approve → commit
  - `smart-developer.addressFeedback` — Read REVIEW_FEEDBACK.md → AI addresses issues
  - `smart-developer.openWorktree` — Add dev worktree to VSCode workspace
  - `smart-developer.refresh` — Refresh sidebar from disk
  - `smart-developer.settings` — Open extension settings (AI provider, API keys)

### Settings

- `smart-developer.aiProvider` — enum: `copilot` | `anthropic` | `openai` (default: `copilot`)
- `smart-developer.anthropicApiKey` — string (secret, use `vscode.SecretStorage`)
- `smart-developer.openaiApiKey` — string (secret, use `vscode.SecretStorage`)
- `smart-developer.anthropicModel` — string (default: `claude-sonnet-4-20250514`)
- `smart-developer.openaiModel` — string (default: `gpt-4o`)

## Step 2: AI Provider Abstraction

`src/ai/provider.ts`:

Define a common interface for AI chat:

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
- Uses `vscode.lm.selectChatModels()` to find available models
- Uses `vscode.LanguageModelChat` API for streaming responses
- No API key needed — uses VSCode's built-in Copilot infrastructure
- Requires `github.copilot-chat` extension

### AnthropicProvider (`src/ai/anthropicProvider.ts`)
- Uses `@anthropic-ai/sdk` npm package
- API key from `vscode.SecretStorage` (user sets via settings)
- Supports streaming with `client.messages.stream()`

### OpenAIProvider (`src/ai/openaiProvider.ts`)
- Uses `openai` npm package
- API key from `vscode.SecretStorage`
- Supports streaming with `client.chat.completions.stream()`

### ProviderFactory (`src/ai/providerFactory.ts`)
- Reads `smart-developer.aiProvider` setting
- Returns the correct provider instance
- Handles API key validation (warns if missing)

## Step 3: System Prompts

`src/prompts/devSystemPrompt.ts`:

Build the system prompt for the AI dev-agent. This encodes the dev-agent skill knowledge:

- Role: You are a dev-agent implementing code from PLAN.md
- Rules: Only implement the current step, follow project conventions, stay within boundaries
- Output format: The AI must output structured responses:
  - Code changes (file path + content)
  - DEV_NOTES content
  - DECISIONS entries (if any)
  - Summary for the human to approve

The system prompt is assembled dynamically with context:
- PLAN.md content (the current step section)
- PROGRESS.md state (which steps done, current iteration)
- DECISIONS.md content (past decisions)
- REVIEW_FEEDBACK.md content (if exists, iteration > 1)
- Project language/framework detection results
- File tree of the worktree

## Step 4: Shared Types

`src/types.ts`:
- `StepStatus` enum: `pending | in-progress | complete`
- `Step` interface: index, title, level, content, status, iteration, lastCommit
- `Plan` interface: name, filePath, steps[]
- `Progress` interface: planName, branch, created, steps[], lastAction
- `ProgressStepEntry`: label, status, iteration, lastCommit
- `ProgressLastAction`: agent, action, timestamp
- `WorktreeInfo`: path, branch, exists
- `DevAction` type: what the AI decided to do (files to create/edit, notes, decisions)

## Step 5: Parsers

`src/parsers/planParser.ts`:
- `parsePlan(planFilePath, progressOverrides?)` → `Plan`
- Parse `##` / `###` headings as steps, extract content between headings
- `findPlanFile(workspaceRoot)` — search PLAN.md, plan.md, docs/PLAN.md

`src/parsers/progressParser.ts`:
- `parseProgress(filePath)` → `Progress | undefined`
- Parse markdown table (step label, ⏳/🔄/✅, iteration N/5, commit hash)
- Parse metadata and Last Action section

`src/parsers/devNotesParser.ts`:
- `parseDevNotes(filePath)` → `{ whatWasImplemented, filesChanged, decisionsMade, questions }` or undefined
- Lightweight parsing for display purposes

`src/parsers/reviewFeedbackParser.ts`:
- `parseReviewFeedback(filePath)` → `{ status, changesRequired[], suggestions[] }` or undefined
- Needed so the AI can read and address feedback

`src/parsers/decisionsParser.ts`:
- `parseDecisions(filePath)` → `Decision[]` or empty array

## Step 6: Git Operations

`src/git.ts`:
- `getProjectRoot(dir)` — `git rev-parse --show-toplevel`
- `getProjectName(projectRoot)` — `basename`
- `createDevWorktree(projectRoot, planName)` → `WorktreeInfo`
- `findDevWorktree(projectRoot)` → `WorktreeInfo`
- `hasUncommittedChanges(dir)` → boolean
- `getDiff(dir, base?)` → string — `git diff main...HEAD`
- `getLatestDiff(dir)` → string — `git diff HEAD~1 HEAD`
- `commit(dir, message)` → short hash — `git add -A && git commit`
- `removeWorktree(projectRoot, path)` — cleanup at end
- `guessBaseBranch(dir)` — main or master

All use `child_process.spawnSync`. No shell execution — direct git calls only.

## Step 7: Markdown File Writers

`src/writers/progressWriter.ts`:
- `writeProgress(filePath, progress)` — write PROGRESS.md with table and metadata
- `initProgress(worktreeDir, planName, branch, steps)` — create initial PROGRESS.md

`src/writers/devNotesWriter.ts`:
- `writeDevNotes(filePath, notes)` — write DEV_NOTES.md from AI output

`src/writers/decisionsWriter.ts`:
- `appendDecision(filePath, decision)` — append to DECISIONS.md (never overwrite)

## Step 8: Sidebar TreeView

`src/providers/stepTreeProvider.ts`:

```
📋 Plan: my-feature (feature/plan-my-feature)
📍 Worktree: ../my-project-dev

⏳ Step 1: Setup Auth
🔄 Step 2: Build API                    iter 2/5 • def5678
  📝 DEV_NOTES.md
  📋 DECISIONS.md
  🔍 REVIEW_FEEDBACK.md                  ❌ 3 issues
⏳ Step 3: Frontend
```

- Header items: plan name, branch, worktree path
- Step items: status icon + title + iteration/commit info
- File items under each step (if they exist): clickable to open in editor
- Clicking a step opens PLAN.md scrolled to that heading
- File watchers trigger tree refresh

## Step 9: Chat Handler — Core AI Workflow

`src/chat/devChatHandler.ts`:

Handles the `@smart-developer` chat participant. This is where the dev-agent logic lives:

### Flow: "Implement Step N"

1. Parse PLAN.md → get step N content
2. Read PROGRESS.md (if exists) → understand current state
3. Read DECISIONS.md (if exists) → past context
4. Read REVIEW_FEEDBACK.md (if exists) → address feedback
5. Ensure dev worktree exists (create if needed, prompt for plan-name)
6. Detect project language/framework
7. Build system prompt with all context
8. Send to AI with streaming → show progress in chat
9. AI returns: code changes, DEV_NOTES, DECISIONS
10. Apply code changes to worktree files
11. Write DEV_NOTES.md
12. Append to DECISIONS.md
13. Show diff to user → ask for approval
14. If approved: commit, update PROGRESS.md
15. If changes requested: iterate

### Flow: "Address Feedback"

1. Read REVIEW_FEEDBACK.md from worktree
2. Read current diff
3. Build prompt: "Address this feedback: ..."
4. AI returns: fixes, updated DEV_NOTES
5. Apply fixes, update DEV_NOTES
6. Show diff → ask for approval → commit

### Flow: "Commit"

1. Show `git diff` in chat
2. Ask user to confirm
3. Commit with conventional commit message
4. Update PROGRESS.md

## Step 10: Context Builder

`src/contextBuilder.ts`:

Assembles the full context for the AI prompt:

```typescript
interface DevContext {
  planContent: string;        // Current step section from PLAN.md
  progressState: string;      // PROGRESS.md content
  pastDecisions: string;      // DECISIONS.md content
  reviewFeedback?: string;    // REVIEW_FEEDBACK.md content (if exists)
  projectStructure: string;   // File tree of worktree
  languageFramework: string;  // Detected stack info
  existingFiles: Map<string, string>; // Key files the AI needs to see
}
```

- Detect language from package.json, Cargo.toml, etc.
- Build file tree with `fs.readdirSync` (recursive, limited depth)
- Read key existing files that the step references
- Format everything into the system prompt

## Step 11: File Applier

`src/fileApplier.ts`:

Takes AI output (which files to create/edit) and applies it:

- Parse AI response for file blocks (```path/to/file.ts ... ```)
- Create directories if needed (`fs.mkdirSync recursive`)
- Write files to the worktree
- Show a summary of applied changes in chat
- Do NOT auto-commit — wait for user approval

## Step 12: Extension Activation

`src/extension.ts`:

- Register chat participant `@smart-developer`
- Register all commands
- Register TreeView
- Register file watchers (PLAN.md, PROGRESS.md, DEV_NOTES.md, REVIEW_FEEDBACK.md, DECISIONS.md)
- Initialize SecretStorage for API keys
- On activation: scan workspace for PLAN.md, find worktree, populate sidebar

## Step 13: Testing & Packaging

- Compile with `tsc`
- Package with `vsce package`
- Manual test: open a project with PLAN.md, use `@smart-developer` in chat
- Test all three AI providers (Copilot, Anthropic, OpenAI)
