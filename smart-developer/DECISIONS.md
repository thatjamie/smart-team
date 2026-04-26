# Decisions Log — smart-developer

## Step 1: Extension Scaffold
- **Decision**: Use `onStartupFinished` activation event
  - **Context**: Extension needs to be available immediately for chat participant and sidebar
  - **Rationale**: `onStartupFinished` ensures the extension loads after VSCode is ready, avoiding slow startup while still being immediately available. No specific activation trigger is better since the extension should always be active in a workspace.
  - **Date**: 2025-04-26

- **Decision**: Code brackets SVG icon for activity bar
  - **Context**: PLAN.md says "code/terminal icon" for the activity bar container
  - **Rationale**: Simple `< />` code brackets design is universally recognizable, renders well at small sizes, and matches VSCode's design language
  - **Date**: 2025-04-26

- **Decision**: Exclude most source from VSIX, keep extension.ts and types.ts
  - **Context**: `.vscodeignore` controls what ships in the packaged extension
  - **Rationale**: Compiled JS in `out/` is the runtime code. Keeping `extension.ts` and `types.ts` allows downstream type consumers to reference the source if needed
  - **Date**: 2025-04-26

## Step 2: System Prompt
- **Decision**: Use markdown headings (#, ##) for system prompt structure
  - **Context**: System prompt needs clear sections for the AI to parse
  - **Rationale**: Markdown headings are the most natural format for LLM consumption — they create clear visual and semantic boundaries between prompt sections
  - **Date**: 2025-04-26

- **Decision**: 9 core rules in the system prompt
  - **Context**: AI needs explicit behavioral boundaries
  - **Rationale**: Comprehensive rules covering step boundaries, conventions, output format, error handling, documentation, secrets, ambiguity resolution, and output-only-XML requirement leave minimal room for deviation
  - **Date**: 2025-04-26

- **Decision**: Conditional dynamic context sections
  - **Context**: Not all context fields are always available (e.g., review feedback only for iterations > 1)
  - **Rationale**: Including empty sections wastes tokens and could confuse the AI. Only non-empty context sections are injected into the prompt
  - **Date**: 2025-04-26

## Step 3: Context Builder and File Applier
- **Decision**: File tree max depth of 4
  - **Context**: PLAN.md says "Maximum depth for file tree" is a dev-agent decision
  - **Rationale**: Depth 4 covers most project structures (e.g., `src/module/subdir/file.ts`) without overwhelming the AI context. Deeper trees cost more tokens with diminishing returns.
  - **Date**: 2025-04-26

- **Decision**: Max 10 existing files in context
  - **Context**: PLAN.md says "Maximum number of existing files to include" is a dev-agent decision
  - **Rationale**: 10 files provides enough reference material for the AI to understand conventions without exceeding typical context windows. Files are selected by relevance (referenced in step content).
  - **Date**: 2025-04-26

- **Decision**: Skip hidden files/dirs in file tree
  - **Context**: File tree should show useful project structure, not config clutter
  - **Rationale**: Hidden directories (`.git`, `.vscode`, etc.) are rarely relevant to implementation and add noise to the file tree
  - **Date**: 2025-04-26
