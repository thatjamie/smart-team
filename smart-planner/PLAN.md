# Plan: Smart Planner VSCode Extension

## Overview

Build a VSCode extension that acts as an **AI plan-agent** — interactively interviewing the user, exploring existing codebases, and producing structured `PLAN.md` files that the Smart Developer and Smart Reviewer extensions can consume. The planner encodes the full knowledge of the plan-agent skill: interview techniques, step sizing, acceptance criteria writing, codebase analysis, and plan template enforcement.

## Context

### Existing System

**smart-team-common** (`../smart-team-common/`) provides shared infrastructure:
- Types (`Step`, `Plan`, `Progress`, etc.)
- AI providers (`CopilotProvider`, `AnthropicProvider`, `OpenAIProvider`, `ProviderFactory`)
- Parsers (`planParser`, `progressParser`, etc.)
- Writers (`progressWriter`, etc.)
- Git read operations

**Smart Developer** (`../smart-developer/`) and **Smart Reviewer** (`../smart-reviewer/`) both **consume** `PLAN.md`. The planner **produces** it. Together they form a pipeline:

```
smart-planner (creates plan) → smart-developer (implements) → smart-reviewer (reviews)
```

The planner also seeds `PROGRESS.md` after the plan is finalized, giving the dev-agent a ready-made starting point.

### Tech Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: VSCode Extension Host (Node.js)
- **Build**: `tsc` → `out/`
- **Dependencies**: `smart-team-common` (local package), `@anthropic-ai/sdk`, `openai`
- **VSCode API**: Chat Participants API, Language Model API (requires VSCode ^1.90.0), TreeView, SecretStorage
- **Package**: `vsce package` → `.vsix`

### Conventions

- Follow smart-team-common conventions
- **No worktree** — works directly in the project directory
- **No source code modification** — only writes `PLAN.md`, `PROGRESS.md`, and `.planner-state.json`
- **Conversational** — multi-turn interview over chat, not single-command

### Build Order

1. `smart-team-common` must be built first
2. Then `smart-planner` (this plan)
3. Smart Developer and Smart Reviewer are independent of the planner

### References

- Common package plan: `../smart-team-common/PLAN.md`
- Smart Developer plan: `../smart-developer/PLAN.md`
- Smart Reviewer plan: `../smart-reviewer/PLAN.md`
- VSCode Chat API: https://code.visualstudio.com/api/extension-guides/chat

---

## Step 1: Extension Scaffold

**Goal:** Set up the VSCode extension project structure with manifest, build config, dependency on smart-team-common, and planner-specific types.

### Requirements

- Create `package.json` with extension manifest
- Create `tsconfig.json` (target ES2022, module commonjs, strict)
- Create `.vscodeignore` for clean packaging
- Create `.gitignore` excluding `node_modules/`, `out/`, `*.vsix`
- Create entry point `src/extension.ts` with `activate()` and `deactivate()`
- Create `media/icon.svg` — clipboard/checklist icon
- Define planner-specific types in `src/types.ts`

### Implementation Notes

**Package.json** contributions:

Activity Bar & Views:
- Activity bar container: `smart-planner` with clipboard icon
- TreeView: `smart-planner-overview` — interview progress and plan outline

Chat Participant:
- ID: `smart-planner`, name: `smart-planner`
- Description: "AI planning agent that creates structured implementation plans"
- `isSticky: true`
- Commands:
  - `/plan [path]` — Start planning for a project (optionally specify project root path)
  - `/update` — Update an existing PLAN.md with new requirements
  - `/status` — Show current interview/plan status

Palette Commands:
- `smart-planner.startPlanning` → opens chat with `@smart-planner /plan`
- `smart-planner.updatePlan` → opens chat with `@smart-planner /update`
- `smart-planner.openProjectRoot` → pick folder to set as project root
- `smart-planner.refresh` → refreshes sidebar
- `smart-planner.settings` → opens settings

Settings:
- `smart-planner.aiProvider` — enum: `copilot` | `anthropic` | `openai` (default: `copilot`)
- `smart-planner.projectRoot` — string (default: `""`, empty means use workspace root)
- `smart-planner.anthropicBaseUrl` — string (default: `""`)
- `smart-planner.anthropicModel` — string (default: `claude-sonnet-4-20250514`)
- `smart-planner.openaiBaseUrl` — string (default: `""`)
- `smart-planner.openaiModel` — string (default: `gpt-4o`)

Dependencies:
- `"smart-team-common": "file:../smart-team-common"`
- `@anthropic-ai/sdk`: ^0.30.0, `openai`: ^4.52.0
- Dev: `@types/vscode` (^1.90.0), `@types/node` (^20.14.0), `typescript` (^5.5.0)

**Project Root Resolution** (order of priority):
1. Chat argument: `/plan /Users/me/my-project`
2. Setting: `smart-planner.projectRoot`
3. Workspace root: first workspace folder

**Planner-specific types** in `src/types.ts`:

```typescript
// Re-export all common types for convenience
export { StepStatus, Step, Plan, Progress, ProgressStepEntry, ProgressLastAction,
         WorktreeInfo, ReviewFeedback, ChangesRequiredItem, Decision, DevNotes,
         AiMessage, AiResponse, AiChatOptions, AiProvider } from 'smart-team-common';

/** Phases of the planning workflow. */
export type PlannerPhase = 'idle' | 'exploring' | 'interviewing' | 'drafting' | 'reviewing' | 'finalized';

/** Persistent interview state saved to .planner-state.json */
export interface PlannerState {
    /** Project root directory */
    projectRoot: string;
    /** Current phase */
    phase: PlannerPhase;
    /** What the user wants to build */
    intent: string;
    /** Whether this is greenfield (new) or brownfield (enhance existing) */
    isGreenfield: boolean;
    /** Codebase exploration results */
    codebaseSummary?: CodebaseSummary;
    /** Questions asked so far (with answers) */
    interviewQA: InterviewQA[];
    /** Number of interview rounds completed */
    interviewRound: number;
    /** Draft plan content (if any) */
    draftPlan?: string;
    /** Path to the generated PLAN.md */
    planFilePath?: string;
    /** ISO timestamp of last activity */
    lastActivity: string;
}

/** Codebase exploration results. */
export interface CodebaseSummary {
    /** Detected language(s) */
    languages: string[];
    /** Detected framework(s) */
    frameworks: string[];
    /** Key directories and their purposes */
    directoryStructure: string;
    /** Entry point files */
    entryPoints: string[];
    /** Conventions detected (naming, file org, etc.) */
    conventions: string[];
    /** Testing framework (if detected) */
    testFramework?: string;
    /** Key config files found (package.json, Cargo.toml, etc.) */
    configFiles: string[];
    /** Raw file tree (limited depth) */
    fileTree: string;
}

/** A single interview Q&A pair. */
export interface InterviewQA {
    /** The question asked */
    question: string;
    /** The user's answer */
    answer: string;
    /** Round number (starts at 1) */
    round: number;
}

/** Context for the planner system prompt. */
export interface PlannerContext {
    /** User's stated intent */
    intent: string;
    /** Codebase exploration results (if brownfield) */
    codebaseSummary?: CodebaseSummary;
    /** Interview Q&A so far */
    interviewQA: InterviewQA[];
    /** Current phase */
    phase: PlannerPhase;
    /** Existing PLAN.md content (if updating) */
    existingPlan?: string;
    /** Existing PROGRESS.md content (if updating) */
    existingProgress?: string;
}
```

### Files to Create

- `package.json`, `tsconfig.json`, `.vscodeignore`, `.gitignore`
- `src/extension.ts` — activate/deactivate stubs
- `src/types.ts` — Re-exports from common + planner-specific types
- `media/icon.svg`

### Acceptance Criteria

- [ ] `npm install` completes (links `smart-team-common` from `../`)
- [ ] `npm run compile` produces no errors
- [ ] Extension activates in Extension Development Host
- [ ] `@smart-planner` chat participant appears with 3 commands
- [ ] All 5 palette commands appear in Command Palette
- [ ] All 7 settings appear in Settings UI
- [ ] `src/types.ts` re-exports all common types AND defines PlannerPhase, PlannerState, CodebaseSummary, InterviewQA, PlannerContext

### Dev-Agent Decisions

- Icon design (clipboard/checklist theme)
- Exact description text

---

## Step 2: System Prompts

**Goal:** Build the system prompts that encode the full plan-agent skill knowledge — interview techniques, codebase exploration, plan template enforcement, step design principles, and quality checklist.

### Requirements

- **Interview prompt** — asks questions, explores codebase, gathers requirements over multiple turns
- **Plan generation prompt** — produces a structured PLAN.md following the exact template
- **Plan update prompt** — modifies an existing PLAN.md with new requirements
- All prompts must encode the plan-agent skill's knowledge completely

### Implementation Notes

The planner has three prompts, each used at different phases:

**1. Interview + Exploration Prompt** (`src/prompts/interviewPrompt.ts`)

Used during the `exploring` and `interviewing` phases. Encodes:
- **Role**: "You are a senior architect/planner conducting an interview to gather requirements for a development plan."
- **Codebase exploration guidance**: How to read project structure, detect tech stack, identify conventions, find entry points (from plan-agent Phase 1)
- **Interview technique**: Ask 2-4 focused questions at a time, prioritize by impact, don't ask about things inferable from codebase (from plan-agent Phase 2)
- **Key areas to probe**: scope boundaries, user-facing behavior, data model, integration points, non-functional requirements, existing patterns, migration/compatibility, priority/ordering
- **When requirements evolve**: Acknowledge change → Assess impact → Integrate gracefully → Flag ripple effects
- **Output format for interview responses**: Summarize understanding → Ask next questions → Note any decisions or assumptions made

**2. Plan Generation Prompt** (`src/prompts/planGenerationPrompt.ts`)

Used during the `drafting` phase. Encodes:
- **Role**: "You are generating a PLAN.md file that will be consumed by automated dev-agent and review-agent."
- **Exact PLAN.md template** (from plan-agent Phase 3):

```markdown
# Plan: [Descriptive Name]

## Overview
[2-5 sentences]

## Context
### Existing System
[If modifying existing code: architecture, modules, conventions, dependencies, file paths]
### Tech Stack
[Language, framework, libraries, build tools, test framework]
### Conventions
[Naming, file org, coding style, import conventions]
### References
[External docs, API specs, design docs, local doc paths]

---

## Step 1: [Clear, Actionable Title]

**Goal:** [One sentence]

### Requirements
- [Specific, verifiable requirements]

### Implementation Notes
[Architectural guidance, patterns to follow, things to watch for]

### Files to Create/Modify
- `path/to/file` — [what it contains/changes]

### Acceptance Criteria
- [ ] [Testable criteria]

### Dev-Agent Decisions
[Choices the dev-agent can make independently]

---
[Continue for all steps]
```

- **Step design principles**:
  - Each step implementable in 30min-2hrs
  - Produces a coherent, testable unit
  - If >8-10 requirements, split it
  - If depended on by everything, it's Step 1
  - Ordered by dependency
  - Clear boundaries via acceptance criteria
- **Step patterns**: Foundation first, Vertical slice, Scaffold then fill, Interface first
- **Testing reminders**: Add auto-test guidance in Implementation Notes/Acceptance Criteria, add User Verification at natural checkpoints
- **Quality checklist** (13 items from plan-agent Section 6) — the AI must verify the plan against this checklist before outputting

**3. Plan Update Prompt** (`src/prompts/planUpdatePrompt.ts`)

Used when `/update` is invoked. Encodes:
- Read existing PLAN.md and PROGRESS.md
- Understand which steps are completed/in-progress/pending
- For completed steps: add new steps at end rather than modifying
- For in-progress steps: discuss with user before modifying
- For pending steps: modify freely
- Present changes clearly with what changed and why

### Files to Create

- `src/prompts/interviewPrompt.ts` — Exploration + interview prompt builder
- `src/prompts/planGenerationPrompt.ts` — Plan generation prompt with full template
- `src/prompts/planUpdatePrompt.ts` — Plan update prompt

### Acceptance Criteria

- [ ] All three files compile without errors
- [ ] `buildInterviewPrompt(context)` returns a complete interview prompt
- [ ] `buildPlanGenerationPrompt(context)` returns a prompt with the exact PLAN.md template
- [ ] `buildPlanUpdatePrompt(context)` returns a prompt for updating existing plans
- [ ] Interview prompt includes codebase exploration guidance
- [ ] Interview prompt includes the interview technique (2-4 questions, prioritize by impact)
- [ ] Plan generation prompt includes the step design principles
- [ ] Plan generation prompt includes the quality checklist
- [ ] Plan update prompt respects completed/in-progress/pending step states

### Dev-Agent Decisions

- Exact wording of role definitions
- Whether to include example plans in the prompt for few-shot guidance

---

## Step 3: Codebase Explorer and State Manager

**Goal:** Implement the codebase exploration engine and interview state persistence.

### Requirements

- Explore a project directory: detect languages, frameworks, conventions, entry points, test frameworks
- Build a structured `CodebaseSummary` from exploration
- Persist interview state to `.planner-state.json` in the project root
- Load state on activation or `/plan` resume

### Implementation Notes

**Codebase Explorer** (`src/codebaseExplorer.ts`):

`exploreCodebase(projectRoot: string)` → `CodebaseSummary`

Exploration strategy:
1. **Read project root** — directory listing, identify config files
2. **Detect language** — check for `package.json` (JS/TS), `Cargo.toml` (Rust), `pyproject.toml`/`setup.py` (Python), `go.mod` (Go), `pom.xml`/`build.gradle` (Java), `*.sln`/`*.csproj` (C#)
3. **Detect framework** — from `package.json` dependencies (React, Express, Next.js, etc.), from imports in entry files
4. **Build file tree** — `fs.readdirSync` recursive to depth 4, skipping `node_modules`, `.git`, `dist`, `out`, `build`, `__pycache__`, `target`, `.next`
5. **Find entry points** — look for `main.ts`, `index.ts`, `app.ts`, `src/main.py`, `src/lib.rs`, `main.go`, etc.
6. **Detect conventions** — naming patterns (camelCase, snake_case, kebab-case), file organization (by feature vs. by type), import patterns
7. **Find test framework** — check for `jest`, `mocha`, `pytest`, `cargo test`, `go test` in config files
8. **Read README** — if exists, extract project description and key info

Error handling: if `projectRoot` doesn't exist or isn't a directory, return a minimal `CodebaseSummary` with empty fields (don't crash — greenfield projects have no codebase to explore).

**State Manager** (`src/stateManager.ts`):

- `loadState(projectRoot: string)` → `PlannerState | undefined` — reads `.planner-state.json`
- `saveState(state: PlannerState)` → `void` — writes `.planner-state.json` to project root
- `clearState(projectRoot: string)` → `void` — deletes `.planner-state.json`
- `createInitialState(projectRoot: string, intent: string, isGreenfield: boolean)` → `PlannerState`

State file location: `<projectRoot>/.planner-state.json` — persisted across VSCode restarts, included in `.gitignore` suggestion.

### Files to Create

- `src/codebaseExplorer.ts` — Project exploration engine
- `src/stateManager.ts` — Interview state persistence

### Acceptance Criteria

- [ ] Both files compile without errors
- [ ] `exploreCodebase` detects TypeScript from `package.json` + `tsconfig.json`
- [ ] `exploreCodebase` detects Python from `pyproject.toml`
- [ ] `exploreCodebase` builds file tree excluding `node_modules`, `.git`, etc.
- [ ] `exploreCodebase` handles non-existent directories gracefully (returns empty summary)
- [ ] `loadState` returns `undefined` when no `.planner-state.json` exists
- [ ] `saveState` writes valid JSON to `<projectRoot>/.planner-state.json`
- [ ] `loadState` after `saveState` round-trips correctly
- [ ] `clearState` removes the state file

### Dev-Agent Decisions

- Maximum file tree depth
- Maximum number of files to read during exploration
- Whether to read file contents beyond config/entry-point files

---

## Step 4: Plan Writer

**Goal:** Write PLAN.md and PROGRESS.md from the AI's generated plan content.

### Requirements

- Write PLAN.md with the exact structure that dev-agent and review-agent expect
- Seed PROGRESS.md after plan is finalized (using the standard format from common)
- Validate that the generated plan has all required sections before writing

### Implementation Notes

**Plan Writer** (`src/planWriter.ts`):

- `writePlan(projectRoot: string, planContent: string)` → `string` (returns the file path)
  - Write `PLAN.md` to `<projectRoot>/PLAN.md`
  - Basic validation: check for `## Step` headings, `**Goal:**` lines, `### Acceptance Criteria` sections
  - If validation fails, log warnings but still write (AI might produce slightly different formatting)

- `seedProgress(projectRoot: string, planFilePath: string)` → `void`
  - Parse the written PLAN.md using `parsePlan` from common
  - Extract step titles
  - Use `writeProgress` from common to create PROGRESS.md with all steps as ⏳ Pending
  - Set Last Action to "Plan created and PROGRESS.md seeded"

- `parsePlanFromAiOutput(aiText: string)` → `string | undefined`
  - Extract the plan content from AI response (the AI outputs the full PLAN.md markdown)
  - Look for the plan between markers or by finding `# Plan:` heading
  - Return undefined if no plan content found

**Plan validation checks** (non-blocking — warn but still write):
- Has `# Plan:` or `# Plan :` heading
- Has `## Overview` section
- Has `## Context` section
- Has at least one `## Step N:` heading
- Each step has `**Goal:**` line
- Each step has `### Acceptance Criteria`

### Files to Create

- `src/planWriter.ts` — PLAN.md and PROGRESS.md writer with validation

### Acceptance Criteria

- [ ] File compiles without errors
- [ ] `writePlan` creates `<projectRoot>/PLAN.md` with the provided content
- [ ] `seedProgress` creates `<projectRoot>/PROGRESS.md` with all steps as ⏳ Pending
- [ ] PROGRESS.md step titles match PLAN.md step headings
- [ ] PROGRESS.md is parseable by common's `parseProgress`
- [ ] PLAN.md is parseable by common's `parsePlan`
- [ ] `parsePlanFromAiOutput` extracts plan content from AI text
- [ ] `parsePlanFromAiOutput` returns undefined for text without plan content
- [ ] Validation warnings are logged but don't prevent writing

### Dev-Agent Decisions

- How strict the validation should be
- Whether to suggest `.gitignore` additions for `.planner-state.json`

---

## Step 5: Chat Handler

**Goal:** Implement the multi-turn conversational chat handler for `/plan`, `/update`, and `/status`.

### Requirements

- `/plan [path]` — multi-turn interview: determine project root → explore codebase → interview user → generate plan → iterate → finalize → write PLAN.md + PROGRESS.md
- `/update` — read existing plan → interview about changes → redraft → write updated PLAN.md
- `/status` — show current interview state, phase, questions asked
- Persist interview state across chat turns using `.planner-state.json`
- Support resuming an interrupted planning session

### Implementation Notes

All flows use shared modules from `smart-team-common`.

**`/plan [path]` flow**:

1. **Resolve project root**: chat argument → setting → workspace root
2. **Check for existing state**: load `.planner-state.json` if exists
3. **If resuming**: summarize where we left off, continue from that phase
4. **Phase: Exploring** (automatic, first turn):
   - Call `exploreCodebase(projectRoot)` → get `CodebaseSummary`
   - Save state with phase=`exploring`
   - Transition to interviewing
5. **Phase: Interviewing** (multi-turn):
   - Build interview prompt with codebase summary (if any) and Q&A so far
   - AI asks 2-4 focused questions
   - Save each Q&A pair to state
   - Repeat until AI determines requirements are clear (it says "I have enough context" or similar signal)
   - Transition to drafting
6. **Phase: Drafting**:
   - Build plan generation prompt with all gathered context
   - AI generates full PLAN.md content
   - Extract plan from AI response using `parsePlanFromAiOutput`
   - Save draft to state
   - Transition to reviewing
7. **Phase: Reviewing** (multi-turn):
   - Show plan summary to user (number of steps, key decisions)
   - User provides feedback → AI revises plan → iterate
   - When user says approved: transition to finalized
8. **Phase: Finalized**:
   - Write PLAN.md using `writePlan()`
   - Seed PROGRESS.md using `seedProgress()`
   - Clear `.planner-state.json`
   - Show confirmation with file path and step count

**`/update` flow**:
1. Find existing PLAN.md in project root
2. Parse existing plan using common's `parsePlan`
3. Parse existing PROGRESS.md (if exists) to know step statuses
4. Build plan update prompt with existing plan, progress, and user's new requirements
5. AI redrafts affected steps
6. User reviews → iterate → finalize
7. Write updated PLAN.md (keep PROGRESS.md in sync)

**`/status` flow**:
1. Load state from `.planner-state.json`
2. Show: project root, current phase, questions asked count, draft status

**Signal detection** (how the AI knows when to transition phases):
- The interview prompt instructs the AI to output `[REQUIREMENTS_CLEAR]` when it has enough info
- The plan generation prompt instructs the AI to output the full PLAN.md between `[PLAN_START]` and `[PLAN_END]` markers
- These markers are parsed by the chat handler to drive phase transitions

**Error handling**:
- Invalid project root path → "Directory not found: <path>. Please provide a valid path."
- No workspace and no path → "Please specify a project path: /plan /path/to/project"
- AI output doesn't contain plan markers → show raw output, ask user if it looks right, retry extraction
- State file corrupted → start fresh interview

### Files to Create

- `src/chatHandler.ts` — All three command handlers with multi-turn state management

### Acceptance Criteria

- [ ] `/plan` with no argument uses workspace root as project root
- [ ] `/plan /path/to/project` uses the specified path
- [ ] `/plan` explores codebase and starts interview with 2-4 questions
- [ ] Interview persists across chat turns (ask question → user answers → next questions)
- [ ] After interview, AI generates full PLAN.md content
- [ ] User can request changes to the draft and AI revises
- [ ] On finalize: PLAN.md and PROGRESS.md are written to project root
- [ ] PROGRESS.md has all steps as ⏳ Pending with correct titles
- [ ] `.planner-state.json` is created during interview and cleared on finalize
- [ ] Resuming an interrupted session loads previous state correctly
- [ ] `/update` reads existing PLAN.md and modifies it
- [ ] `/update` respects completed/in-progress/pending step states
- [ ] `/status` shows current phase, project root, and interview progress
- [ ] Error cases (invalid path, no workspace, corrupted state) show clear messages

### Dev-Agent Decisions

- Exact phase transition signal format
- Maximum number of interview rounds before forcing plan generation
- Whether to auto-suggest `.gitignore` addition for `.planner-state.json`

---

## Step 6: Sidebar and Extension Activation

**Goal:** Build the sidebar showing planning state, wire up extension activation, and verify end-to-end.

### Requirements

- Sidebar shows: project root, current phase, interview progress, plan outline
- Register chat participant, commands, tree view, file watchers
- End-to-end test with all three AI providers
- Package as `.vsix`

### Implementation Notes

**Sidebar layout** (`src/providers/plannerTreeProvider.ts`):

```
📂 Project: /Users/me/my-project
📋 Phase: Interviewing (Round 2)
❓ Questions Asked: 6
📝 Plan Status: Not yet drafted

📂 Interview History
  Round 1:
  Q: "What is the scope?" → "Full API + UI"
  Q: "Tech stack?" → "TypeScript + Express"
  Round 2:
  Q: "Error handling?" → "Structured errors"
  ...

📂 Plan Outline (after drafting)
  Step 1: Project Scaffold
  Step 2: API Routes
  Step 3: Database Schema
  Step 4: Frontend
```

**Activation wiring** (`src/extension.ts`):
1. Resolve project root (setting → workspace root)
2. Load planner state from `.planner-state.json`
3. Create `PlannerTreeProvider`, register TreeView
4. Create chat participant with `chatHandler`
5. Register commands:
   - `startPlanning` → open chat with `/plan`
   - `updatePlan` → open chat with `/update`
   - `openProjectRoot` → folder picker → set project root + refresh
   - `refresh` → reload state + refresh tree
   - `settings` → open settings
6. Register file watcher for `.planner-state.json` → refresh tree

**Manual test scenarios**:
1. `/plan` on empty directory (greenfield) → interview → generate plan → verify PLAN.md structure
2. `/plan /path/to/existing/project` (brownfield) → codebase explored → interview → plan matches existing conventions
3. `/update` on existing PLAN.md → modify → verify PROGRESS.md stays in sync
4. `/status` → shows correct phase and state
5. Close VSCode mid-interview → reopen → `/plan` resumes from saved state
6. Test Copilot, Anthropic, OpenAI providers
7. `npx vsce package` → `.vsix` produced
8. Cross-extension test: plan with smart-planner → implement with smart-developer → review with smart-reviewer

### Files to Create

- `src/providers/plannerTreeProvider.ts` — Planning state sidebar
- Modify `src/extension.ts` — Full activation wiring

### Acceptance Criteria

- [ ] `npm run compile` produces zero errors
- [ ] Extension activates on startup
- [ ] Sidebar shows project root, phase, and interview progress
- [ ] Sidebar updates when `.planner-state.json` changes
- [ ] `openProjectRoot` command opens folder picker and updates project root
- [ ] `/plan` on greenfield project produces a valid PLAN.md (parseable by common's `parsePlan`)
- [ ] `/plan` on brownfield project includes codebase context in the plan
- [ ] PLAN.md has all required sections: Overview, Context, Steps with Goals/Requirements/Notes/Files/Criteria/Decisions
- [ ] PROGRESS.md is seeded correctly with all steps as ⏳ Pending
- [ ] `/update` modifies existing plan while respecting step statuses
- [ ] Interview state persists across VSCode restarts
- [ ] All three AI providers work
- [ ] `npx vsce package` produces `.vsix` under 5MB
- [ ] Full pipeline test: planner creates plan → developer implements → reviewer reviews → state agrees

### Dev-Agent Decisions

- Exact sidebar layout details
- Whether to show the full plan in the sidebar or just an outline
- Test project content for manual testing
