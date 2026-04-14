# Review Feedback — Step 1: Extension Scaffold

## Summary
The extension scaffold is well-structured and covers nearly all plan requirements. The package.json manifest is comprehensive with all commands, settings, activity bar, sidebar view, and chat participant correctly declared. However, there is a **blocking TypeScript compilation error** that prevents building or packaging. There are also a few correctness issues in the code and manifest that need fixing.

## ✅ Approved Items
- **package.json manifest**: All 8 commands registered with correct IDs matching the plan (`reviewStep`, `approveStep`, `requestChanges`, `viewDiff`, `viewDiffLatest`, `openWorktree`, `refresh`, `settings`) ✅
- **Activity Bar**: Correctly configured with `smart-reviewer` container, eye icon ✅
- **Sidebar TreeView**: `smart-reviewer-overview` view registered in the correct views container ✅
- **Chat Participant**: `@smart-reviewer` with `/review` and `/status` sub-commands ✅
- **Settings**: All 5 settings correctly declared with proper types, enums, and defaults matching plan ✅
- **tsconfig.json**: Correct target (ES2022), module (commonjs), strict mode ✅
- **Dependencies**: `@anthropic-ai/sdk` and `openai` in dependencies; `@types/vscode` and `typescript` in devDependencies ✅
- **media/icon.svg**: Clean Feather Icons eye SVG using `currentColor` for theme adaptability ✅
- **.vscodeignore**: Reasonable packaging exclusions ✅
- **.gitignore**: Standard Node/VSCode extension ignores ✅
- **Command stubs**: Appropriate approach for Step 1 — all 8 commands registered as stubs ✅
- **Chat participant handler**: Basic stub with helpful message ✅
- **DECISIONS.md**: All decisions properly logged with context and rationale ✅
- **PROGRESS.md**: Correctly tracks state with iteration 1/5 ✅

## ❌ Changes Required

- [ ] **BLOCKING — TypeScript compilation error** (`src/extension.ts:56`):
  ```typescript
  const treeDataProvider = new vscode.TreeDataProvider<vscode.TreeItem>() as any;
  ```
  `TreeDataProvider` is an **interface**, not a class — you cannot `new` an interface. This causes `tsc` to fail with `TS2339: Property 'TreeDataProvider' does not exist on type 'typeof import("vscode")'`. This blocks both compilation (`npm run compile`) and packaging (`vsce package`).
  
  **Fix**: Remove this line entirely. A TreeDataProvider is not needed until Step 8. The sidebar view declaration in `package.json` is sufficient for the scaffold — the view will simply show as empty until a provider is registered during activation in a later step. The current line does nothing useful (it creates a variable that's never used and is cast to `any`).

- [ ] **`.vscodeignore` is overly aggressive — excludes `src/extension.ts` via conflicting rules** (`.vscodeignore:4`):
  ```
  src/**
  !src/extension.ts    ← This try-to-include is undermined by line 5
  **/*.ts              ← This re-excludes ALL .ts files including src/extension.ts
  ```
  The `!src/extension.ts` negation on line 4 is immediately undone by `**/*.ts` on line 5. In gitignore/vscodeignore semantics, later patterns take precedence — so `**/*.ts` wins and `src/extension.ts` is excluded. The package would contain only `out/extension.js` (compiled), which is fine for runtime, but the intent of the negation is defeated. Additionally, `src/**` on line 3 is also redundant since `**/*.ts` on line 5 already covers it.

  **Fix**: Simplify `.vscodeignore` to:
  ```
  .vscode/**
  .vscode-test/**
  src/**
  **/*.map
  node_modules/**
  .gitignore
  tsconfig.json
  **/*.md
  !media/**
  ```
  Since `npm run compile` outputs to `out/`, and `out/` is not excluded, the compiled JS will be packaged. No need to include source files or fight with negations.

- [ ] **API key settings should not be plain string settings** (`package.json:111-122`):
  The plan explicitly states: `"smart-reviewer.anthropicApiKey" — string (secret, use vscode.SecretStorage)` and `"smart-reviewer.openaiApiKey" — string (secret, use vscode.SecretStorage)`. Declaring these as regular `string` settings in `contributes.configuration` means they are stored **in plaintext** in `settings.json`. This is a security concern.
  
  **Fix**: Remove `smart-reviewer.anthropicApiKey` and `smart-reviewer.openaiApiKey` from `contributes.configuration`. The `secretStorage` reference in `activate()` is the correct approach — the extension should provide a command or UI flow (in a later step) to store/retrieve API keys via `context.secrets`. The model name settings (`anthropicModel`, `openaiModel`) can stay as regular settings since they're not secrets.

- [ ] **`secretStorage` variable is declared but unused** (`src/extension.ts:11`):
  ```typescript
  const secretStorage = context.secrets; // never referenced again
  ```
  This triggers a TypeScript strict-mode warning (`'secretStorage' is declared but its value is never read`). While it's a placeholder for Step 2, unused variables add noise.
  
  **Fix**: Remove this line. It will be re-introduced in Step 2 when the AI providers are implemented and actually need to read API keys from SecretStorage.

## 💡 Suggestions (Optional)

- **Consider adding `"enableProposedApi": false`** to package.json explicitly to signal this extension uses only stable APIs. Not required, but good practice.

- **The `eslint` script in package.json** (`"lint": "eslint src --ext ts"`) references ESLint but it's not listed in devDependencies. Not blocking for Step 1 since there's minimal code, but you'll want to add `eslint` and `@typescript-eslint/*` packages when linting becomes important in later steps.

- **The `.vscodeignore` excludes `**/*.md`** which means PROGRESS.md, DECISIONS.md etc. won't be in the packaged extension — that's correct since those are dev-workflow files, not extension files. Good.

## ❓ Questions

1. **TreeDataProvider stub**: Why was a TreeDataProvider instantiation attempted in Step 1 when the plan explicitly defers it to Step 8? It adds a compilation error without any benefit. Was this left over from an earlier attempt?

2. **`.vscodeignore` line `!media/icon.svg`**: The current file has `!media/icon.svg` on line 11, but since there's no preceding exclusion that targets `media/`, this negation is a no-op. The `media/` directory isn't excluded by any of the other patterns, so `media/icon.svg` will be included regardless. This isn't harmful, just unnecessary.

## Iteration
- Iteration: 1/5
- Status: CHANGES_REQUIRED
