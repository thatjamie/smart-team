# Decisions Log — smart-reviewer

## Step 1: Extension Scaffold
- **Decision**: Use `onStartupFinished` activation event
  - **Context**: Plan didn't specify activation events
  - **Rationale**: Extension should be ready when user opens workspace; `onStartupFinished` avoids blocking VSCode startup while ensuring the extension is available
  - **Date**: 2025-04-14

- **Decision**: Register all commands as stubs with info messages
  - **Context**: Step 1 only requires the scaffold; commands are implemented in later steps
  - **Rationale**: Each command (reviewStep, approveStep, etc.) depends on parsers, AI providers, and writers from Steps 2-7. Registering stubs now ensures package.json contributions are correct and the extension loads cleanly.
  - **Date**: 2025-04-14

- **Decision**: Use Feather Icons eye SVG for the icon
  - **Context**: Plan specified "eye/review icon" for `media/icon.svg`
  - **Rationale**: Feather Icons' eye icon is clean, recognizable, and uses `currentColor` so it adapts to VSCode's theme (light/dark)
  - **Date**: 2025-04-14

- **Decision**: Set `@types/vscode` to `^1.90.0` matching `engines.vscode`
  - **Context**: Plan specified VSCode extension
  - **Rationale**: API types should match the minimum engine version to avoid using APIs not available in the target version
  - **Date**: 2025-04-14

- **Decision**: Remove API key settings from contributes.configuration, use SecretStorage only
  - **Context**: Review feedback identified that API keys in contributes.configuration are stored in plaintext settings.json
  - **Rationale**: Plan explicitly says "secret, use vscode.SecretStorage". SecretStorage encrypts keys and keeps them out of settings.json. API keys will be set via a command/UI flow in Step 2.
  - **Date**: 2025-04-14

- **Decision**: Simplify .vscodeignore to avoid conflicting negation patterns
  - **Context**: Review feedback identified that `**/*.ts` undid the `!src/extension.ts` negation
  - **Rationale**: Since `npm run compile` outputs to `out/` (which is not excluded), compiled JS will be packaged. No need to include source files. Clean rules: exclude src, maps, node_modules, dev configs, and markdown; explicitly include media/.
  - **Date**: 2025-04-14

## Step 2: AI Provider Abstraction
- **Decision**: Map system messages to User role in CopilotProvider
  - **Context**: VSCode's Language Model Chat API doesn't have a system message role — only User and Assistant
  - **Rationale**: Sending system instructions as User messages is the standard workaround. The LLM still treats them as instructions. Alternative (prefixing "System:") adds token overhead without clear benefit.
  - **Date**: 2025-04-14

- **Decision**: Extract system messages as separate parameter for Anthropic
  - **Context**: Anthropic's Messages API requires system prompts as a top-level `system` parameter, not in the messages array
  - **Rationale**: This is a hard API requirement, not a choice. The `convertMessages` helper extracts system messages and passes them correctly.
  - **Date**: 2025-04-14

- **Decision**: Default maxTokens of 4096 for all providers
  - **Context**: Plan doesn't specify default token limits
  - **Rationale**: 4096 is sufficient for most review responses while being conservative enough to avoid hitting rate limits. Overrideable via `AiChatOptions.maxTokens`.
  - **Date**: 2025-04-14

- **Decision**: Use static factory method pattern for ProviderFactory
  - **Context**: Need a way to create the right provider based on settings
  - **Rationale**: No state needs to be maintained in the factory — a static `create()` method is simpler than managing a factory instance.
  - **Date**: 2025-04-14

- **Decision**: Return `usage: undefined` from CopilotProvider
  - **Context**: Review feedback identified that `LanguageModelChatResponse` doesn't expose a `usage` property in the current VSCode API types (`@types/vscode@1.115.0`)
  - **Rationale**: The VSCode LM API doesn't expose token counts. Since `AiResponse.usage` is optional, callers already handle `undefined`. If the API adds usage in the future, we can update the provider.
  - **Date**: 2025-04-14

- **Decision**: Use `modelOptions` instead of `maxTokens` in CopilotProvider
  - **Context**: Review feedback identified 8 TSC errors — `maxTokens` is not a valid `LanguageModelChatRequestOptions` property
  - **Rationale**: The correct API is `modelOptions: { maxTokens: N }` — a dictionary of model-specific options. Confirmed against actual type definitions.
  - **Date**: 2025-04-14

- **Decision**: Concatenate multiple system messages in AnthropicProvider
  - **Context**: Review feedback identified that multiple system messages were silently overwritten (only last kept)
  - **Rationale**: Anthropic's API accepts a single `system` string. When the messages array contains multiple system messages (e.g., role instructions + context), they should be joined with `\n\n` rather than discarding earlier ones.
  - **Date**: 2025-04-14

## Step 3: System Prompts
- **Decision**: Use XML-style tags to delimit dynamic context sections
  - **Context**: System prompt injects large blocks of dynamic content (PLAN.md, diff, etc.) alongside instructions
  - **Rationale**: XML tags like `<progress>`, `<dev-notes>`, `<diff>` help the AI distinguish injected content from prompt instructions. This is a common prompting best practice that improves accuracy.
  - **Date**: 2025-04-14

- **Decision**: Make `planFull` optional in ReviewPromptContext
  - **Context**: Full PLAN.md could be very large and bloat the prompt
  - **Rationale**: Most reviews only need the current step's requirements. The full plan is optional for cases where cross-step context matters (e.g., checking if a decision in Step 1 affects Step 5). The caller decides whether to include it.
  - **Date**: 2025-04-14

- **Decision**: Default test/lint results to "No results available" messages
  - **Context**: Test and lint results are optional — they may not be available for every review
  - **Rationale**: Always including these sections ensures the AI knows the categories exist and doesn't wonder whether it missed something. Explicit "not available" is better than absent section.
  - **Date**: 2025-04-14

- **Decision**: Explicitly mirror review-agent skill's REVIEW_FEEDBACK.md format
  - **Context**: The AI needs to produce output compatible with the dev-agent's feedback parsing
  - **Rationale**: Using the exact same format (Summary, ✅ Approved Items, ❌ Changes Required, 💡 Suggestions, ❓ Questions, Iteration, Status) ensures compatibility across the dev-agent/review-agent workflow.
  - **Date**: 2025-04-14

## Step 4: Shared Types
- **Decision**: Use `enum` for `StepStatus` instead of string union
  - **Context**: Need to represent step status (pending, in-progress, complete) across parsers, writers, and tree view
  - **Rationale**: Enum enables switch exhaustiveness checking and IDE autocomplete. String unions are fine for two-value types but `StepStatus` has three values and may grow.
  - **Date**: 2025-04-14

- **Decision**: Zero-based `Step.index` matching array indices
  - **Context**: Steps need a numeric index for reference
  - **Rationale**: Zero-based indices match JavaScript array access patterns used in parsers and tree view. Display can add 1 for user-facing labels.
  - **Date**: 2025-04-14

- **Decision**: `ReviewFeedback.status` as string union, not enum
  - **Context**: Status is either APPROVED or CHANGES_REQUIRED
  - **Context**: Only two values that appear as literal strings in REVIEW_FEEDBACK.md markdown
  - **Rationale**: String union is simpler for a two-value type and matches the literal text parsed from markdown files.
  - **Date**: 2025-04-14

- **Decision**: `ChangesRequiredItem` includes `resolved` boolean
  - **Context**: Need to track which blocking issues have been addressed across review iterations
  - **Rationale**: The `resolved` field allows the tree view to show issue counts and the chat handler to summarize outstanding vs resolved items.
  - **Date**: 2025-04-14

## Step 5: Parsers
- **Decision**: Use regex-based parsing instead of markdown AST library
  - **Context**: Need to parse structured markdown files (PLAN.md, PROGRESS.md, DEV_NOTES.md, etc.)
  - **Rationale**: The markdown formats are simple and well-defined by our own conventions. Adding a markdown AST library (like marked, remark) would add a dependency for minimal benefit. Regex parsing is sufficient and keeps the extension lightweight.
  - **Date**: 2025-04-14

- **Decision**: Graceful degradation — return undefined/empty on missing or malformed files
  - **Context**: Parsers may be called before all workflow files exist
  - **Rationale**: The extension should work even when only some shared state files are present (e.g., PROGRESS.md exists but REVIEW_FEEDBACK.md doesn't). Callers check for undefined rather than handling exceptions.
  - **Date**: 2025-04-14

- **Decision**: Define `DevNotes` and `Decision` interfaces in their respective parser files, not types.ts
  - **Context**: These types are parser-specific output formats, not cross-cutting shared types
  - **Rationale**: `types.ts` contains the canonical data model shared across the whole extension. Parser-specific result types stay co-located with their parsers for discoverability and to avoid bloating types.ts.
  - **Date**: 2025-04-14

- **Decision**: `parsePlan` accepts optional `progressOverrides` Map parameter
  - **Context**: Step statuses come from PROGRESS.md, not PLAN.md itself
  - **Rationale**: The caller reads PROGRESS.md first, then passes status overrides to `parsePlan`. This keeps the plan parser focused on markdown structure while allowing status enrichment.
  - **Date**: 2025-04-14

## Step 6: Git Operations
- **Decision**: Use `spawnSync` instead of `exec` or `execFile`
  - **Context**: Need to run git commands and capture output
  - **Rationale**: `spawnSync` gives control over timeout (30s) and maxBuffer (10MB for large diffs). It also avoids shell injection risks since args are passed as an array.
  - **Date**: 2025-04-14

- **Decision**: All git functions return empty/undefined on error, never throw
  - **Context**: Git operations may fail for various reasons (not a git repo, no commits, etc.)
  - **Rationale**: The extension should degrade gracefully. A failed git command shouldn't crash the review flow. Callers can check for empty results.
  - **Date**: 2025-04-14

- **Decision**: Only read-only operations — no worktree creation, commits, or code modification
  - **Context**: Plan explicitly states "Reviewer does NOT: create worktrees, commit, or modify code"
  - **Rationale**: The reviewer is a passive observer. All git operations are queries (diff, branch, rev-parse). This is a safety guarantee.
  - **Date**: 2025-04-14

- **Decision**: Avoid backticks entirely in git.ts
  - **Context**: TS compilation errors with backticks inside JSDoc comments and some template literal contexts
  - **Rationale**: The ES2022/commonjs target with the current TypeScript version has parsing issues with backticks in certain JSDoc positions. Using string concatenation is safer and compiles cleanly.
  - **Date**: 2025-04-14

## Step 7: Markdown File Writers
- **Decision**: Use Unicode escape sequences for emojis in writer output
  - **Context**: Need to output emoji characters (✅, ❌, 💡, ❓, 🔄, ⏳) in markdown files
  - **Rationale**: Unicode escapes (\u2705, \u274C, etc.) are unambiguous and avoid potential encoding issues across different systems and editors. They compile cleanly in TS source.
  - **Date**: 2025-04-14

- **Decision**: Immutable state update pattern for Progress manipulation
  - **Context**: Reviewer needs to update step status and last action before writing PROGRESS.md
  - **Rationale**: `updateProgressStep()` and `updateLastAction()` return new objects instead of mutating. This is safer when state flows through multiple transformations (update status -> update last action -> write). Also makes debugging easier.
  - **Date**: 2025-04-14

- **Decision**: Full file reconstruction for writeProgress instead of partial edits
  - **Context**: Could edit PROGRESS.md in-place (find/replace step row) or reconstruct entirely
  - **Rationale**: Reconstructing from the Progress object is simpler, less error-prone, and guarantees consistent output format. The file is small (<30 lines) so performance is not a concern.
  - **Date**: 2025-04-14

## Step 8: Sidebar TreeView
- **Decision**: 5-section tree structure (Plan, Worktree, Current Step, Review Files, All Steps)
  - **Context**: Plan shows a dashboard example with plan info, current step, review files, and all steps
  - **Rationale**: Separating into sections keeps the tree organized and scannable. Users can expand only the section they care about.
  - **Date**: 2025-04-14

- **Decision**: No caching — re-parse on every getChildren call
  - **Context**: Tree data comes from markdown files that change frequently during reviews
  - **Rationale**: The tree is small (5-15 steps, 3 files). Re-parsing ensures the view always reflects the latest state. File watchers (added in Step 12) will trigger refresh. Caching adds complexity with little benefit for this data size.
  - **Date**: 2025-04-14

- **Decision**: File items clickable via vscode.open, step items open PLAN.md
  - **Context**: Plan says "File items show summaries and are clickable" and "Step items clickable"
  - **Rationale**: `vscode.open` is the standard VSCode command for opening files. Steps open PLAN.md since that's where their content lives.
  - **Date**: 2025-04-14

- **Decision**: Use vscode.ThemeIcon instead of custom SVG icons
  - **Context**: Need icons for different item types (plan, file, step status)
  - **Rationale**: ThemeIcons are built into VSCode, work across all themes, and support semantic color tokens (charts.green, charts.blue, errorForeground). No custom icon files needed.
  - **Date**: 2025-04-14

## Step 9: Diff Viewer
- **Decision**: Delegate to git.ts functions instead of reimplementing git commands
  - **Context**: Need `getDiff` for full diff and `getLatestDiff` for iteration diffs
  - **Rationale**: git.ts already has the correct git invocations with error handling, fallbacks, and base branch detection. No need to duplicate that logic.
  - **Date**: 2025-04-14

- **Decision**: Use untitled document with language 'diff' for diff display
  - **Context**: Need to show diff output with syntax highlighting
  - **Rationale**: `vscode.workspace.openTextDocument({ language: 'diff' })` is the simplest approach. It provides syntax highlighting without needing custom editors or virtual documents. Opens in `ViewColumn.Beside` for side-by-side viewing.
  - **Date**: 2025-04-14

## Step 10: Chat Handler
- **Decision**: Pass secretStorage as parameter from extension.ts
  - **Context**: Need SecretStorage for API keys but ChatRequest doesn't have a context property
  - **Rationale**: VSCode's ChatRequest type doesn't expose secretStorage. The extension's activate function has access to `context.secrets`, so it passes it as a parameter to the chat handler. This is cleaner than storing it in a global.
  - **Date**: 2025-04-14

- **Decision**: Default to reviewing the current in-progress step
  - **Context**: User may not specify a step number
  - **Rationale**: The most common use case is reviewing whatever step is currently being worked on. If no step is in progress, require the user to specify a step number.
  - **Date**: 2025-04-14

- **Decision**: Parse AI response into structured ReviewFeedback inline
  - **Context**: AI returns markdown text that needs to be structured for writing REVIEW_FEEDBACK.md
  - **Rationale**: The AI is instructed to use specific headings and formats. Regex-based extraction works well for this structured output. Using the same approach as the file parsers keeps the code consistent.
  - **Date**: 2025-04-14

- **Decision**: Non-modal user approval via showInformationMessage
  - **Context**: Need user confirmation before writing files
  - **Rationale**: Non-modal allows the user to review the AI output in the chat before deciding. The message stays visible until dismissed. A modal dialog would force immediate decision without review context.
  - **Date**: 2025-04-14
