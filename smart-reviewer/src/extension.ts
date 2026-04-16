import * as vscode from 'vscode';
import * as path from 'path';
import { ReviewTreeProvider } from './providers/reviewTreeProvider';
import { handleChatRequest } from './chatHandler';
import { findPlanFile } from './parsers/planParser';
import { getProjectRoot, getProjectName, findDevWorktree, getDiff, getLatestDiff } from './git';
import { openDiffEditor } from './diffViewer';

/**
 * Activate the Smart Reviewer extension.
 *
 * Registers:
 * - Chat participant @smart-reviewer
 * - TreeView for sidebar
 * - All commands
 * - File watchers for shared state files
 * - SecretStorage initialization
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('Smart Reviewer extension is activating...');

    // ─── Plan Root Detection ──────────────────────────────────────────────────

    let planRoot: string | undefined;

    function detectPlanRoot(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return undefined;
        }

        // Check each workspace folder for PLAN.md
        for (const folder of workspaceFolders) {
            const found = findPlanFile(folder.uri.fsPath);
            if (found) {
                return path.dirname(found);
            }
        }
        return undefined;
    }

    planRoot = detectPlanRoot();

    // ─── Tree View ────────────────────────────────────────────────────────────

    const treeProvider = new ReviewTreeProvider();
    treeProvider.setPlanRoot(planRoot);

    const treeView = vscode.window.createTreeView('smart-reviewer-overview', {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
    });
    context.subscriptions.push(treeView);

    // ─── Chat Participant ─────────────────────────────────────────────────────

    const chatParticipant = vscode.chat.createChatParticipant(
        'smart-reviewer',
        async (request: vscode.ChatRequest, chatContext: vscode.ChatContext, response: vscode.ChatResponseStream, token: vscode.CancellationToken) => {
            await handleChatRequest(request, response, token, planRoot, context.secrets);
        }
    );
    chatParticipant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.svg');
    context.subscriptions.push(chatParticipant);

    // ─── Commands ─────────────────────────────────────────────────────────────

    // Review current step
    context.subscriptions.push(vscode.commands.registerCommand('smart-reviewer.reviewStep', async () => {
        vscode.commands.executeCommand('workbench.action.chat.open', '@smart-reviewer /review');
    }));

    // Approve step
    context.subscriptions.push(vscode.commands.registerCommand('smart-reviewer.approveStep', async () => {
        vscode.commands.executeCommand('workbench.action.chat.open', '@smart-reviewer /review');
    }));

    // Request changes
    context.subscriptions.push(vscode.commands.registerCommand('smart-reviewer.requestChanges', async () => {
        vscode.window.showInformationMessage('Smart Reviewer: Use /review in the chat to run a review and provide feedback.');
    }));

    // View full diff
    context.subscriptions.push(vscode.commands.registerCommand('smart-reviewer.viewDiff', async () => {
        if (!planRoot) {
            vscode.window.showWarningMessage('Smart Reviewer: No plan found in workspace.');
            return;
        }
        const projectRoot = getProjectRoot(planRoot);
        if (!projectRoot) {
            vscode.window.showWarningMessage('Smart Reviewer: Could not determine project root.');
            return;
        }
        const worktree = findDevWorktree(projectRoot);
        if (!worktree.exists) {
            vscode.window.showWarningMessage('Smart Reviewer: Dev worktree not found at ' + worktree.path);
            return;
        }
        const diff = getDiff(worktree.path);
        if (!diff || diff.trim().length === 0) {
            vscode.window.showInformationMessage('Smart Reviewer: No diff available.');
            return;
        }
        await openDiffEditor(diff, 'Full Diff');
    }));

    // View latest diff
    context.subscriptions.push(vscode.commands.registerCommand('smart-reviewer.viewDiffLatest', async () => {
        if (!planRoot) {
            vscode.window.showWarningMessage('Smart Reviewer: No plan found in workspace.');
            return;
        }
        const projectRoot = getProjectRoot(planRoot);
        if (!projectRoot) {
            vscode.window.showWarningMessage('Smart Reviewer: Could not determine project root.');
            return;
        }
        const worktree = findDevWorktree(projectRoot);
        if (!worktree.exists) {
            vscode.window.showWarningMessage('Smart Reviewer: Dev worktree not found.');
            return;
        }
        const diff = getLatestDiff(worktree.path);
        if (!diff || diff.trim().length === 0) {
            vscode.window.showInformationMessage('Smart Reviewer: No latest diff available.');
            return;
        }
        await openDiffEditor(diff, 'Latest Diff (HEAD~1 vs HEAD)');
    }));

    // Open dev worktree
    context.subscriptions.push(vscode.commands.registerCommand('smart-reviewer.openWorktree', async () => {
        if (!planRoot) {
            vscode.window.showWarningMessage('Smart Reviewer: No plan found in workspace.');
            return;
        }
        const projectRoot = getProjectRoot(planRoot);
        if (!projectRoot) {
            vscode.window.showWarningMessage('Smart Reviewer: Could not determine project root.');
            return;
        }
        const worktree = findDevWorktree(projectRoot);
        if (!worktree.exists) {
            const openFolder = await vscode.window.showInformationMessage(
                'Dev worktree not found at ' + worktree.path,
                'OK'
            );
            return;
        }
        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(worktree.path), true);
    }));

    // Refresh tree
    context.subscriptions.push(vscode.commands.registerCommand('smart-reviewer.refresh', async () => {
        planRoot = detectPlanRoot();
        treeProvider.setPlanRoot(planRoot);
        vscode.window.showInformationMessage('Smart Reviewer: Sidebar refreshed.');
    }));

    // Open settings
    context.subscriptions.push(vscode.commands.registerCommand('smart-reviewer.settings', async () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'smart-reviewer');
    }));

    // ─── File Watchers ───────────────────────────────────────────────────────

    const watchPatterns = [
        '**/PLAN.md',
        '**/PROGRESS.md',
        '**/DEV_NOTES.md',
        '**/REVIEW_FEEDBACK.md',
        '**/DECISIONS.md',
    ];

    for (const pattern of watchPatterns) {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        watcher.onDidChange(() => treeProvider.refresh());
        watcher.onDidCreate(() => {
            planRoot = detectPlanRoot();
            treeProvider.setPlanRoot(planRoot);
        });
        watcher.onDidDelete(() => treeProvider.refresh());
        context.subscriptions.push(watcher);
    }

    // ─── Workspace Change Detection ──────────────────────────────────────────

    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => {
        planRoot = detectPlanRoot();
        treeProvider.setPlanRoot(planRoot);
    }));

    console.log('Smart Reviewer extension activated successfully.');
}

/**
 * Deactivate the Smart Reviewer extension.
 */
export function deactivate(): void {
    console.log('Smart Reviewer extension deactivated.');
}
