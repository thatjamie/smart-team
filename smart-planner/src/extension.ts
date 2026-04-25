import * as vscode from 'vscode';

/**
 * Activates the Smart Planner extension.
 *
 * Registers chat participant, commands, tree view, and file watchers.
 * Full activation wiring will be completed in Step 6.
 */
export function activate(context: vscode.ExtensionContext): void {
    vscode.window.showInformationMessage('Smart Planner activated');
}

/**
 * Deactivates the Smart Planner extension.
 *
 * Cleans up any active resources (AI connections, file watchers, etc.).
 */
export function deactivate(): void {
    // Cleanup will be added in later steps
}
