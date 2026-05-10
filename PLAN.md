# Plan: Smart Team — Integrated VSCode Extensions

## Overview
A monorepo of three VSCode extensions (Smart Planner, Smart Developer, Smart Reviewer) sharing a common TypeScript library. The pipeline: **Planner** generates structured PLAN.md files via AI → **Developer** reads plans and implements code in git worktrees → **Reviewer** compares implementations against plans and provides feedback. This merged plan consolidates all four sub-project plans into a single dependency-ordered sequence with early manual test checkpoints at each phase boundary.

## Context

### Existing System
The workspace is a monorepo at `/Users/jamiexie/workspace/smart-team/` with four sub-projects. Existing code will be removed and treated as greenfield.

### Tech Stack
- **TypeScript** (all packages)
- **Node.js** runtime
- **VSCode Extension API** (`@types/vscode`)
- **OpenAI SDK** + **Anthropic SDK** + **Ollama** for AI providers
- **TypeScript** compiler (`tsc`) for the shared library
- **ESBuild** for extension bundling
- **Jest** or **Vitest** for unit tests

### Conventions
- Each sub-project has its own `package.json`, `tsconfig.json`, `src/`
- Common library compiled to `out/` directory, consumed via relative path or npm link
- Extension code follows VSCode extension conventions (activate, register commands, dispose)
- All steps include acceptance criteria for the review-agent to verify

### References
- `SCENARIOS.md` — usage scenarios for the extensions
- Original sub-project plans (for detailed reference during implementation):
  - `smart-team-common/PLAN.md`
  - `smart-planner/PLAN.md`
  - `smart-developer/PLAN.md`
  - `smart-reviewer/PLAN.md`

---

## Format Standards

> **This section is the single source of truth for every file format and AI response contract.** All parsers, writers, and AI prompt templates must conform to these specifications. No regex parsing — use deterministic state-machine parsing or JSON.parse() only.

### Design Principles

1. **AI responses use JSON-in-code-fences.** The AI outputs structured JSON inside a ` ```json ` code block. The parser extracts the JSON block and runs `JSON.parse()`. No text extraction, no regex.
2. **Document files use strict markdown templates.** Each document has a fixed structure with unambiguous heading patterns. Parsers use line-by-line state machines that track the current section by heading text.
3. **Writers are template-driven.** Writers produce output by interpolating values into the exact template. They never concatenate ad-hoc strings.
4. **Round-trip guarantee.** `parse(write(data))` must produce data equivalent to the original `data` for all formats.

---

### F1. PLAN.md — Format Contract

**Purpose:** Defines the implementation plan. Written by Planner, read by Developer and Reviewer.

**Template:**
```markdown
# {Plan Title}

## Overview
{1-5 sentence overview of the plan}

## Context
{existing system description, tech stack, conventions}

## Step 1: {Step Title}

**Goal:** {one-line goal}

### Requirements
- {specific requirement}
- {specific requirement}

### Implementation Notes
{architectural guidance paragraph}

### Acceptance Criteria
- [ ] {testable criterion}
- [ ] {testable criterion}

## Step 2: {Step Title}
{same internal structure as Step 1}
```

**TypeScript type:**
```typescript
interface PlanDocument {
  title: string;
  overview: string;
  context: string;
  steps: PlanStep[];
}

interface PlanStep {
  index: number;        // 0-based
  title: string;        // from "## Step N: {title}"
  goal: string;         // from "**Goal:**" line
  requirements: string[];
  implementationNotes: string;
  acceptanceCriteria: string[];
  status: StepStatus;
}
```

**Parse rules (state machine):**
- Split content by lines, track current section via heading matches
- `# ` (h1, first occurrence) → plan title
- `## Overview` → everything until next `##` heading is overview
- `## Context` → everything until next `##` heading is context
- `## Step {N}: {title}` → start of step N. N must be a positive integer. Title is the remainder after `: `
- Within a step, `### Requirements` → bulleted list items (`- ` prefix) are requirements
- Within a step, `### Implementation Notes` → paragraph text until next `###` or `##`
- Within a step, `### Acceptance Criteria` → list items (`- [ ] ` or `- [x] ` prefix) are criteria
- `**Goal:**` → first non-empty line after step heading (before any `###`), text after the prefix is the goal

**Write rules:**
- Writer receives `PlanDocument`, outputs the template above
- Each step's sections are written in fixed order: Goal, Requirements, Implementation Notes, Acceptance Criteria
- Empty sections are omitted (e.g., if no requirements, skip the `### Requirements` section)

---

### F2. PROGRESS.md — Format Contract

**Purpose:** Tracks step implementation status. Read/written by both Developer and Reviewer.

**Template:**
```markdown
# Progress

| Step | Status | Iteration | Commit |
|------|--------|-----------|--------|
| Step 1: {title} | ⏳ | 0/5 | — |
| Step 2: {title} | 🔄 | 2/5 | abc1234 |
| Step 3: {title} | ✅ | 1/5 | def5678 |

## Notes
{free-form notes, optional}
```

**TypeScript type:**
```typescript
interface ProgressDocument {
  steps: ProgressEntry[];
  notes: string;
}

interface ProgressEntry {
  stepIndex: number;
  title: string;
  status: '⏳' | '🔄' | '✅';  // pending, in_progress, completed
  iteration: number;
  maxIterations: number;
  commit: string | null;          // null when '—'
}
```

**Parse rules:**
- Find the markdown table by locating the header row `| Step | Status | Iteration | Commit |`
- Skip the separator row (`|------|...`)
- Each subsequent `|`-delimited row is a progress entry
- Parse status from emoji: ⏳ → pending, 🔄 → in_progress, ✅ → completed
- Parse iteration from `{current}/{max}` format (e.g., `2/5`)
- Parse commit: `—` or empty → null, otherwise the 7-char hash string
- `## Notes` section: everything after the heading until EOF

**Write rules:**
- Always write the exact header row and separator
- Rows ordered by stepIndex ascending
- Commit of null writes as `—`
- Notes section only written if non-empty

---

### F3. REVIEW.md — Format Contract

**Purpose:** Review feedback for a specific step. Written by Reviewer, read by Developer.

**Template:**
```markdown
# Review: Step {N} — {title}

## Verdict
{APPROVED or CHANGES_REQUIRED}

## Summary
{1-3 sentence assessment}

## Approved Items
- {item that meets requirements}
- {item}

## Changes Required
- {issue title}: {description}
  - Fix: {how to fix}
- {issue title}: {description}
  - Fix: {how to fix}

## Suggestions
- {non-blocking suggestion}

## Questions
- {clarifying question for developer}
```

**TypeScript type:**
```typescript
interface ReviewDocument {
  stepIndex: number;
  stepTitle: string;
  verdict: 'APPROVED' | 'CHANGES_REQUIRED';
  summary: string;
  approvedItems: string[];
  changesRequired: ChangeRequired[];
  suggestions: string[];
  questions: string[];
}

interface ChangeRequired {
  issue: string;
  description: string;
  fix: string;
}
```

**Parse rules:**
- `# Review: Step {N} — {title}` → extract N and title from first heading
- `## Verdict` → next non-empty line must be exactly `APPROVED` or `CHANGES_REQUIRED`
- `## Summary` → paragraph text until next `##`
- `## Approved Items` → `- ` prefixed lines until next `##`
- `## Changes Required` → each `- ` line is `{issue}: {description}`, the following `  - Fix: ` line is the fix
- `## Suggestions` → `- ` prefixed lines
- `## Questions` → `- ` prefixed lines
- If a section contains only "None." or is empty, produce an empty array

**Write rules:**
- Writer receives `ReviewDocument`, outputs the template above
- Each `ChangeRequired` writes as two lines: `- {issue}: {description}` then `  - Fix: {fix}`
- Empty sections write "None." as the content

---

### F4. DEV_NOTES.md — Format Contract

**Purpose:** Developer's notes for what was implemented in a step. Written by Developer, read by Reviewer.

**Template:**
```markdown
# Dev Notes: Step {N} — {title}

## What Was Done
{paragraph summary of implementation}

## Files Changed
- `relative/path/to/file` — {what changed}
- `relative/path/to/other` — {what changed}

## Decisions
- {decision}: {rationale}

## Questions for Reviewer
- {question}
```

**TypeScript type:**
```typescript
interface DevNotesDocument {
  stepIndex: number;
  stepTitle: string;
  whatWasDone: string;
  filesChanged: FileChange[];
  decisions: string[];
  questions: string[];
}

interface FileChange {
  path: string;
  description: string;
}
```

**Parse rules:**
- `# Dev Notes: Step {N} — {title}` → extract step index and title
- `## What Was Done` → paragraph text until next `##`
- `## Files Changed` → each `- `{path}` — {description}` line is a file change entry
- `## Decisions` → `- ` prefixed lines
- `## Questions for Reviewer` → `- ` prefixed lines

**Write rules:**
- Template-driven, sections in fixed order
- Empty sections write "None."

---

### F5. DECISIONS.md — Format Contract

**Purpose:** Cumulative log of architectural decisions across all steps. Written by Developer, read by Reviewer.

**Template:**
```markdown
# Decisions

## Decision 1: {title}
**Step:** Step {N} — {step title}
**Context:** {why needed}
**Rationale:** {why this approach}
**Date:** YYYY-MM-DD

## Decision 2: {title}
...
```

**TypeScript type:**
```typescript
interface DecisionsDocument {
  decisions: Decision[];
}

interface Decision {
  index: number;        // 1-based
  title: string;
  stepRef: string;      // "Step N — {title}"
  context: string;
  rationale: string;
  date: string;         // YYYY-MM-DD
}
```

**Parse rules:**
- `## Decision {N}: {title}` → start of decision N
- Within a decision: `**Step:** `, `**Context:** `, `**Rationale:** `, `**Date:** ` → extract field values
- Each field is single-line (value is the text after the bold label)

**Write rules:**
- Append mode: new decisions are added at the end, never overwrite existing ones
- Decision index is auto-incremented from the last existing decision

---

### F6. Planner AI Response — Format Contract

**Purpose:** AI-generated plan content that the Planner parses and converts to PLAN.md.

**The AI must respond with a JSON code block. The response may include explanatory text before/after the code block, but the JSON block is the only part parsed.**

**Expected response format:**
~~~
Here is the implementation plan:

```json
{
  "title": "User Management REST API",
  "overview": "A REST API for user CRUD operations with authentication...",
  "context": "Built with Express.js and TypeScript. Uses PostgreSQL...",
  "steps": [
    {
      "title": "Project Setup",
      "goal": "Initialize the project with dependencies and configuration",
      "requirements": [
        "Initialize npm project with TypeScript",
        "Install Express, Prisma, and auth dependencies",
        "Configure ESLint and Prettier"
      ],
      "implementationNotes": "Use Express Generator pattern. Place config in src/config/...",
      "acceptanceCriteria": [
        "npm run dev starts the server on port 3000",
        "npm run lint passes with zero errors",
        "TypeScript compiles with strict mode"
      ]
    },
    {
      "title": "Database Schema",
      "goal": "Define the User model and database migrations",
      "requirements": [
        "Create User model with email, password, name fields",
        "Add created_at and updated_at timestamps",
        "Generate Prisma migration"
      ],
      "implementationNotes": "Use Prisma schema in prisma/schema.prisma...",
      "acceptanceCriteria": [
        "npx prisma migrate dev creates the migration",
        "User model has all required fields",
        "Migration is reversible"
      ]
    }
  ]
}
```
~~~

**TypeScript type:** `PlanDocument` (same as F1)

**Parse rules:**
1. Find the first ` ```json ` code fence in the response
2. Find the matching ` ``` ` closing fence
3. Extract the content between fences
4. Run `JSON.parse()` on the extracted content
5. Validate that the result has `title`, `overview`, `context`, `steps` fields
6. Validate that each step has `title`, `goal`, `requirements`, `acceptanceCriteria`

**Error handling:**
- No code fence found → error: "AI response did not contain a JSON code block. Please retry."
- JSON.parse fails → error: "AI response contained invalid JSON. Please retry."
- Missing required fields → error: "AI response missing required fields: {field list}. Please retry."

---

### F7. Developer AI Response — Format Contract

**Purpose:** AI-generated code implementation that the Developer parses and applies to the worktree.

**Expected response format:**
~~~
Here is the implementation for Step 1:

```json
{
  "summary": "Initialized the Express project with TypeScript, Prisma, and ESLint configuration",
  "files": [
    {
      "path": "package.json",
      "action": "create",
      "content": "{\n  \"name\": \"user-api\",\n  \"version\": \"1.0.0\",\n  ...\n}"
    },
    {
      "path": "src/index.ts",
      "action": "create",
      "content": "import express from 'express';\n\nconst app = express();\n..."
    },
    {
      "path": ".eslintrc.json",
      "action": "create",
      "content": "{\n  \"parser\": \"@typescript-eslint/parser\",\n  ...\n}"
    }
  ],
  "devNotes": {
    "whatWasDone": "Set up Express server with TypeScript compilation, Prisma ORM, and ESLint",
    "decisions": [
      "Used Prisma over TypeORM: better TypeScript inference and migration workflow"
    ],
    "questions": [
      "Should we add Jest now or wait until Step 3?"
    ]
  }
}
```
~~~

**TypeScript type:**
```typescript
interface DeveloperAIResponse {
  summary: string;
  files: AIFileChange[];
  devNotes: {
    whatWasDone: string;
    decisions: string[];
    questions: string[];
  };
}

interface AIFileChange {
  path: string;          // relative to worktree root
  action: 'create' | 'edit';
  content: string;       // complete file content (for create: full file; for edit: full replacement)
}
```

**Parse rules:** Same as F6 — extract ```json block → JSON.parse() → validate fields

**Validation:**
- `summary` must be non-empty string
- `files` must be non-empty array
- Each file must have `path` (non-empty), `action` (`create` or `edit`), `content` (string)
- `devNotes.whatWasDone` must be non-empty string
- `devNotes.decisions` and `devNotes.questions` must be arrays (may be empty)

**Error handling:**
- Same as F6, plus: if `files` is empty, warn "AI returned no file changes. Please retry."

---

### F8. Reviewer AI Response — Format Contract

**Purpose:** AI-generated review feedback that the Reviewer parses and converts to REVIEW.md.

**Expected response format:**
~~~
Here is my review of Step 1:

```json
{
  "verdict": "APPROVED",
  "summary": "The project setup meets all requirements. TypeScript, Express, and Prisma are properly configured.",
  "approvedItems": [
    "TypeScript strict mode is enabled in tsconfig.json",
    "Express server starts on port 3000",
    "ESLint and Prettier are configured and pass"
  ],
  "changesRequired": [],
  "suggestions": [
    "Consider adding a .nvmrc file to pin the Node.js version"
  ],
  "questions": []
}
```
~~~

Or for changes required:

~~~
```json
{
  "verdict": "CHANGES_REQUIRED",
  "summary": "Most requirements are met, but error handling is missing and one test fails.",
  "approvedItems": [
    "Express server starts correctly",
    "TypeScript compiles without errors"
  ],
  "changesRequired": [
    {
      "issue": "Missing error handling middleware",
      "severity": "blocking",
      "description": "The API has no global error handler. Unhandled errors will crash the server.",
      "fix": "Add express error-handling middleware in src/middleware/errorHandler.ts"
    }
  ],
  "suggestions": [
    "Add request logging middleware"
  ],
  "questions": [
    "Should the error response format follow RFC 7807?"
  ]
}
```
~~~

**TypeScript type:** `ReviewDocument` (same as F3, with the addition of `severity` on `ChangeRequired`)

**Extended type:**
```typescript
interface ReviewAIResponse {
  verdict: 'APPROVED' | 'CHANGES_REQUIRED';
  summary: string;
  approvedItems: string[];
  changesRequired: AIChangeRequired[];
  suggestions: string[];
  questions: string[];
}

interface AIChangeRequired {
  issue: string;
  severity: 'blocking' | 'minor';
  description: string;
  fix: string;
}
```

**Parse rules:** Same as F6 — extract ```json block → JSON.parse() → validate fields

**Validation:**
- `verdict` must be exactly `"APPROVED"` or `"CHANGES_REQUIRED"`
- `summary` must be non-empty string
- `approvedItems`, `changesRequired`, `suggestions`, `questions` must be arrays
- If `verdict` is `"CHANGES_REQUIRED"`, `changesRequired` must be non-empty
- Each `changeRequired` must have `issue`, `description`, `fix` (non-empty strings)

---

### Format Summary Table

| Format | File | Written by | Read by | Parse method |
|--------|------|-----------|---------|-------------|
| F1 | PLAN.md | Planner | Developer, Reviewer | State-machine line parser |
| F2 | PROGRESS.md | Developer, Reviewer | Both | Markdown table parser |
| F3 | REVIEW.md | Reviewer | Developer | State-machine line parser |
| F4 | DEV_NOTES.md | Developer | Reviewer | State-machine line parser |
| F5 | DECISIONS.md | Developer | Reviewer | State-machine line parser |
| F6 | AI response | — | Planner | JSON.parse from code fence |
| F7 | AI response | — | Developer | JSON.parse from code fence |
| F8 | AI response | — | Reviewer | JSON.parse from code fence |

---

## Step 1: Monorepo Setup + Shared Types + Format Validation

**Goal:** Initialize the monorepo structure, define all shared TypeScript types (including format contract types), and build the format validation utility.

### Requirements
- Create monorepo-level `package.json` with workspaces pointing to `smart-team-common`, `smart-planner`, `smart-developer`, `smart-reviewer`
- Create `smart-team-common/tsconfig.json` targeting ES2020, CommonJS modules
- Create `smart-team-common/src/index.ts` barrel export (will be extended later)
- Define all shared types in `smart-team-common/src/types.ts`:
  - **Document types** (F1–F5): `PlanDocument`, `PlanStep`, `ProgressDocument`, `ProgressEntry`, `ReviewDocument`, `ChangeRequired`, `DevNotesDocument`, `FileChange`, `DecisionsDocument`, `Decision`
  - **AI response types** (F6–F8): `DeveloperAIResponse`, `AIFileChange`, `ReviewAIResponse`, `AIChangeRequired`
  - **Status types**: `StepStatus` enum (`pending`, `in_progress`, `completed`), status emoji constants
  - **Config types**: `AIProviderConfig`, `GitInfo`
- Create `smart-team-common/src/format-validator.ts`:
  - `extractJSONFromCodeFence(response: string): object` — finds first ```json block, runs JSON.parse(), throws descriptive error on failure
  - `validatePlanDocument(data: unknown): PlanDocument` — type-narrows and validates required fields
  - `validateDeveloperResponse(data: unknown): DeveloperAIResponse` — validates AI response
  - `validateReviewResponse(data: unknown): ReviewAIResponse` — validates AI response
  - Each validator throws `FormatValidationError` with a descriptive message listing missing/invalid fields
- Create stub `package.json` for all three extensions with dependency on smart-team-common

### Implementation Notes
- Keep types pure TypeScript (no VSCode API dependencies) so they're usable in tests and Node.js
- `extractJSONFromCodeFence` is the only function that touches AI raw text — it does simple string search for ` ```json ` and ` ``` `, not regex
- All validators use `typeof` checks and `Array.isArray()` — no runtime schema library needed
- Export `FormatValidationError` as a named class so consumers can catch it specifically

### Files to Create/Modify
- `package.json` — monorepo workspace config
- `smart-team-common/package.json` — library package with `main`/`types` pointing to `out/`
- `smart-team-common/tsconfig.json` — TypeScript config for the library
- `smart-team-common/src/types.ts` — all shared types (F1–F8 TypeScript interfaces)
- `smart-team-common/src/format-validator.ts` — JSON extraction + validation for all formats
- `smart-team-common/src/index.ts` — re-exports types and format-validator
- `smart-planner/package.json` — stub with dependency on smart-team-common
- `smart-developer/package.json` — stub with dependency on smart-team-common
- `smart-reviewer/package.json` — stub with dependency on smart-team-common

### Acceptance Criteria
- [ ] `cd smart-team-common && npm run compile` produces `out/` with compiled types and index
- [ ] All TypeScript types match the format contracts F1–F8 exactly (field names, types, optionality)
- [ ] `extractJSONFromCodeFence` extracts valid JSON from a ```json code block
- [ ] `extractJSONFromCodeFence` throws `FormatValidationError` when no code block found
- [ ] `extractJSONFromCodeFence` throws `FormatValidationError` when JSON is invalid
- [ ] `validatePlanDocument` accepts valid data and rejects missing required fields
- [ ] `validateDeveloperResponse` accepts valid data and rejects missing `files` array
- [ ] `validateReviewResponse` accepts valid data and rejects invalid `verdict` values
- [ ] All three extension package.json files reference smart-team-common as a dependency

### User Verification
After this step, run `npm run compile` in smart-team-common and confirm `out/index.d.ts` exists with all exported types. Then run a quick test: call `extractJSONFromCodeFence` with sample input and verify it returns the parsed object.

---

## Step 2: AI Provider Layer

**Goal:** Build the shared AI provider abstraction that all extensions use to call OpenAI, Anthropic, or Ollama.

### Requirements
- Create `smart-team-common/src/ai/types.ts` — `AIProvider`, `AIRequest`, `AIResponse`, `AIMessage` interfaces
- Create `smart-team-common/src/ai/provider.ts` — abstract `AIProvider` class with `chat()` and `stream()` methods
- Create `smart-team-common/src/ai/openai.ts` — OpenAI provider implementation
- Create `smart-team-common/src/ai/anthropic.ts` — Anthropic provider implementation
- Create `smart-team-common/src/ai/ollama.ts` — Ollama provider implementation (local, no API key)
- Create `smart-team-common/src/ai/factory.ts` — `createProvider(config: AIProviderConfig): AIProvider`
- Update `smart-team-common/src/index.ts` to export AI modules

### Implementation Notes
- Use factory pattern so extensions don't directly instantiate provider implementations
- Support both streaming and non-streaming responses
- Handle API errors gracefully (rate limits, auth failures, network errors)
- Ollama provider uses `http://localhost:11434` by default, configurable
- The `chat()` method returns raw text — **it does not parse the response**. Parsing is the caller's responsibility using `extractJSONFromCodeFence` from Step 1.
- OpenAI provider should use `response_format: { type: "json_object" }` when available for more reliable JSON output, but the caller still uses `extractJSONFromCodeFence` as the universal parser.

### Files to Create/Modify
- `smart-team-common/src/ai/types.ts` — AI-related type definitions
- `smart-team-common/src/ai/provider.ts` — abstract provider base class
- `smart-team-common/src/ai/openai.ts` — OpenAI implementation
- `smart-team-common/src/ai/anthropic.ts` — Anthropic implementation
- `smart-team-common/src/ai/ollama.ts` — Ollama implementation
- `smart-team-common/src/ai/factory.ts` — provider factory
- `smart-team-common/src/index.ts` — add AI exports

### Acceptance Criteria
- [ ] Factory creates correct provider instance based on config
- [ ] Each provider implements `chat()` and returns raw text in `AIResponse.text`
- [ ] Error handling: invalid API key returns descriptive error
- [ ] Ollama provider works without API key
- [ ] All AI modules re-exported from index

### User Verification
Create a quick test script (`smart-team-common/test-ai.mjs`) that imports the factory, creates a provider, and sends a simple prompt. Run with `node test-ai.mjs` to verify the provider connects and returns a response.

---

## Step 3: Document Parsers + Writers

**Goal:** Implement deterministic parsers and template-driven writers for all document formats (F1–F5). No regex — all parsing uses state-machine line matching.

### Requirements

**Parsers** (state-machine, line-by-line):
- `smart-team-common/src/parsers/plan-parser.ts`:
  - `parsePlan(content: string): PlanDocument` — implements F1 parse rules
  - Splits by `\n`, tracks current section by matching heading prefixes (`# `, `## Step`, `### Requirements`, etc.)
  - Extracts `## Step {N}: {title}` via exact prefix match + split on `: ` (not regex)
- `smart-team-common/src/parsers/progress-parser.ts`:
  - `parseProgress(content: string): ProgressDocument` — implements F2 parse rules
  - Locates the table header row by exact match on `| Step | Status | Iteration | Commit |`
  - Parses each data row by splitting on `|` and trimming
- `smart-team-common/src/parsers/review-parser.ts`:
  - `parseReview(content: string): ReviewDocument` — implements F3 parse rules
  - State machine tracks section by `## ` heading match
  - `ChangeRequired` entries parsed by finding `- ` prefix then `  - Fix: ` sub-line
- `smart-team-common/src/parsers/dev-notes-parser.ts`:
  - `parseDevNotes(content: string): DevNotesDocument` — implements F4 parse rules
  - File entries parsed by matching backtick-delimited paths: `` - `path` — description ``
- `smart-team-common/src/parsers/decisions-parser.ts`:
  - `parseDecisions(content: string): DecisionsDocument` — implements F5 parse rules
  - Each `**Field:** value` line parsed by exact prefix match

**Writers** (template-driven, string interpolation):
- `smart-team-common/src/writers/plan-writer.ts`:
  - `writePlan(plan: PlanDocument): string` — produces F1 template output
  - Iterates steps, interpolates into the fixed section structure
- `smart-team-common/src/writers/progress-writer.ts`:
  - `writeProgress(progress: ProgressDocument): string` — produces F2 template output
  - `updateProgressEntry(progress: ProgressDocument, stepIndex: number, update: Partial<ProgressEntry>): ProgressDocument`
- `smart-team-common/src/writers/review-writer.ts`:
  - `writeReview(review: ReviewDocument): string` — produces F3 template output
- `smart-team-common/src/writers/dev-notes-writer.ts`:
  - `writeDevNotes(notes: DevNotesDocument): string` — produces F4 template output
- `smart-team-common/src/writers/decisions-writer.ts`:
  - `writeDecisions(decisions: DecisionsDocument): string` — produces F5 template output
  - `appendDecision(existing: DecisionsDocument, decision: Decision): DecisionsDocument` — appends one decision, auto-increments index
- Barrel exports for all parsers and writers

### Implementation Notes
- **No regex anywhere.** Every parser uses:
  - `line.startsWith(prefix)` for heading/field detection
  - `line.split(delimiter)` for extracting values
  - `line.trim()` for cleanup
  - Section state tracked by a string variable (`currentSection: string`)
- Writers use template literals with explicit section joins, not string concatenation
- All parsers return the TypeScript type directly (validated by the parser, not the caller)
- For F1 parser: `## Step ` prefix match → split on `: ` → index is the number before `:`, title is after
- For F2 parser: table rows split on `|`, skip first and last empty cells from leading/trailing `|`
- For F3 parser: `ChangeRequired` is two lines — `- {issue}: {desc}` and `  - Fix: {fix}`. Track the pending issue until the fix line arrives.
- Empty sections ("None." or blank) produce empty arrays

### Files to Create/Modify
- `smart-team-common/src/parsers/plan-parser.ts`
- `smart-team-common/src/parsers/progress-parser.ts`
- `smart-team-common/src/parsers/review-parser.ts`
- `smart-team-common/src/parsers/dev-notes-parser.ts`
- `smart-team-common/src/parsers/decisions-parser.ts`
- `smart-team-common/src/parsers/index.ts`
- `smart-team-common/src/writers/plan-writer.ts`
- `smart-team-common/src/writers/progress-writer.ts`
- `smart-team-common/src/writers/review-writer.ts`
- `smart-team-common/src/writers/dev-notes-writer.ts`
- `smart-team-common/src/writers/decisions-writer.ts`
- `smart-team-common/src/writers/index.ts`
- `smart-team-common/src/index.ts` — add parser/writer exports

### Acceptance Criteria
- [ ] All parsers and writers compile without errors
- [ ] `parsePlan` correctly extracts steps, goals, requirements, and acceptance criteria from F1 format
- [ ] `parsePlan` handles plan with 1 step and plan with 10+ steps
- [ ] `parsePlan` handles missing optional sections (no Implementation Notes → empty string)
- [ ] `parseProgress` correctly parses the markdown table with status emojis and iteration counts
- [ ] `parseProgress` handles empty table (no steps yet)
- [ ] `parseReview` correctly parses APPROVED and CHANGES_REQUIRED verdicts
- [ ] `parseReview` correctly pairs change-required items with their fix lines
- [ ] `parseDevNotes` correctly extracts file paths from backtick-delimited lines
- [ ] `parseDecisions` correctly extracts all four fields from each decision
- [ ] **Round-trip test: `parsePlan(writePlan(data))` produces equivalent PlanDocument**
- [ ] **Round-trip test: `parseProgress(writeProgress(data))` produces equivalent ProgressDocument**
- [ ] **Round-trip test: `parseReview(writeReview(data))` produces equivalent ReviewDocument**
- [ ] **Round-trip test: `parseDevNotes(writeDevNotes(data))` produces equivalent DevNotesDocument**
- [ ] **Round-trip test: `parseDecisions(writeDecisions(data))` produces equivalent DecisionsDocument**
- [ ] No regex anywhere in any parser file

### User Verification
Run the round-trip tests programmatically: create a `PlanDocument` in memory → write to string → parse back → deep-compare. Do this for all five formats. Log any field-level differences.

---

## Step 4: Git Operations + Diff Utilities

**Goal:** Build shared git operations and diff viewing utilities.

### Requirements
- Create `smart-team-common/src/git/git-operations.ts` — `GitOperations` class:
  - `createBranch(name: string, base?: string): Promise<void>`
  - `checkoutBranch(name: string): Promise<void>`
  - `commit(message: string, files?: string[]): Promise<void>`
  - `getDiff(base?: string): Promise<string>`
  - `getGitStatus(): Promise<GitInfo>`
  - `listBranches(): Promise<string[]>`
  - `deleteBranch(name: string, force?: boolean): Promise<void>`
  - `createWorktree(path: string, branch: string): Promise<void>`
  - `removeWorktree(path: string): Promise<void>`
- Create `smart-team-common/src/git/index.ts` — re-export git operations
- Create `smart-team-common/src/diff/diff-viewer.ts` — `DiffViewer` class:
  - `parseUnifiedDiff(diff: string): DiffBlock[]`
  - `getChangedFiles(diff: string): string[]`
  - `getFileDiff(diff: string, filePath: string): FileDiff | undefined`
  - `summarizeDiff(diff: string): { added: number, removed: number, files: string[] }`
- Create `smart-team-common/src/diff/types.ts` — `DiffBlock`, `FileDiff`, `LineChange` types
- Create `smart-team-common/src/diff/index.ts` — re-export diff utilities
- Update `smart-team-common/src/index.ts` to export git and diff modules

### Implementation Notes
- Use `child_process.exec` for git commands (no external git libraries)
- Handle git errors gracefully (branch exists, worktree path exists, etc.)
- Diff viewer handles standard unified diff format (the output of `git diff`)
- All git operations accept a `cwd` parameter for the working directory
- The diff output from `git diff` is a well-defined format (starts with `diff --git`, has `---`/`+++` headers, `@@` hunks) — the viewer parses this by line prefix matching, not regex

### Files to Create/Modify
- `smart-team-common/src/git/git-operations.ts` — git operations class
- `smart-team-common/src/git/index.ts` — git barrel
- `smart-team-common/src/diff/diff-viewer.ts` — diff parsing and utilities
- `smart-team-common/src/diff/types.ts` — diff-related types
- `smart-team-common/src/diff/index.ts` — diff barrel
- `smart-team-common/src/index.ts` — add git/diff exports

### Acceptance Criteria
- [ ] GitOperations can create, checkout, commit, and delete branches
- [ ] GitOperations can create and remove worktrees
- [ ] GitOperations returns structured diff and status info
- [ ] DiffViewer parses unified diff into structured blocks using line-prefix matching
- [ ] DiffViewer can filter by file and summarize changes
- [ ] All git errors are caught and returned as typed errors

### User Verification
Create a temp directory, initialize a git repo, and run through: create branch → make change → commit → get diff → verify diff content. Then clean up.

---

## Step 5: All Three Extension Scaffolds + Settings + Commands

**Goal:** Create the VSCode extension scaffolds for all three extensions with settings UI, command registration, and activation lifecycle — enabling immediate manual testing of extension loading and configuration.

### Requirements

**Smart Planner Extension:**
- Create `smart-planner/src/extension.ts` — activate, register commands, dispose
- Settings: `smart-planner.aiProvider`, `smart-planner.apiKey`, `smart-planner.model`, `smart-planner.temperature`
- Commands: `smart-planner.generatePlan`, `smart-planner.viewPlan`
- Package.json: extension manifest with contributes.commands, contributes.configuration

**Smart Developer Extension:**
- Create `smart-developer/src/extension.ts` — activate, register commands, dispose
- Settings: `smart-developer.aiProvider`, `smart-developer.apiKey`, `smart-developer.model`, `smart-developer.branchStrategy`
- Commands: `smart-developer.startDevelopment`, `smart-developer.continueDevelopment`, `smart-developer.viewImplementation`
- Package.json: extension manifest

**Smart Reviewer Extension:**
- Create `smart-reviewer/src/extension.ts` — activate, register commands, dispose
- Settings: `smart-reviewer.aiProvider`, `smart-reviewer.apiKey`, `smart-reviewer.model`, `smart-reviewer.autoReview`
- Commands: `smart-reviewer.startReview`, `smart-reviewer.viewReview`
- Package.json: extension manifest

**Shared Extension Patterns:**
- Each extension reads AI settings from VSCode configuration
- Each extension creates provider via `smart-team-common` factory
- Each extension shows status bar item indicating readiness
- All extensions compile with `npm run compile` and bundle with `npm run build`

### Implementation Notes
- Use VSCode's `vscode.workspace.getConfiguration()` for settings
- Register commands via `vscode.commands.registerCommand()`
- Dispose resources properly in deactivate
- Use `vscode.window.showInformationMessage()` for user feedback
- Status bar items show connection status (connected/disconnected)
- Bundle extensions with esbuild for faster loading

### Files to Create/Modify
- `smart-planner/package.json` — full extension manifest
- `smart-planner/tsconfig.json` — TypeScript config for extension
- `smart-planner/src/extension.ts` — planner extension entry point
- `smart-planner/.vscode/launch.json` — debug configuration
- `smart-developer/package.json` — full extension manifest
- `smart-developer/tsconfig.json` — TypeScript config for extension
- `smart-developer/src/extension.ts` — developer extension entry point
- `smart-developer/.vscode/launch.json` — debug configuration
- `smart-reviewer/package.json` — full extension manifest
- `smart-reviewer/tsconfig.json` — TypeScript config for extension
- `smart-reviewer/src/extension.ts` — reviewer extension entry point
- `smart-reviewer/.vscode/launch.json` — debug configuration

### Acceptance Criteria
- [ ] All three extensions compile without errors
- [ ] Each extension can be loaded in VSCode debug mode
- [ ] Settings appear in VSCode Settings UI under each extension's section
- [ ] Commands appear in Command Palette
- [ ] Clicking commands shows "not yet implemented" info message
- [ ] Status bar items show for each active extension

### User Verification
Launch all three extensions in VSCode debug mode (F5):
1. Open Settings → search "smart-" → verify all settings sections appear
2. Open Command Palette (Cmd+Shift+P) → search "smart" → verify all commands appear
3. Click any command → see "not yet implemented" message
4. Check status bar for extension status indicators
5. Change a setting (e.g., aiProvider) → verify it persists

---

## Step 6: Planner — AI Plan Generation

**Goal:** Implement the core planner functionality: generate structured PLAN.md files using AI providers. The AI produces a JSON response per format contract F6, which is parsed by `extractJSONFromCodeFence` and written to PLAN.md via the plan writer.

### Requirements
- Create `smart-planner/src/prompts.ts` — system prompt and user prompt templates:
  - System prompt instructs the AI to act as a plan architect
  - **Critically: the system prompt includes the exact JSON schema from F6** — the AI is told to output a ```json code block with the `PlanDocument` structure
  - User prompt template: `{user_description}\n\nPlease generate a detailed implementation plan as a JSON code block matching the schema.`
- Create `smart-planner/src/plan-generator.ts` — `PlanGenerator` class:
  - `generatePlan(description: string): Promise<PlanDocument>`:
    1. Build prompts from templates
    2. Call `aiProvider.chat(messages)`
    3. Call `extractJSONFromCodeFence(response)` from common's format-validator
    4. Call `validatePlanDocument(parsed)` from common's format-validator
    5. Return validated `PlanDocument`
  - `savePlan(plan: PlanDocument, workspacePath: string): string`:
    1. Call `writePlan(plan)` from common's plan-writer
    2. Write the resulting string to `{workspacePath}/PLAN.md`
    3. Return the file path
- Create `smart-planner/src/plan-viewer.ts` — open PLAN.md in editor, display summary in output panel
- Update `smart-planner/src/extension.ts`:
  - `generatePlan` command: prompt user for description → generatePlan → savePlan → open file
  - `viewPlan` command: find and open existing PLAN.md in workspace

### Implementation Notes
- The system prompt must be explicit about the JSON schema. Include a full example in the prompt (modeled on the F6 example).
- If `extractJSONFromCodeFence` throws `FormatValidationError`, catch it and show a user-friendly error with a "Retry" option.
- The AI may include explanatory text before/after the JSON block — this is expected and handled by `extractJSONFromCodeFence` which only extracts the code fence content.
- Show progress notification during AI generation using `vscode.window.withProgress()`.

### System Prompt Template

```
You are an expert software architect creating implementation plans.

Your task: Generate a detailed implementation plan for the user's project.

OUTPUT FORMAT — You MUST respond with a JSON code block. Example:

​```json
{
  "title": "My Project",
  "overview": "Brief overview...",
  "context": "Existing system description...",
  "steps": [
    {
      "title": "Step Title",
      "goal": "One-line goal for this step",
      "requirements": ["Requirement 1", "Requirement 2"],
      "implementationNotes": "Architectural guidance...",
      "acceptanceCriteria": ["Testable criterion 1", "Testable criterion 2"]
    }
  ]
}
​```

Rules:
- Each step should be implementable in a single focused session (30min-2hrs)
- Requirements must be specific and verifiable
- Acceptance criteria must be testable
- Order steps by dependency (each step builds on previous ones)
- You may include explanatory text before or after the JSON block
```

### Files to Create/Modify
- `smart-planner/src/prompts.ts` — system and user prompt templates with F6 schema
- `smart-planner/src/plan-generator.ts` — plan generation using AI + format validation
- `smart-planner/src/plan-viewer.ts` — plan display utilities
- `smart-planner/src/extension.ts` — wire up commands

### Acceptance Criteria
- [ ] `generatePlan` sends the F6 schema to the AI in the system prompt
- [ ] `extractJSONFromCodeFence` is used to parse the AI response (not custom parsing)
- [ ] `validatePlanDocument` is used to validate the parsed JSON (not ad-hoc checks)
- [ ] Invalid AI response shows a user-friendly error with a "Retry" option
- [ ] `writePlan` from common is used to generate the PLAN.md file (not manual string building)
- [ ] Generated PLAN.md is parseable by `parsePlan` from common (round-trip)
- [ ] Progress notification shows during generation

### User Verification
1. Open VSCode with a test workspace
2. Run `Smart Planner: Generate Plan` → enter "Create a REST API for user management"
3. Wait for generation → verify PLAN.md is created
4. Read PLAN.md → verify it matches F1 format (proper headings, goal lines, requirements, criteria)
5. Run `Smart Planner: View Plan` → verify it opens the file

---

## Step 7: Developer — Implementation Engine

**Goal:** Implement the core developer functionality: read PLAN.md, implement steps via AI, and manage git workflow. The AI produces a JSON response per format contract F7, which is parsed by `extractJSONFromCodeFence`, validated, and applied as file changes.

### Requirements
- Create `smart-developer/src/prompts.ts` — system prompt and user prompt templates:
  - System prompt instructs the AI to act as a developer implementing a specific plan step
  - **The system prompt includes the exact JSON schema from F7** — the AI outputs a ```json code block with `summary`, `files[]`, and `devNotes`
  - The prompt includes the step's requirements and acceptance criteria from PLAN.md (parsed by `parsePlan`)
- Create `smart-developer/src/implementation-engine.ts` — `ImplementationEngine` class:
  - `loadPlan(workspacePath: string): PlanDocument` — uses `parsePlan` from common
  - `getPendingSteps(plan: PlanDocument): PlanStep[]` — filters by `status !== 'completed'`
  - `implementStep(step: PlanStep, planContext: string): Promise<DeveloperAIResponse>`:
    1. Build prompts from templates, including step requirements and acceptance criteria
    2. Call `aiProvider.chat(messages)`
    3. Call `extractJSONFromCodeFence(response)` from common's format-validator
    4. Call `validateDeveloperResponse(parsed)` from common's format-validator
    5. Return validated `DeveloperAIResponse`
  - `applyFiles(response: DeveloperAIResponse, worktreePath: string): string[]`:
    1. For each file in `response.files`: create directories, write file content
    2. Return list of written file paths
  - `writeStepNotes(response: DeveloperAIResponse, step: PlanStep, worktreePath: string): void`:
    1. Build `DevNotesDocument` from `response.devNotes`
    2. Call `writeDevNotes()` from common
    3. Write to `{worktreePath}/DEV_NOTES.md`
  - `commitStep(step: PlanStep, worktreePath: string): Promise<string>`:
    1. Stage all changes
    2. Commit with message: `implement(step): {step.title}`
    3. Return commit hash
- Create `smart-developer/src/git-manager.ts` — `GitManager` class:
  - Uses `GitOperations` from common
  - Creates worktree for implementation
  - Manages branch lifecycle
- Update `smart-developer/src/extension.ts`:
  - `startDevelopment` command: load plan → create branch → implement steps one by one
  - `continueDevelopment` command: resume from last incomplete step
  - `viewImplementation` command: show implementation status in output panel

### Implementation Notes
- The system prompt must include the step's full content (requirements + acceptance criteria) so the AI knows exactly what to implement
- If the AI returns `action: "edit"` for a file, the implementation engine should read the existing file and replace it entirely (full replacement, not patch)
- `DevNotesDocument` is built from the AI response's `devNotes` field, then written using `writeDevNotes` from common — this ensures the output conforms to F4
- PROGRESS.md is updated using `updateProgressEntry` from common's progress-writer after each step
- Show progress for each step being implemented using `vscode.window.withProgress()`

### System Prompt Template

```
You are an expert software developer implementing a specific step from a development plan.

## Your Task
Implement the following step:

**Step:** {step.title}
**Goal:** {step.goal}

**Requirements:**
{step.requirements.map(r => `- ${r}`).join('\n')}

**Acceptance Criteria:**
{step.acceptanceCriteria.map(c => `- [ ] ${c}`).join('\n')}

**Implementation Notes:**
{step.implementationNotes}

## Project Context
{planContext}

## OUTPUT FORMAT
You MUST respond with a JSON code block:

​```json
{
  "summary": "Brief summary of what was implemented",
  "files": [
    {
      "path": "relative/path/to/file.ts",
      "action": "create",
      "content": "complete file content here"
    }
  ],
  "devNotes": {
    "whatWasDone": "What was implemented in this step",
    "decisions": ["Decision 1: rationale", "Decision 2: rationale"],
    "questions": ["Question for the reviewer"]
  }
}
​```

Rules:
- Each file entry must contain the COMPLETE file content (not a diff)
- Use "create" for new files, "edit" for replacing existing files
- File paths are relative to the project root
- The `devNotes.whatWasDone` should summarize what was implemented
- The `devNotes.questions` are for the reviewer's attention
- You may include explanatory text before or after the JSON block
```

### Files to Create/Modify
- `smart-developer/src/prompts.ts` — system and user prompt templates with F7 schema
- `smart-developer/src/implementation-engine.ts` — core implementation logic
- `smart-developer/src/git-manager.ts` — git workflow management
- `smart-developer/src/extension.ts` — wire up commands

### Acceptance Criteria
- [ ] System prompt includes the exact F7 JSON schema
- [ ] `extractJSONFromCodeFence` is used to parse AI response (not custom parsing)
- [ ] `validateDeveloperResponse` is used to validate parsed JSON
- [ ] File changes from AI response are written to the correct paths in the worktree
- [ ] `writeDevNotes` from common is used to write DEV_NOTES.md (ensuring F4 format)
- [ ] `updateProgressEntry` from common is used to update PROGRESS.md
- [ ] Invalid AI response shows a user-friendly error with a "Retry" option
- [ ] `continueDevelopment` resumes from the last incomplete step

### User Verification
1. Use the PLAN.md generated in Step 6
2. Run `Smart Developer: Start Development`
3. Verify a new git branch is created
4. Watch as the first step is implemented (files appear, changes are committed)
5. Read the generated DEV_NOTES.md → verify it matches F4 format
6. Run `Smart Developer: View Implementation` → see step status

---

## Step 8: Reviewer — Review Engine

**Goal:** Implement the core reviewer functionality: compare implementation against plan and generate review feedback. The AI produces a JSON response per format contract F8, which is parsed by `extractJSONFromCodeFence`, validated, and written to REVIEW.md.

### Requirements
- Create `smart-reviewer/src/prompts.ts` — system prompt and user prompt templates:
  - System prompt instructs the AI to act as a code reviewer
  - **The system prompt includes the exact JSON schema from F8** — the AI outputs a ```json code block with `verdict`, `summary`, `approvedItems`, `changesRequired`, `suggestions`, `questions`
  - The prompt includes: step requirements + acceptance criteria (from PLAN.md), git diff, DEV_NOTES.md content
- Create `smart-reviewer/src/review-engine.ts` — `ReviewEngine` class:
  - `loadPlan(workspacePath: string): PlanDocument` — uses `parsePlan` from common
  - `loadProgress(workspacePath: string): ProgressDocument` — uses `parseProgress` from common
  - `loadDevNotes(workspacePath: string): DevNotesDocument | null` — uses `parseDevNotes` from common
  - `getDiff(worktreePath: string): Promise<string>` — uses `GitOperations.getDiff()` from common
  - `reviewStep(step: PlanStep, diff: string, devNotes: DevNotesDocument | null): Promise<ReviewDocument>`:
    1. Build prompts from templates including step content, diff, and dev notes
    2. Call `aiProvider.chat(messages)`
    3. Call `extractJSONFromCodeFence(response)` from common's format-validator
    4. Call `validateReviewResponse(parsed)` from common's format-validator
    5. Convert `ReviewAIResponse` → `ReviewDocument` (map severity into the change-required structure)
    6. Return validated `ReviewDocument`
  - `saveReview(review: ReviewDocument, worktreePath: string): string`:
    1. Call `writeReview(review)` from common's review-writer
    2. Write to `{worktreePath}/REVIEW.md`
    3. Return the file path
  - `generateReport(reviews: ReviewDocument[]): string` — format all reviews into a summary report
- Create `smart-reviewer/src/review-viewer.ts` — display review results in output panel
- Update `smart-reviewer/src/extension.ts`:
  - `startReview` command: load plan → get diff → review step → save review → update PROGRESS.md
  - `viewReview` command: display last review results

### Implementation Notes
- The system prompt must include the step's acceptance criteria so the AI can verify each one against the diff
- The diff is the primary input — the AI compares what was implemented (diff) against what was planned (criteria)
- `DevNotesDocument` is included as context so the AI can verify the developer's claims
- `ReviewDocument` is written using `writeReview` from common — this ensures F3 format compliance
- PROGRESS.md is updated using `updateProgressEntry` from common

### System Prompt Template

```
You are an expert code reviewer evaluating implementation against a development plan.

## Step Being Reviewed
**Step:** {step.title}
**Goal:** {step.goal}

**Requirements:**
{step.requirements.map(r => `- ${r}`).join('\n')}

**Acceptance Criteria:**
{step.acceptanceCriteria.map(c => `- [ ] ${c}`).join('\n')}

## Git Diff
​```diff
{diff}
​```

## Developer Notes
{devNotes ? JSON.stringify(devNotes, null, 2) : "No developer notes provided."}

## Your Task
Review the implementation against the plan requirements and acceptance criteria.

## OUTPUT FORMAT
You MUST respond with a JSON code block:

​```json
{
  "verdict": "APPROVED",
  "summary": "Brief assessment of the implementation",
  "approvedItems": [
    "What was done well — reference specific requirements or criteria"
  ],
  "changesRequired": [],
  "suggestions": [
    "Non-blocking improvement suggestion"
  ],
  "questions": [
    "Clarifying question for the developer"
  ]
}
​```

If changes are needed, use:
​```json
{
  "verdict": "CHANGES_REQUIRED",
  "summary": "Brief assessment",
  "approvedItems": ["..."],
  "changesRequired": [
    {
      "issue": "Short issue title",
      "severity": "blocking",
      "description": "What's wrong",
      "fix": "How to fix it"
    }
  ],
  "suggestions": ["..."],
  "questions": ["..."]
}
​```

Rules:
- `verdict` must be exactly "APPROVED" or "CHANGES_REQUIRED"
- Reference specific acceptance criteria when approving or flagging issues
- `severity` must be "blocking" (must fix) or "minor" (should fix)
- If `verdict` is "CHANGES_REQUIRED", `changesRequired` must not be empty
- You may include explanatory text before or after the JSON block
```

### Files to Create/Modify
- `smart-reviewer/src/prompts.ts` — system and user prompt templates with F8 schema
- `smart-reviewer/src/review-engine.ts` — core review logic
- `smart-reviewer/src/review-viewer.ts` — review display utilities
- `smart-reviewer/src/extension.ts` — wire up commands

### Acceptance Criteria
- [ ] System prompt includes the exact F8 JSON schema
- [ ] System prompt includes the step's acceptance criteria for the AI to verify
- [ ] `extractJSONFromCodeFence` is used to parse AI response
- [ ] `validateReviewResponse` is used to validate parsed JSON
- [ ] `writeReview` from common is used to write REVIEW.md (ensuring F3 format)
- [ ] REVIEW.md is parseable by `parseReview` from common (round-trip)
- [ ] `updateProgressEntry` from common is used to update PROGRESS.md
- [ ] Invalid AI response shows a user-friendly error with a "Retry" option
- [ ] Both APPROVED and CHANGES_REQUIRED paths work correctly

### User Verification
1. After Step 7 implementation, run `Smart Reviewer: Start Review`
2. Verify REVIEW.md is generated
3. Read REVIEW.md → verify it matches F3 format (proper headings, verdict, items)
4. Verify verdict is either APPROVED or CHANGES_REQUIRED
5. Run `Smart Reviewer: View Review` → see results in output panel

---

## Step 9: Planner — Tree View UI

**Goal:** Add a VSCode tree view to the Planner extension for visualizing plan steps and their status.

### Requirements
- Create `smart-planner/src/tree/plan-tree-provider.ts` — `PlanTreeProvider` implements `TreeDataProvider<PlanStepItem>`
  - Each node represents a plan step
  - Icons indicate step status (pending, in_progress, completed)
  - Step title, goal, and status displayed
- Create `smart-planner/src/tree/plan-step-item.ts` — tree item for each step
  - Collapsible to show requirements and acceptance criteria
  - Context menu actions: "View Details", "Mark Complete"
- Create `smart-planner/src/tree/plan-refresh.ts` — refresh tree on plan changes
- Update `smart-planner/package.json`:
  - Add `contributes.views` and `contributes.viewsContainers`
  - Register the tree view in the Explorer or a custom activity bar icon
- Update `smart-planner/src/extension.ts`:
  - Register tree provider on activation
  - Auto-refresh tree when PLAN.md changes

### Implementation Notes
- Use `vscode.TreeDataProvider` interface
- Use `vscode.ThemeIcon` for status icons
- Implement `onDidChangeTreeData` event for live refresh
- Watch PLAN.md file for changes using `vscode.workspace.createFileSystemWatcher`
- Read PLAN.md using `parsePlan` from common — the tree view is populated from the parsed `PlanDocument`, not by re-reading the raw markdown

### Files to Create/Modify
- `smart-planner/src/tree/plan-tree-provider.ts` — tree data provider
- `smart-planner/src/tree/plan-step-item.ts` — tree item class
- `smart-planner/src/tree/plan-refresh.ts` — refresh logic
- `smart-planner/src/tree/index.ts` — barrel export
- `smart-planner/package.json` — add view contributions
- `smart-planner/src/extension.ts` — register tree provider

### Acceptance Criteria
- [ ] Tree view appears in VSCode sidebar
- [ ] Steps are displayed with correct status icons
- [ ] Expanding a step shows requirements and acceptance criteria
- [ ] Tree auto-refreshes when PLAN.md changes
- [ ] Context menu actions work (View Details opens file)

### User Verification
1. With a PLAN.md loaded, check sidebar for the plan tree view
2. Verify steps display with correct icons
3. Expand a step → see requirements
4. Modify PLAN.md → verify tree refreshes

---

## Step 10: Reviewer — Diff Viewer UI

**Goal:** Add a diff viewer UI to the Reviewer extension for visualizing code changes alongside review comments.

### Requirements
- Create `smart-reviewer/src/diff/diff-panel.ts` — `DiffPanel` class:
  - VSCode Webview panel showing diff visualization
  - Side-by-side view of original and modified code
  - Highlight changed lines
- Create `smart-reviewer/src/diff/diff-tree-provider.ts` — `DiffTreeProvider`:
  - Tree view showing changed files
  - Each file node shows review status (pass/fail/warning)
  - Click file to open in diff panel
- Create `smart-reviewer/src/diff/review-decorations.ts` — `ReviewDecorations`:
  - Inline decorations in editor showing review comments
  - Gutters icons for issues found
- Update `smart-reviewer/package.json`:
  - Add view contributions for diff tree
  - Register webview panel command
- Update `smart-reviewer/src/extension.ts`:
  - Register diff panel and tree provider
  - Wire up file selection to open diff panel

### Implementation Notes
- Use `vscode.window.createWebviewPanel()` for the diff view
- Use `vscode.workspace.openTextDocument()` to read file contents
- Highlight additions in green, deletions in red
- Show review comments as annotations on relevant lines
- Use `DiffViewer` from common to parse and structure diffs
- Changed files list comes from `DiffViewer.getChangedFiles()`, not from re-parsing the raw diff

### Files to Create/Modify
- `smart-reviewer/src/diff/diff-panel.ts` — webview diff panel
- `smart-reviewer/src/diff/diff-tree-provider.ts` — file tree provider
- `smart-reviewer/src/diff/review-decorations.ts` — inline decorations
- `smart-reviewer/src/diff/index.ts` — barrel export
- `smart-reviewer/package.json` — add diff view contributions
- `smart-reviewer/src/extension.ts` — register diff components

### Acceptance Criteria
- [ ] Diff tree view shows changed files with review status
- [ ] Clicking a file opens side-by-side diff panel
- [ ] Changed lines are highlighted (green for additions, red for deletions)
- [ ] Review comments appear as inline annotations
- [ ] Decorations appear in the editor gutter

### User Verification
1. After a review is generated, open the diff tree view
2. Click a changed file → verify side-by-side diff opens
3. Verify review comments appear on relevant lines
4. Check editor gutter for issue icons

---

## Step 11: Integration Wiring + End-to-End Pipeline

**Goal:** Wire all three extensions together into a seamless pipeline: Planner → Developer → Reviewer, with cross-extension communication.

### Requirements
- Create cross-extension command integration:
  - Planner `generatePlan` → triggers Developer `startDevelopment` (optional prompt)
  - Developer `startDevelopment` → triggers Reviewer `startReview` after completion (optional prompt)
- Create `smart-team-common/src/events.ts` — shared event types for cross-extension communication:
  - `PlanGenerated` event
  - `ImplementationStarted` event
  - `ImplementationCompleted` event
  - `ReviewCompleted` event
- Use VSCode's `vscode.commands.executeCommand()` for cross-extension calls
- Create a unified status bar that shows pipeline state
- Add `smart-team-common/src/index.ts` final exports

### Implementation Notes
- Use `vscode.commands.executeCommand()` to call commands in other extensions
- Status bar shows: "Planning..." → "Developing..." → "Reviewing..." → "Complete"
- Each extension should handle being invoked without required context gracefully
- Add a "Run Full Pipeline" command that chains all three
- Cross-extension data is passed via file system (PLAN.md, PROGRESS.md) — the extensions don't share in-memory state

### Files to Create/Modify
- `smart-team-common/src/events.ts` — cross-extension event types
- `smart-team-common/src/index.ts` — final barrel export
- `smart-planner/src/extension.ts` — add pipeline integration
- `smart-developer/src/extension.ts` — add pipeline integration
- `smart-reviewer/src/extension.ts` — add pipeline integration

### Acceptance Criteria
- [ ] "Run Full Pipeline" command executes Planner → Developer → Reviewer in sequence
- [ ] Each extension handles cross-extension commands correctly
- [ ] Status bar updates to reflect current pipeline stage
- [ ] Pipeline can be interrupted and resumed
- [ ] Each extension works independently (no hard dependency on others running)

### User Verification
1. Open VSCode with an empty workspace
2. Run `Smart Team: Run Full Pipeline`
3. Enter a project description
4. Watch the pipeline progress through Planning → Developing → Reviewing
5. Verify final PLAN.md, code changes, and REVIEW.md are all created
6. Check status bar showed correct pipeline stages

---

## Step 12: Round-Trip Testing + Polish

**Goal:** Comprehensive testing of the full pipeline, format compliance, error handling, and final polish.

### Requirements

**Format compliance tests:**
- Create `smart-team-common/src/__tests__/format-round-trip.test.ts`:
  - For each document format (F1–F5): create data → write → parse → compare
  - For each AI response format (F6–F8): create valid JSON → wrap in code fence → `extractJSONFromCodeFence` → validate → compare
  - For each AI response format: test error cases (missing code fence, invalid JSON, missing fields)
  - Verify no regex is used anywhere in parser files (static analysis or import check)
- Create `smart-team-common/src/__tests__/parser-edge-cases.test.ts`:
  - PLAN.md with 0 steps, 1 step, 20 steps
  - PLAN.md with missing optional sections (no Implementation Notes)
  - PROGRESS.md with empty table
  - REVIEW.md with CHANGES_REQUIRED and 0 approved items
  - DEV_NOTES.md with empty decisions and questions
  - DECISIONS.md with no decisions yet
  - Malformed inputs: empty string, random text, partial documents

**Git integration tests:**
- Create `smart-team-common/src/__tests__/git-integration.test.ts`:
  - Full git workflow: branch → change → commit → diff → cleanup
  - Worktree create → worktree remove
  - Diff viewer parsing of real git diff output

**AI provider tests:**
- Create `smart-team-common/src/__tests__/ai-provider.test.ts`:
  - Mock AI provider tests for all three providers
  - Error handling tests (timeout, auth failure, network error)

**Integration test scenarios:**
- Create `test-scenarios/` with example files for each format:
  - `test-scenarios/sample-plan.md` — example PLAN.md in F1 format
  - `test-scenarios/sample-progress.md` — example PROGRESS.md in F2 format
  - `test-scenarios/sample-review.md` — example REVIEW.md in F3 format
  - `test-scenarios/sample-dev-notes.md` — example DEV_NOTES.md in F4 format
  - `test-scenarios/sample-decisions.md` — example DECISIONS.md in F5 format
  - `test-scenarios/sample-ai-planner-response.txt` — example AI response in F6 format
  - `test-scenarios/sample-ai-developer-response.txt` — example AI response in F7 format
  - `test-scenarios/sample-ai-reviewer-response.txt` — example AI response in F8 format

**Error handling and polish:**
- Add comprehensive error handling across all extensions:
  - Network errors, API timeouts
  - Git conflicts, worktree path conflicts
  - Missing PLAN.md, malformed markdown
  - Invalid settings, missing API keys
  - AI response format errors (with retry option)
- Polish UI: loading indicators, progress notifications, error messages
- Create README.md for the monorepo with setup instructions

### Implementation Notes
- Use mock AI provider for tests (no real API calls)
- Test git operations in a temp directory
- Use `jest` or `vitest` for unit tests
- Error messages should be user-friendly and actionable
- README should cover: installation, configuration, usage, troubleshooting
- The `test-scenarios/` files serve as both test fixtures and documentation of the expected formats

### Files to Create/Modify
- `smart-team-common/src/__tests__/format-round-trip.test.ts`
- `smart-team-common/src/__tests__/parser-edge-cases.test.ts`
- `smart-team-common/src/__tests__/git-integration.test.ts`
- `smart-team-common/src/__tests__/ai-provider.test.ts`
- `test-scenarios/` — all sample files for formats F1–F8
- `README.md` — monorepo documentation
- All extension source files — error handling polish

### Acceptance Criteria
- [ ] All round-trip tests pass for F1–F5
- [ ] All AI response extraction tests pass for F6–F8
- [ ] All AI response error handling tests pass (missing code fence, invalid JSON, missing fields)
- [ ] All parser edge case tests pass (empty, partial, malformed)
- [ ] All git integration tests pass
- [ ] All AI provider tests pass
- [ ] No regex in any parser file (verified by test or static check)
- [ ] Error handling covers network, git, file, and format errors
- [ ] All error messages include a human-readable description and suggested action
- [ ] `test-scenarios/` files are valid examples of each format
- [ ] README covers setup, configuration, and usage
- [ ] All extensions compile and bundle without errors
- [ ] Full pipeline can be run end-to-end in a test workspace

### User Verification
Full end-to-end test:
1. Clone the repo, run `npm install` in all packages
2. Configure AI settings (provider, API key)
3. Run the full pipeline with a simple project description
4. Verify PLAN.md matches F1 format
5. Verify code is implemented in a git worktree
6. Verify REVIEW.md matches F3 format
7. Try error scenarios: disconnect network, remove API key, delete PLAN.md
8. Verify all error messages are user-friendly

---

## Step Dependencies

```
Step 1 (Types + Format Validation)
  ↓
Step 2 (AI Providers)
  ↓
Step 3 (Document Parsers + Writers)
  ↓
Step 4 (Git + Diff)
  ↓
Step 5 (All Extension Scaffolds) — earliest manual test of extension loading
  ↓           ↓           ↓
Step 6     Step 7     Step 8
(Planner)  (Developer) (Reviewer) — each independently testable
  ↓           ↓           ↓
Step 9     Step 10    Step 11
(Tree UI)  (Diff UI)  (Integration)
  └─────┬───┘           │
        ↓               ↓
       Step 12 (Round-Trip + Polish)
```

Steps 6, 7, and 8 can be tested independently once Step 5 is complete. Steps 9 and 10 can be done in parallel. Step 11 requires 6, 7, 8 to be complete.
