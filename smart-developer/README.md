# Smart Developer — VSCode Extension

An AI dev-agent VSCode extension that reads `PLAN.md`, implements code step by step inside a git worktree, and commits with human approval.

## Features

- 🤖 **AI-Powered Implementation** — `/implement [step]` streams to your chosen AI provider and writes code to a git worktree
- 📋 **Sidebar TreeView** — Live view of plan steps, worktree info, dev files, and statuses
- ✅ **Commit with Approval** — `/commit` shows diff and requires explicit confirmation
- 🔄 **Review Feedback Loop** — `/feedback` reads REVIEW_FEEDBACK.md and re-implements with AI
- 📊 **Status Overview** — `/status` shows plan state in a formatted table
- 🔐 **Secure API Keys** — Stored in VSCode SecretStorage, never in plaintext

## Prerequisites

- **VSCode** ≥ 1.90.0
- **Git** installed and available in PATH
- An AI provider account (one of):
  - **GitHub Copilot** — enabled in VSCode (no API key needed)
  - **Anthropic** — API key required
  - **OpenAI** — API key required

## Installation

### From Source (Development)

```bash
# 1. Clone the monorepo
git clone <repo-url> smart-team
cd smart-team

# 2. Build the shared common package first
cd smart-team-common
npm install
npm run compile

# 3. Build the extension
cd ../smart-developer
npm install
npm run compile

# 4. Package as VSIX
npm run package
# Output: smart-developer-0.1.0.vsix

# 5. Install in VSCode
code --install-extension smart-developer-0.1.0.vsix
```

### From VSIX

```bash
code --install-extension smart-developer-0.1.0.vsix
```

## Setup

### 1. Configure AI Provider

Open VSCode Settings (`Cmd+,`) and search for `smart-developer`:

| Setting | Options | Default |
|---------|---------|---------|
| `smart-developer.aiProvider` | `copilot`, `anthropic`, `openai` | `copilot` |

### 2. Set API Key (if using Anthropic or OpenAI)

Open Command Palette (`Cmd+Shift+P`) → **Smart Developer: Set API Key**

## Usage

### Chat Commands

Open the Chat view (`Cmd+Shift+I`) and type `@smart-developer` followed by a command:

#### `/implement [step]` — AI implements a plan step

```
@smart-developer /implement 1
```

This will:
1. Find `PLAN.md` in your workspace
2. Build context (plan, progress, decisions, file tree, existing files)
3. Stream to your chosen AI provider
4. Parse the structured XML response
5. Apply file changes to the dev worktree
6. Write `DEV_NOTES.md` and append to `DECISIONS.md`
7. Show a diff preview

Omit the step number to implement the current in-progress or next pending step:
```
@smart-developer /implement
```

#### `/commit` — Review and commit changes

```
@smart-developer /commit
```

This will:
1. Show the diff in the chat and open a full diff editor tab
2. Display a **modal confirmation dialog** — you must click "Commit"
3. Commit changes to the worktree
4. Update `PROGRESS.md` with the commit hash and timestamp

#### `/feedback` — Address review feedback

```
@smart-developer /feedback
```

This will:
1. Read `REVIEW_FEEDBACK.md`
2. If **APPROVED** — offer to mark the step as complete
3. If **CHANGES_REQUIRED** — re-run the implement flow with feedback included in the AI context

#### `/status` — Show plan overview

```
@smart-developer /status
```

Displays a formatted table with plan name, branch, worktree path, and all step statuses.

### Palette Commands

Access via Command Palette (`Cmd+Shift+P`):

| Command | Action |
|---------|--------|
| **Smart Developer: Start Step** | Prompt for step number → opens chat with `/implement` |
| **Smart Developer: Commit Step** | Opens chat with `/commit` |
| **Smart Developer: Address Feedback** | Opens chat with `/feedback` |
| **Smart Developer: Open Worktree** | Opens the dev worktree folder in a new window |
| **Smart Developer: Refresh** | Refreshes the sidebar tree view |
| **Smart Developer: Open Settings** | Opens extension settings |
| **Smart Developer: Set API Key** | Securely stores your API key |

### Sidebar

The **Smart Developer** activity bar icon shows:

- 📋 **Plan info** — name, branch, step count
- 📍 **Worktree** — path and status
- 📌 **Current Step** — which step is active
- 📂 **Dev Files** — DEV_NOTES.md, DECISIONS.md, REVIEW_FEEDBACK.md (clickable)
- 📂 **All Steps** — every step with status icon (⏳/🔄/✅)

## Project Structure

```
smart-developer/
├── package.json          # Extension manifest
├── tsconfig.json         # TypeScript config
├── media/icon.svg        # Activity bar icon
├── src/
│   ├── extension.ts              # Activation wiring
│   ├── types.ts                  # Type definitions
│   ├── chatHandler.ts            # /implement, /commit, /feedback, /status
│   ├── contextBuilder.ts         # Assembles AI context from project state
│   ├── fileApplier.ts            # Parses AI XML output, writes files
│   ├── prompts/
│   │   └── devSystemPrompt.ts    # System prompt builder
│   └── providers/
│       └── stepTreeProvider.ts   # Sidebar tree view
└── PLAN.md               # Development plan
```

## Manual Testing Guide

### Step 1: Install and Verify

```bash
# From the monorepo root
cd smart-team-common && npm install && npm run compile
cd ../smart-developer && npm install && npm run compile
npm run package
code --install-extension smart-developer-0.1.0.vsix
```

Restart VSCode. Verify:
- [ ] **Smart Developer** icon appears in the activity bar (left sidebar)
- [ ] Opening chat shows `@smart-developer` as a participant

### Step 2: Test `/status` (no plan)

1. Open an **empty folder** in VSCode (no PLAN.md)
2. Open Chat → type `@smart-developer /status`
3. Verify: **❌ No PLAN.md found in workspace**

### Step 3: Test `/status` (with plan)

1. Open the `smart-developer/` folder in VSCode (contains PLAN.md)
2. Open Chat → type `@smart-developer /status`
3. Verify: formatted table with plan name, branch, step statuses

### Step 4: Test Sidebar

1. Click the **Smart Developer** icon in the activity bar
2. Verify tree shows:
   - 📋 Plan info with branch name
   - 📍 Worktree status
   - 📌 Current step
   - 📂 Dev Files (clickable → opens file)
   - 📂 All Steps with ✅/🔄/⏳ icons

### Step 5: Test `/implement` with Copilot

1. Ensure GitHub Copilot is enabled in VSCode
2. Set `smart-developer.aiProvider` to `copilot`
3. Open Chat → type `@smart-developer /implement 1`
4. Verify: AI streams response, files appear in sidebar diff
5. Check that `DEV_NOTES.md` and `DECISIONS.md` are updated

### Step 6: Test `/commit`

1. After `/implement`, type `@smart-developer /commit`
2. Verify: diff shown inline + editor tab
3. Verify: **modal dialog** appears asking "Commit changes?"
4. Click **Commit** → verify commit hash shown
5. Check `PROGRESS.md` is updated

### Step 7: Test `/feedback`

1. Manually create a `REVIEW_FEEDBACK.md` in the plan root with `Status: CHANGES_REQUIRED`
2. Type `@smart-developer /feedback`
3. Verify: feedback issues listed, AI re-implements with feedback context

### Step 8: Test API Key Flow

1. Set `smart-developer.aiProvider` to `anthropic`
2. Run **Smart Developer: Set API Key** from command palette
3. Enter a test key → verify "stored securely" message
4. Run **Smart Developer: Set API Key** again → verify "Update" prompt

### Step 9: Test File Watchers

1. Open sidebar tree view
2. Edit `PROGRESS.md` manually (change a status)
3. Verify: tree auto-refreshes

### Step 10: Test Palette Commands

1. `Cmd+Shift+P` → **Smart Developer: Start Step** → enter "1"
2. Verify: chat opens with `@smart-developer /implement 1` pre-filled
3. `Cmd+Shift+P` → **Smart Developer: Refresh**
4. Verify: sidebar tree refreshes

## Architecture

```mermaid
graph TD
    A[extension.ts - Activation] --> B[Chat Participant @smart-developer]
    A --> C[TreeView StepTreeProvider]
    A --> D[Palette Commands - 7 commands]
    A --> E[File Watchers - 5 files]

    B --> F[chatHandler.ts]
    F --> G[/implement]
    F --> H[/commit]
    F --> I[/feedback]
    F --> J[/status]

    G --> K[contextBuilder.ts]
    G --> L[devSystemPrompt.ts]
    G --> M[AI Provider - copilot/anthropic/openai]
    G --> N[fileApplier.ts - Parse XML + Write]

    C --> O[smart-team-common Parsers + Git + Writers]
    H --> P[gitWrite.ts commitChanges]
    I --> Q[reviewFeedbackParser.ts]
```
