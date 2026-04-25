import * as path from 'path';
import type { WorktreeInfo } from '../types';
import { execGit, isDirectory, getProjectName } from './gitRead';

/**
 * Create a dev worktree for a plan.
 *
 * Idempotent — if the worktree already exists, returns its info without
 * creating a new one. The worktree is placed at `../<projectName>-dev/`
 * on a branch named `feature/plan-<planName>`.
 *
 * @param projectRoot - Absolute path to the project root (main repo).
 * @param planName - Plan name (used in the branch name).
 * @returns {@link WorktreeInfo} for the created or existing worktree.
 */
export function createDevWorktree(
    projectRoot: string,
    planName: string
): WorktreeInfo {
    const projectName = getProjectName(projectRoot);
    const worktreePath = path.join(projectRoot, '..', `${projectName}-dev`);
    const branchName = `feature/plan-${planName}`;

    // Check if worktree already exists
    if (isDirectory(worktreePath)) {
        try {
            const branch = execGit(worktreePath, ['branch', '--show-current']);
            return { path: worktreePath, branch, exists: true };
        } catch {
            return { path: worktreePath, branch: '', exists: true };
        }
    }

    // Create the worktree
    execGit(projectRoot, [
        'worktree', 'add',
        worktreePath,
        '-b', branchName,
    ]);

    return { path: worktreePath, branch: branchName, exists: true };
}

/**
 * Check if there are uncommitted changes in a directory.
 *
 * @param dir - Working directory to check.
 * @returns `true` if there are staged or unstaged changes.
 */
export function hasUncommittedChanges(dir: string): boolean {
    try {
        // Check for unstaged changes
        const unstaged = execGit(dir, ['status', '--porcelain']);
        return unstaged.length > 0;
    } catch {
        return false;
    }
}

/**
 * Stage all changes and commit with the given message.
 *
 * @param dir - Working directory for the commit.
 * @param message - Commit message (may contain multiple lines).
 * @returns Short 7-character commit hash of the new commit.
 * @throws Error if staging or committing fails.
 */
export function commitChanges(dir: string, message: string): string {
    // Stage all changes (including untracked files)
    execGit(dir, ['add', '-A']);

    // Commit with the message
    execGit(dir, ['commit', '-m', message]);

    // Return the short hash of the new commit
    return execGit(dir, ['rev-parse', '--short', 'HEAD']);
}

/**
 * Remove a git worktree.
 *
 * @param projectRoot - Absolute path to the project root (main repo).
 * @param worktreePath - Absolute path to the worktree to remove.
 */
export function removeWorktree(projectRoot: string, worktreePath: string): void {
    execGit(projectRoot, ['worktree', 'remove', worktreePath]);
}
