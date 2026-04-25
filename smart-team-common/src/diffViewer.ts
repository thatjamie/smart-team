import * as vscode from 'vscode';
import { getDiff, getLatestDiff } from './git/gitRead';

/**
 * Get the appropriate diff for a step based on the current iteration.
 *
 * - **Iteration ≤ 1** (first implementation): Returns the full diff between
 *   the base branch and HEAD, showing all changes made for this step.
 * - **Iteration > 1** (review fixes): Returns only the latest commit diff
 *   (HEAD~1 vs HEAD), showing just what changed in the most recent iteration.
 *
 * @param worktreeDir - Absolute path to the worktree directory.
 * @param iteration - Current review iteration number (0-based or 1-based).
 * @returns Diff content as a string, or empty string on error.
 */
export function getDiffForStep(worktreeDir: string, iteration: number): string {
    if (iteration <= 1) {
        // Full diff: all changes since branching from base
        return getDiff(worktreeDir);
    }
    // Latest-only diff: just the most recent commit
    return getLatestDiff(worktreeDir);
}

/**
 * Open diff content in a VSCode editor tab with syntax highlighting.
 *
 * Creates an untitled document with the `diff` language identifier,
 * providing automatic syntax highlighting for unified diff format.
 *
 * @param diffContent - The diff text to display.
 * @param title - Title for the editor tab (e.g., "Step 3 Changes").
 * @returns The created {@link vscode.TextEditor}.
 */
export async function openDiffEditor(
    diffContent: string,
    title: string
): Promise<vscode.TextEditor> {
    const doc = await vscode.workspace.openTextDocument({
        content: diffContent,
        language: 'diff',
    });

    // Set the editor title via the document's URI scheme
    return await vscode.window.showTextDocument(doc, {
        preview: false,
        preserveFocus: false,
        viewColumn: vscode.ViewColumn.One,
    });
}
