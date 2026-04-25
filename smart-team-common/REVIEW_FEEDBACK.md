# Review Feedback — Step 3: Parsers

## Summary

Step 3 iteration 2 fixes the planParser strict matching bug. All 5 parsers compile cleanly and the planParser correctly extracts 7 steps from the actual PLAN.md. However, an important piece is missing: the **plan context** (everything before the first step — Overview, Context, Tech Stack, Conventions, References) is discarded by the parser. This context is essential reference material for `smart-developer` and `smart-reviewer` to understand the project. The `Plan` type and `parsePlan` function need to be enhanced to capture and expose this.

## ✅ Approved Items

- **`planParser.ts` step extraction fixed**: Strict `## Step N:` matching, code blocks stripped, `###` sub-sections included in step content. Runtime verified: 7 steps with full content ✅
- **`progressParser.ts`**: Correctly parses emoji status, iteration, commit hashes, metadata, Last Action
- **`devNotesParser.ts`**: Correctly extracts all 7 sections including feedback addressed/disputed
- **`reviewFeedbackParser.ts`**: Correctly parses all review feedback sections including checkbox items
- **`decisionsParser.ts`**: Correctly extracts decision entries grouped by step
- **`src/index.ts`**: Barrel export correctly expanded with all 6 parser functions
- **Compilation**: `npm run compile` produces zero errors
- **Error handling**: All parsers return `undefined` or `[]` on error

## ❌ Changes Required

- [ ] **`Plan` interface and `planParser` missing plan context** (`src/types.ts` and `src/parsers/planParser.ts`): The `Plan` interface only stores `name`, `filePath`, and `steps` — but the content **before the first `## Step N:` heading** is discarded. This includes critical reference material like:
  - Overview
  - Context (existing system, tech stack, conventions, build order)
  - References
  
  Both `smart-developer` and `smart-reviewer` need this context to understand the project's architecture and constraints.

  **How to fix**:
  1. Add a `context` field to the `Plan` interface in `src/types.ts`:
     ```typescript
     export interface Plan {
         /** Plan name (derived from directory or explicit title) */
         name: string;
         /** Absolute path to PLAN.md */
         filePath: string;
         /** All content before the first step heading (Overview, Context, Tech Stack, etc.) */
         context: string;
         /** Parsed steps from the plan */
         steps: Step[];
     }
     ```
  2. In `extractSteps()` or `parsePlan()`, capture all content before the first `## Step N:` heading as the `context` string.
  3. Update `parsePlan()` to set `context` on the returned `Plan` object (including the error fallback path).

## 💡 Suggestions (Optional)

None.

## ❓ Questions

None.

## Iteration
- Iteration: 2/5
- Status: CHANGES_REQUIRED
