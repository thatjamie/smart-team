import * as vscode from 'vscode';
import * as path from 'path';
import { ChatHandler } from './chatHandler';
import { PlannerTreeProvider } from './providers/plannerTreeProvider';

/**
 * Activates the Smart Planner extension.
 *
 * Registers chat participant, commands, tree view, and file watchers.
 */
export function activate(context: vscode.ExtensionContext): void {
    // 1. Resolve project root (setting → workspace root)
    const projectRoot = resolveProjectRoot();

    // 2. Create the chat handler (inject SecretStorage for API keys)
    const chatHandler = new ChatHandler(context.secrets);

    // 3. Create tree provider and register tree view
    const treeProvider = new PlannerTreeProvider(projectRoot);
    const treeView = vscode.window.createTreeView('smart-planner-overview', {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
    });
    context.subscriptions.push(treeView);

    // 4. Register chat participant
    const participant = vscode.chat.createChatParticipant('smart-planner', (
        request: vscode.ChatRequest,
        chatContext: vscode.ChatContext,
        response: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ) => chatHandler.handleRequest(request, chatContext, response, token));
    context.subscriptions.push(participant);

    // 5. Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('smart-planner.startPlanning', () => {
            vscode.commands.executeCommand('workbench.action.chat.open', '@smart-planner /plan');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('smart-planner.updatePlan', () => {
            vscode.commands.executeCommand('workbench.action.chat.open', '@smart-planner /update');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('smart-planner.openProjectRoot', async () => {
            const result = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                title: 'Select Project Root for Smart Planner',
            });

            if (result && result.length > 0) {
                const selectedPath = result[0].fsPath;
                const config = vscode.workspace.getConfiguration('smart-planner');
                await config.update('projectRoot', selectedPath, vscode.ConfigurationTarget.Global);
                treeProvider.setProjectRoot(selectedPath);
                vscode.window.showInformationMessage(`Smart Planner: Project root set to ${selectedPath}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('smart-planner.refresh', () => {
            treeProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('smart-planner.settings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'smart-planner');
        })
    );

    // 5b. API key commands
    context.subscriptions.push(
        vscode.commands.registerCommand('smart-planner.setAnthropicApiKey', async () => {
            const key = await vscode.window.showInputBox({
                prompt: 'Enter your Anthropic API key',
                password: true,
                ignoreFocusOut: true,
                placeHolder: 'sk-ant-...',
            });
            if (key !== undefined) {
                await context.secrets.store('smart-planner.anthropicApiKey', key);
                vscode.window.showInformationMessage('Smart Planner: Anthropic API key saved.');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('smart-planner.setOpenAIApiKey', async () => {
            const key = await vscode.window.showInputBox({
                prompt: 'Enter your OpenAI API key',
                password: true,
                ignoreFocusOut: true,
                placeHolder: 'sk-...',
            });
            if (key !== undefined) {
                await context.secrets.store('smart-planner.openaiApiKey', key);
                vscode.window.showInformationMessage('Smart Planner: OpenAI API key saved.');
            }
        })
    );

    // 6. Register file watcher for .planner-state.json → refresh tree
    if (projectRoot) {
        const stateFilePattern = new vscode.RelativePattern(
            vscode.Uri.file(projectRoot),
            '.planner-state.json'
        );
        const watcher = vscode.workspace.createFileSystemWatcher(stateFilePattern);
        watcher.onDidCreate(() => treeProvider.refresh());
        watcher.onDidChange(() => treeProvider.refresh());
        watcher.onDidDelete(() => treeProvider.refresh());
        context.subscriptions.push(watcher);
    }

    // Also watch configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('smart-planner.projectRoot')) {
                const newRoot = resolveProjectRoot();
                if (newRoot) {
                    treeProvider.setProjectRoot(newRoot);
                }
            }
        })
    );
}

/**
 * Deactivates the Smart Planner extension.
 *
 * Cleans up any active resources (AI connections, file watchers, etc.).
 */
export function deactivate(): void {
    // Resources are cleaned up via context.subscriptions
}

/**
 * Resolve the project root from VSCode settings or workspace root.
 */
function resolveProjectRoot(): string {
    const config = vscode.workspace.getConfiguration('smart-planner');
    const settingRoot = config.get<string>('projectRoot', '');
    if (settingRoot) {
        return settingRoot;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        return workspaceFolders[0].uri.fsPath;
    }

    return '';
}
