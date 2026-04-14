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
