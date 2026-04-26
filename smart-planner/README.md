# Smart Planner

A VSCode extension that acts as an **AI plan-agent** — interactively interviewing you, exploring your codebase, and producing structured `PLAN.md` files that the [Smart Developer](https://github.com/thatjamie/smart-team) and Smart Reviewer extensions can consume.

## Features

- 🤖 **Interactive Interview** — Multi-turn Q&A to gather requirements
- 🔍 **Codebase Exploration** — Auto-detects languages, frameworks, conventions, and entry points
- 📝 **Structured Plans** — Generates `PLAN.md` with steps, goals, acceptance criteria
- 🔄 **Plan Updates** — Modify existing plans while respecting step statuses
- 📊 **Sidebar View** — Live view of planning session state
- 🤝 **Pipeline Integration** — Plans feed directly into Smart Developer for implementation

## Quick Start

### 1. Install the Extension

Install from the `.vsix` file or via the VSCode Extensions marketplace.

### 2. Set Your API Key

By default, Smart Planner uses **GitHub Copilot** (no API key needed). If you want to use Anthropic or OpenAI instead:

1. Open the Command Palette (`Cmd+Shift+P` on Mac, `Ctrl+Shift+P` on Windows/Linux)
2. Run one of:
   - **Smart Planner: Set Anthropic API Key** — enter your `sk-ant-...` key
   - **Smart Planner: Set OpenAI API Key** — enter your `sk-...` key
3. Your key is stored securely in VSCode's SecretStorage (not in settings files)

Then set your preferred provider in Settings (`Cmd+,` → search `Smart Planner`):

| Setting | Default | Description |
|---------|---------|-------------|
| `smart-planner.aiProvider` | `copilot` | AI provider: `copilot`, `anthropic`, or `openai` |
| `smart-planner.projectRoot` | *(empty)* | Project root directory (defaults to workspace root) |
| `smart-planner.anthropicModel` | `claude-sonnet-4-20250514` | Anthropic model name |
| `smart-planner.anthropicBaseUrl` | *(empty)* | Custom Anthropic API base URL |
| `smart-planner.openaiModel` | `gpt-4o` | OpenAI model name |
| `smart-planner.openaiBaseUrl` | *(empty)* | Custom OpenAI API base URL |

### 3. Create a Plan

Open the VSCode Chat (`Ctrl+Shift+I` or `Cmd+Shift+I`) and type:

```
@smart-planner /plan
```

This starts the planning flow for your current workspace. You can also specify a project path:

```
@smart-planner /plan /path/to/my/project
```

### 4. Answer Questions

The AI will ask 2–4 focused questions at a time about:
- Scope and boundaries
- User-facing behavior
- Data model
- Integration points
- Non-functional requirements
- Existing patterns to follow

Answer naturally. The interview continues until the AI has enough information.

### 5. Review and Approve

Once requirements are clear, the AI generates a `PLAN.md`. Review it and either:
- **Approve**: Type `"Looks good"` or `"Approve"`
- **Request changes**: Describe what to change (e.g., `"Make Step 2 more detailed"`)

After approval, the extension writes:
- `PLAN.md` — The structured implementation plan
- `PROGRESS.md` — Step tracking (all steps start as ⏳ Pending)

### 6. Update an Existing Plan

To modify an existing plan:

```
@smart-planner /update Add error handling to all API routes
```

The AI reads your existing `PLAN.md` and `PROGRESS.md`, respects completed steps, and only modifies pending/in-progress steps.

### 7. Check Status

```
@smart-planner /status
```

Shows the current planning session state: phase, interview progress, and draft status.

## Sidebar

The **Smart Planner** sidebar (activity bar) shows:
- 📋 Current phase (Idle → Exploring → Interviewing → Drafting → Reviewing → Finalized)
- 📂 Project root path
- ❓ Interview history (grouped by round)
- 📝 Plan outline (step titles)

The sidebar auto-refreshes when planning state changes.

## Commands

| Command | Description |
|---------|-------------|
| `Smart Planner: Start Planning` | Opens chat with `/plan` |
| `Smart Planner: Update Plan` | Opens chat with `/update` |
| `Smart Planner: Open Project Root` | Folder picker to set project root |
| `Smart Planner: Refresh` | Refresh the sidebar view |
| `Smart Planner: Settings` | Open Smart Planner settings |

## Pipeline: Plan → Develop → Review

Smart Planner is part of the **Smart Team** extension suite:

```
Smart Planner → Smart Developer → Smart Reviewer
 (creates plan)   (implements)     (reviews)
```

1. Use **Smart Planner** to create `PLAN.md`
2. Use **Smart Developer** (`@smart-developer`) to implement each step
3. Use **Smart Reviewer** (`@smart-reviewer`) to review the implementation

All three extensions share the same `PROGRESS.md` state file.

## Resume Support

If you close VSCode mid-interview, your state is preserved in `.planner-state.json`. Reopen VSCode and run `/plan` to resume from where you left off.

## Greenfield vs. Brownfield

- **Greenfield** (empty directory): Skips codebase exploration, starts interview immediately
- **Brownfield** (existing code): Explores the codebase first (detects languages, frameworks, conventions), then uses that context during the interview

## Requirements

- VSCode 1.90.0 or later
- One of: GitHub Copilot, Anthropic API key, or OpenAI API key

## Extension Settings

All settings can be found under `Smart Planner` in VSCode Settings.

## Known Issues

- None currently. Please report issues on the project repository.
