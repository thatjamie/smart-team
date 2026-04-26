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
