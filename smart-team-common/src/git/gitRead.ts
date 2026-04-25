import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { WorktreeInfo } from '../types';

/** Maximum buffer size for git command output (10 MB) */
const MAX_BUFFER = 10 * 1024 * 1024;

/** Timeout for git commands in milliseconds (30 seconds) */
const GIT_TIMEOUT_MS = 30_000;

/**
 * Execute a git command and return its stdout.
 *
 * Uses `spawnSync` with no shell execution. Throws on non-zero exit code.
 *
 * @param cwd - Working directory for the command.
 * @param args - Git arguments (e.g., ['rev-parse', '--show-toplevel']).
 * @returns Trimmed stdout string.
 * @throws Error if the git command fails.
 */
export function execGit(cwd: string, args: string[]): string {
    const result = spawnSync('git', args, {
        cwd,
        encoding: 'utf-8',
        maxBuffer: MAX_BUFFER,
        timeout: GIT_TIMEOUT_MS,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(
            `git ${args.join(' ')} failed (exit ${result.status}): ${(result.stderr ?? '').trim()}`
        );
    }

    return (result.stdout ?? '').trim();
}

/**
 * Check if a path is an existing directory.
 *
 * @param dirPath - Path to check.
 * @returns `true` if the path exists and is a directory.
 */
export function isDirectory(dirPath: string): boolean {
    try {
        return fs.statSync(dirPath).isDirectory();
    } catch {
        return false;
    }
}

// ─── Read-only operations ──────────────────────────────────────────────────────

/**
 * Get the git project root directory.
 *
 * @param dir - Any directory within the git repository.
 * @returns Absolute path to the project root, or `undefined` if not a git repo.
 */
export function getProjectRoot(dir: string): string | undefined {
    try {
        const root = execGit(dir, ['rev-parse', '--show-toplevel']);
        return root || undefined;
    } catch {
        return undefined;
    }
}

/**
 * Get the project name from the project root directory.
 *
 * @param projectRoot - Absolute path to the project root.
 * @returns The basename of the project root directory.
 */
export function getProjectName(projectRoot: string): string {
    return path.basename(projectRoot);
}

/**
 * Find the dev worktree for a project.
 *
 * Looks for `../<projectName>-dev/` relative to the project root.
 *
 * @param projectRoot - Absolute path to the project root.
 * @returns {@link WorktreeInfo} with `exists` indicating whether the worktree directory exists.
 */
export function findDevWorktree(projectRoot: string): WorktreeInfo {
    const projectName = getProjectName(projectRoot);
    const worktreePath = path.join(projectRoot, '..', `${projectName}-dev`);

    if (isDirectory(worktreePath)) {
        try {
            const branch = execGit(worktreePath, ['branch', '--show-current']);
            return { path: worktreePath, branch, exists: true };
        } catch {
            return { path: worktreePath, branch: '', exists: true };
        }
    }

    return { path: worktreePath, branch: '', exists: false };
}

/**
 * Get the git diff for the current branch against a base.
 *
 * First tries triple-dot syntax (`base...HEAD`) which shows changes since
 * branching. Falls back to double-dot syntax (`base..HEAD`) on error.
 *
 * @param dir - Working directory for the git command.
 * @param base - Base branch or ref (default: detected via `guessBaseBranch`).
 * @returns Diff output as a string, or empty string on error.
 */
export function getDiff(dir: string, base?: string): string {
    const resolvedBase = base ?? guessBaseBranch(dir);
    if (!resolvedBase) {
        return '';
    }

    // Try triple-dot first (changes since branching)
    try {
        return execGit(dir, ['diff', `${resolvedBase}...HEAD`]);
    } catch {
        // Fallback to double-dot (all changes between refs)
        try {
            return execGit(dir, ['diff', `${resolvedBase}..HEAD`]);
        } catch {
            return '';
        }
    }
}

/**
 * Get the diff of the latest commit only (HEAD~1 vs HEAD).
 *
 * Useful for reviewing a single iteration's changes.
 *
 * @param dir - Working directory for the git command.
 * @returns Diff output as a string, or empty string on error.
 */
export function getLatestDiff(dir: string): string {
    try {
        return execGit(dir, ['diff', 'HEAD~1', 'HEAD']);
    } catch {
        return '';
    }
}

/**
 * Guess the base branch name ("main" or "master").
 *
 * Checks local refs first, then remote refs.
 *
 * @param dir - Working directory for the git command.
 * @returns "main", "master", or empty string if neither is found.
 */
export function guessBaseBranch(dir: string): string {
    // Check local refs
    try {
        const refs = execGit(dir, ['branch', '--list', 'main', 'master']);
        if (refs.includes('main')) {
            return 'main';
        }
        if (refs.includes('master')) {
            return 'master';
        }
    } catch {
        // Continue to check remote refs
    }

    // Check remote refs
    try {
        const refs = execGit(dir, ['branch', '--list', '-r', 'origin/main', 'origin/master']);
        if (refs.includes('origin/main')) {
            return 'main';
        }
        if (refs.includes('origin/master')) {
            return 'master';
        }
    } catch {
        // No remote refs either
    }

    return '';
}

/**
 * Get the current git branch name.
 *
 * @param dir - Working directory for the git command.
 * @returns Branch name, or empty string on error.
 */
export function getCurrentBranch(dir: string): string {
    try {
        return execGit(dir, ['branch', '--show-current']);
    } catch {
        return '';
    }
}

/**
 * Get the short hash of the latest commit.
 *
 * @param dir - Working directory for the git command.
 * @returns 7-character commit hash, or empty string on error.
 */
export function getLatestCommit(dir: string): string {
    try {
        return execGit(dir, ['rev-parse', '--short', 'HEAD']);
    } catch {
        return '';
    }
}
