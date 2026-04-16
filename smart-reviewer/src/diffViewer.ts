import * as vscode from 'vscode';
import { getDiff, getLatestDiff } from './git';

/**
 * Get the appropriate diff for a review step based on iteration count.
 *
 * - iteration <= 1: Full diff against base branch (all changes since branching)
 * - iteration > 1: Latest commit only (HEAD~1 vs HEAD)
 *
 * @param worktreeDir - The dev worktree directory to run git in
 * @param iteration - Current review iteration (1-based)
 * @returns The diff content as a string
 */
export function getDiffForStep(worktreeDir: string, iteration: number): string {
    if (iteration <= 1) {
        return getDiff(worktreeDir);
    }
    return getLatestDiff(worktreeDir);
}

/**
 * Open a diff content in a new editor tab with syntax highlighting.
 *
 * Creates an untitled document with language set to 'diff',
 * giving the user syntax-highlighted diff output.
 *
 * @param diffContent - The diff string to display
 * @param title - Optional title for the tab (default: "Review Diff")
 */
export async function openDiffEditor(diffContent: string, title: string = 'Review Diff'): Promise<void> {
    const doc = await vscode.workspace.openTextDocument({
        content: diffContent,
        language: 'diff',
    });
    await vscode.window.showTextDocument(doc, {
        preview: false,
        viewColumn: vscode.ViewColumn.Beside,
    });
}
