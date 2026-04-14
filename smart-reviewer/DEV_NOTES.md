# Dev Notes — Step 1: Extension Scaffold

## What was implemented
- Complete VSCode extension scaffold for Smart Reviewer
- `package.json` manifest with all required contributions (activity bar, sidebar view, chat participant, commands, settings)
- `tsconfig.json` targeting ES2022 with commonjs module system
- `.vscodeignore` for clean packaging (excludes source, maps, dev files)
- `.gitignore` for standard Node/VSCode extension ignores
- Entry point `src/extension.ts` with activate/deactivate stubs
- `media/icon.svg` — eye/review icon (Feather Icons style)

## Files changed
- `smart-reviewer/package.json` — Full extension manifest with all contributions from the plan
- `smart-reviewer/tsconfig.json` — TypeScript config (ES2022, commonjs, strict mode)
- `smart-reviewer/.vscodeignore` — Packaging exclusions
- `smart-reviewer/.gitignore` — Git ignores for out/, node_modules/, *.vsix
- `smart-reviewer/src/extension.ts` — Entry point with activate/deactivate, chat participant registration, command stubs
- `smart-reviewer/media/icon.svg` — Eye icon for activity bar

## Decisions made
- Used `onStartupFinished` as activation event so the extension loads automatically without requiring a specific file type
- All 8 commands registered as stubs (show info messages) — full implementations are in later steps
- Chat participant registered with `/review` and `/status` sub-commands per plan
- `secretStorage` variable is initialized but API key storage logic deferred to Step 2 (AI providers)
- Tree view sidebar registered in package.json contributes but data provider implementation deferred to Step 8

## Questions for reviewer
- Should the `.vscodeignore` also exclude test files? Currently tests aren't in scope for Step 1.
- Is the `secretStorage` reference in activate() acceptable even though it's unused? It's a placeholder for Step 2.
