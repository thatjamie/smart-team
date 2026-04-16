/**
 * Read-only git operations for Smart Reviewer.
 *
 * The reviewer only READS git state — it never creates worktrees,
 * commits, or modifies code. All operations are safe and side-effect-free.
 */

import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { WorktreeInfo } from './types';

/**
 * Get the git project root for a given directory.
 *
 * @param dir - Any directory within the git repository
 * @returns Absolute path to the project root, or undefined if not a git repo
 */
export function getProjectRoot(dir: string): string | undefined {
    try {
        const result = execGit(dir, ['rev-parse', '--show-toplevel']);
        return result.trim();
    } catch {
        return undefined;
    }
}

/**
 * Get the project name from the project root path.
 *
 * @param projectRoot - Absolute path to the git project root
 * @returns The directory name (e.g., "smart-team")
 */
export function getProjectName(projectRoot: string): string {
    return path.basename(projectRoot);
}

/**
 * Find the dev worktree for a given project.
 *
 * Looks for ../<projectName>-dev/ relative to the project root,
 * which is the convention used by the dev-agent.
 *
 * @param projectRoot - Absolute path to the git project root
 * @returns WorktreeInfo with path, branch, and existence status
 */
export function findDevWorktree(projectRoot: string): WorktreeInfo {
    const projectName = getProjectName(projectRoot);
    const worktreePath = path.join(path.dirname(projectRoot), projectName + '-dev');
    const exists = isDirectory(worktreePath);

    let branch = '';
    if (exists) {
        try {
            branch = execGit(worktreePath, ['branch', '--show-current']).trim();
        } catch {
            branch = '';
        }
    }

    return {
        path: worktreePath,
        branch,
        exists,
    };
}

/**
 * Get the full diff for a step (all changes since branching from base).
 *
 * @param dir - Directory to run git in (typically the dev worktree)
 * @param base - Base branch or ref to compare against (defaults to auto-detected)
 * @returns The diff output as a string, or empty string on error
 */
export function getDiff(dir: string, base?: string): string {
    const baseRef = base ?? guessBaseBranch(dir);
    try {
        return execGit(dir, ['diff', baseRef + '...HEAD']);
    } catch {
        // Fallback: try without triple-dot
        try {
            return execGit(dir, ['diff', baseRef, 'HEAD']);
        } catch {
            return '';
        }
    }
}

/**
 * Get the diff for just the latest commit (for iteration reviews).
 *
 * @param dir - Directory to run git in
 * @returns The diff of HEAD~1 vs HEAD
 */
export function getLatestDiff(dir: string): string {
    try {
        return execGit(dir, ['diff', 'HEAD~1', 'HEAD']);
    } catch {
        return '';
    }
}

/**
 * Guess the base branch (main or master).
 *
 * Checks which branch exists in the remote, defaulting to "main".
 *
 * @param dir - Directory to run git in
 * @returns "main" or "master"
 */
export function guessBaseBranch(dir: string): string {
    // Check if main exists
    try {
        execGit(dir, ['rev-parse', '--verify', 'main']);
        return 'main';
    } catch {
        // main doesn't exist, try master
    }

    try {
        execGit(dir, ['rev-parse', '--verify', 'master']);
        return 'master';
    } catch {
        // Neither exists, default to main
    }

    return 'main';
}

/**
 * Get the current branch name.
 *
 * @param dir - Directory to run git in
 * @returns Branch name, or empty string on error
 */
export function getCurrentBranch(dir: string): string {
    try {
        return execGit(dir, ['branch', '--show-current']).trim();
    } catch {
        return '';
    }
}

/**
 * Get the latest commit hash (short).
 *
 * @param dir - Directory to run git in
 * @returns Short commit hash (7 chars), or empty string on error
 */
export function getLatestCommit(dir: string): string {
    try {
        return execGit(dir, ['rev-parse', '--short', 'HEAD']).trim();
    } catch {
        return '';
    }
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Execute a git command and return stdout.
 */
function execGit(cwd: string, args: string[]): string {
    const result = cp.spawnSync('git', args, {
        cwd,
        encoding: 'utf-8',
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024, // 10MB for large diffs
    });

    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        const cmd = args.join(' ');
        const stderr = typeof result.stderr === 'string' ? result.stderr : '';
        throw new Error('git ' + cmd + ' failed with status ' + result.status + ': ' + stderr);
    }

    return result.stdout;
}

/**
 * Check if a path is an existing directory.
 */
function isDirectory(dirPath: string): boolean {
    try {
        return fs.statSync(dirPath).isDirectory();
    } catch {
        return false;
    }
}
