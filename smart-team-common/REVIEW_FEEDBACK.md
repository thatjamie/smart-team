# Review Feedback — Step 3: Parsers

## Summary

Step 3 implements all 5 parsers with clean code, good JSDoc, and zero compilation errors. However, runtime testing against the actual PLAN.md reveals a **critical bug** in `planParser.ts`: the step extraction is too loose — it matches all `##` headings instead of strictly matching only `## Step N:` pattern headings. This causes both false positives (code block examples, non-step sections) and truncated content. The other 4 parsers appear correct.

## ✅ Approved Items

- **`progressParser.ts`**: Correctly parses emoji status (⏳/🔄/✅), iteration N/5, commit hashes, metadata, and Last Action section. Clean STATUS_MAP implementation
- **`devNotesParser.ts`**: Correctly extracts all 7 sections (whatWasImplemented, filesChanged, decisions, questions, feedbackAddressed, feedbackDisputed). Handles em-dash (—), en-dash (–), and hyphen (-) in heading
- **`reviewFeedbackParser.ts`**: Correctly parses summary, approvedItems, changesRequired with checkboxes, suggestions, questions, iteration, and APPROVED/CHANGES_REQUIRED status. Handles emoji section headings
- **`decisionsParser.ts`**: Correctly splits by step headings and extracts decision/context/rationale/date from each block
- **`src/index.ts`**: Barrel export correctly expanded with all 6 parser functions
- **Compilation**: `npm run compile` produces zero errors
- **Error handling**: All parsers return `undefined` or `[]` on error — no thrown exceptions
- **DECISIONS.md**: Properly updated with 3 Step 3 decisions
- **JSDoc**: Every exported function and helper has thorough documentation

## ❌ Changes Required

- [ ] **BUG: `planParser.ts` step extraction is too loose — should only match `## Step N:` headings** (`extractSteps`, lines 120-159): The current regex `^(#{2,})\s+(.+)$` matches ALL `##` headings, including:
  1. **Non-step sections** like `## Overview`, `## Context`, `## References`
  2. **Headings inside markdown code blocks** (format contract examples like `## Last Action`, `## What was implemented`, `## Summary`)
  
  This produces **23 steps instead of the expected 7** when parsing the actual PLAN.md.

  Additionally, the current code slices content between ALL headings (##, ###, etc.), which **truncates step content at `###` sub-sections** like `### Requirements` and `### Implementation Notes`. Step content should include everything until the next `## Step N:` heading.

  **How to fix**: The regex should strictly match only `## Step N: Title` pattern headings. Use the pattern `^##\s+Step\s+\d+[:.]` to identify step boundaries. Then capture all content between consecutive step headings (including `###` sub-sections within each step). For example:
  ```typescript
  // Only match "## Step N: Title" or "## Step N. Title" headings
  const stepRegex = /^##\s+Step\s+\d+[:.]\s+(.+)$/gm;
  // Collect step heading matches
  // Extract ALL content between consecutive step headings (including ### sub-sections)
  ```

  This single fix resolves both problems:
  - Only actual steps are parsed (no false positives from code blocks or non-step sections)
  - Step content includes `###` sub-sections since boundaries are only at `## Step N:` headings

## 💡 Suggestions (Optional)

None.

## ❓ Questions

None.

## Iteration
- Iteration: 1/5
- Status: CHANGES_REQUIRED
