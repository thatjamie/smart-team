import * as vscode from 'vscode';

/**
 * Activate the Smart Reviewer extension.
 * Registers all commands, chat participant, sidebar tree view, and file watchers.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('Smart Reviewer extension is activating...');

    // Secret storage for API keys
    const secretStorage = context.secrets;

    // Register chat participant
    const chatParticipant = vscode.chat.createChatParticipant(
        'smart-reviewer',
        async (request: vscode.ChatRequest, chatContext: vscode.ChatContext, response: vscode.ChatResponseStream, token: vscode.CancellationToken) => {
            response.markdown('Smart Reviewer is ready. Use `/review` to review a step or `/status` to check progress.');
        }
    );
    chatParticipant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.svg');
    context.subscriptions.push(chatParticipant);

    // Register commands (stubs — will be implemented in later steps)
    const commands: [string, (...args: any[]) => any][] = [
        ['smart-reviewer.reviewStep', async () => {
            vscode.window.showInformationMessage('Smart Reviewer: Review Step — not yet implemented');
        }],
        ['smart-reviewer.approveStep', async () => {
            vscode.window.showInformationMessage('Smart Reviewer: Approve Step — not yet implemented');
        }],
        ['smart-reviewer.requestChanges', async () => {
            vscode.window.showInformationMessage('Smart Reviewer: Request Changes — not yet implemented');
        }],
        ['smart-reviewer.viewDiff', async () => {
            vscode.window.showInformationMessage('Smart Reviewer: View Full Diff — not yet implemented');
        }],
        ['smart-reviewer.viewDiffLatest', async () => {
            vscode.window.showInformationMessage('Smart Reviewer: View Latest Diff — not yet implemented');
        }],
        ['smart-reviewer.openWorktree', async () => {
            vscode.window.showInformationMessage('Smart Reviewer: Open Dev Worktree — not yet implemented');
        }],
        ['smart-reviewer.refresh', async () => {
            vscode.window.showInformationMessage('Smart Reviewer: Refresh — not yet implemented');
        }],
        ['smart-reviewer.settings', async () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'smart-reviewer');
        }],
    ];

    for (const [commandId, handler] of commands) {
        context.subscriptions.push(vscode.commands.registerCommand(commandId, handler));
    }

    // Register sidebar tree view (stub — will be implemented in Step 8)
    const treeDataProvider = new vscode.TreeDataProvider<vscode.TreeItem>() as any;
    // Placeholder until Step 8 implements the full ReviewTreeProvider

    console.log('Smart Reviewer extension activated successfully.');
}

/**
 * Deactivate the Smart Reviewer extension.
 */
export function deactivate(): void {
    console.log('Smart Reviewer extension deactivated.');
}
