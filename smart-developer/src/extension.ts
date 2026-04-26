/**
 * Extension entry point for Smart Developer.
 *
 * Activates the dev-agent chat participant, sidebar tree view,
 * commands, file watchers, and SecretStorage for API keys.
 */

import * as vscode from 'vscode';

/**
 * Called when the extension is activated (on startup).
 * @param context - The extension context provided by VSCode.
 */
export function activate(context: vscode.ExtensionContext): void {
    // Full activation wiring will be implemented in Step 6.
    // For now, register a placeholder to confirm the extension loads.
    void context;
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
    // Cleanup will be implemented in Step 6.
}
