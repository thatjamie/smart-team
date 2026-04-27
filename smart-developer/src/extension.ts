/**
 * Extension entry point for Smart Developer.
 *
 * Activates the dev-agent chat participant, sidebar tree view,
 * commands, file watchers, and SecretStorage for API keys.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { findPlanFile, findDevWorktree, getProjectRoot } from 'smart-team-common';
import { StepTreeProvider } from './providers/stepTreeProvider';
import { handleChatRequest } from './chatHandler';

/**
 * Called when the extension is activated (on startup).
 * @param context - The extension context provided by VSCode.
 */
export function activate(context: vscode.ExtensionContext): void {
    try {
        activateInternal(context);
    } catch (err) {
        vscode.window.showErrorMessage(
            `Smart Developer activation failed: ${err instanceof Error ? err.message : String(err)}`
        );
    }
}

function activateInternal(context: vscode.ExtensionContext): void {

    // ─── 1. Detect workspace ─────────────────────────────────────────────
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;

    // ─── 2. Create and register TreeView ─────────────────────────────────
    const treeProvider = new StepTreeProvider(workspaceRoot);
    const treeView = vscode.window.createTreeView('smart-developer-steps', {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
    });
    context.subscriptions.push(treeView);

    // ─── 3. Register chat participant (guarded) ──────────────────────────
    if (vscode.chat && typeof vscode.chat.createChatParticipant === 'function') {
        try {
            const chatParticipant = vscode.chat.createChatParticipant(
                'smart-developer',
                async (request, chatContext, stream) => {
                    await handleChatRequest(request, chatContext, stream, context.secrets);
                }
            );
            chatParticipant.iconPath = vscode.Uri.file(
                path.join(context.extensionPath, 'media', 'icon.svg')
            );
            context.subscriptions.push(chatParticipant);
        } catch (err) {
            console.warn('Smart Developer: Chat participant registration failed.', err);
        }
    } else {
        console.warn('Smart Developer: vscode.chat API not available. Chat commands disabled.');
    }

    // ─── 4. Register palette commands ────────────────────────────────────

    // Start Step — triggers /implement via chat
    context.subscriptions.push(
        vscode.commands.registerCommand('smart-developer.startStep', async () => {
            const stepNumber = await vscode.window.showInputBox({
                prompt: 'Enter step number to implement',
                placeHolder: 'e.g., 1',
                validateInput: (value) => {
                    const num = parseInt(value, 10);
                    if (isNaN(num) || num < 1) {
                        return 'Please enter a valid step number (1 or greater)';
                    }
                    return undefined;
                },
            });
            if (stepNumber) {
                await vscode.commands.executeCommand('workbench.action.chat.open', `@smart-developer /implement ${stepNumber}`);
            }
        })
    );

    // Commit Step — triggers /commit via chat
    context.subscriptions.push(
        vscode.commands.registerCommand('smart-developer.commitStep', async () => {
            await vscode.commands.executeCommand('workbench.action.chat.open', '@smart-developer /commit');
        })
    );

    // Address Feedback — triggers /feedback via chat
    context.subscriptions.push(
        vscode.commands.registerCommand('smart-developer.addressFeedback', async () => {
            await vscode.commands.executeCommand('workbench.action.chat.open', '@smart-developer /feedback');
        })
    );

    // Open Worktree — open the worktree folder in explorer
    context.subscriptions.push(
        vscode.commands.registerCommand('smart-developer.openWorktree', async () => {
            if (!workspaceRoot) {
                vscode.window.showWarningMessage('No workspace folder open.');
                return;
            }
            const projectRoot = getProjectRoot(workspaceRoot);
            if (!projectRoot) {
                vscode.window.showWarningMessage('Not inside a git repository.');
                return;
            }
            const worktreeInfo = findDevWorktree(projectRoot);
            if (worktreeInfo?.exists) {
                await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(worktreeInfo.path), true);
            } else {
                vscode.window.showWarningMessage('No dev worktree found.');
            }
        })
    );

    // Refresh — refresh the sidebar tree
    context.subscriptions.push(
        vscode.commands.registerCommand('smart-developer.refresh', () => {
            treeProvider.refresh();
        })
    );

    // Settings — open extension settings
    context.subscriptions.push(
        vscode.commands.registerCommand('smart-developer.settings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'smart-developer');
        })
    );

    // Set API Key — prompt for provider-specific API key
    context.subscriptions.push(
        vscode.commands.registerCommand('smart-developer.setApiKey', async () => {
            const config = vscode.workspace.getConfiguration('smart-developer');
            const provider = config.get<string>('aiProvider', 'copilot');

            if (provider === 'copilot') {
                vscode.window.showInformationMessage('GitHub Copilot does not require an API key.');
                return;
            }

            const keyName = provider === 'anthropic'
                ? 'smart-developer.anthropicApiKey'
                : 'smart-developer.openaiApiKey';
            const label = provider === 'anthropic' ? 'Anthropic' : 'OpenAI';

            const existingKey = await context.secrets.get(keyName);
            if (existingKey) {
                const overwrite = await vscode.window.showInformationMessage(
                    `An ${label} API key is already set. Update it?`,
                    'Update', 'Cancel'
                );
                if (overwrite !== 'Update') {
                    return;
                }
            }

            const apiKey = await vscode.window.showInputBox({
                prompt: `Enter your ${label} API key`,
                password: true,
                ignoreFocusOut: true,
            });

            if (apiKey) {
                await context.secrets.store(keyName, apiKey);
                vscode.window.showInformationMessage(`${label} API key stored securely.`);
            }
        })
    );

    // ─── 5. Register file watchers ───────────────────────────────────────
    const watchedFiles = [
        'PLAN.md',
        'PROGRESS.md',
        'DEV_NOTES.md',
        'DECISIONS.md',
        'REVIEW_FEEDBACK.md',
    ];

    if (workspaceRoot) {
        for (const fileName of watchedFiles) {
            const pattern = new vscode.RelativePattern(
                vscode.Uri.file(workspaceRoot),
                `**/${fileName}`
            );
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);
            watcher.onDidChange(() => treeProvider.refresh());
            watcher.onDidCreate(() => treeProvider.refresh());
            watcher.onDidDelete(() => treeProvider.refresh());
            context.subscriptions.push(watcher);
        }
    }

    // ─── 6. Workspace folder change handler ─────────────────────────────
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            treeProvider.refresh();
        })
    );
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
    // Cleanup is handled by context.subscriptions disposal
}
