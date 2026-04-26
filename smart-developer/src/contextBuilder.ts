/**
 * Dev context builder.
 *
 * Assembles the full context needed for an AI prompt: plan content, progress
 * state, past decisions, review feedback, project file tree, language detection,
 * and existing file contents referenced by the current step.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Plan, Progress } from 'smart-team-common';
import type { DevContext } from './types';

/** Directories to exclude from the file tree. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'out', 'dist', '.vscode-test', '__pycache__']);

/** Maximum recursion depth for file tree building. */
const MAX_FILE_TREE_DEPTH = 4;

/** Maximum number of existing files to include in context. */
const MAX_EXISTING_FILES = 10;

/**
 * Build the full dev context for an AI prompt.
 *
 * @param planRoot - Absolute path to the plan root directory (where PLAN.md lives).
 * @param stepIndex - Zero-based index of the current step.
 * @param plan - Parsed plan object.
 * @param progress - Parsed progress object (may be undefined if no PROGRESS.md).
 * @param worktreeDir - Absolute path to the worktree directory.
 * @returns A fully populated {@link DevContext}.
 */
export function buildDevContext(
    planRoot: string,
    stepIndex: number,
    plan: Plan,
    progress: Progress | undefined,
    worktreeDir: string
): DevContext {
    if (stepIndex < 0 || stepIndex >= plan.steps.length) {
        throw new Error(`Invalid step index ${stepIndex}: plan has ${plan.steps.length} steps.`);
    }

    const step = plan.steps[stepIndex];
    const planContent = step.content;

    // Progress state as text
    const progressState = progress ? formatProgressState(progress) : '';

    // Past decisions
    const pastDecisions = readPastDecisions(planRoot);

    // Review feedback (for iterations > 1)
    const reviewFeedback = readReviewFeedback(planRoot, progress, stepIndex);

    // Language / framework detection
    const languageFramework = detectLanguageFramework(worktreeDir);

    // Project file tree
    const projectStructure = buildFileTree(worktreeDir);

    // Existing files referenced by the step
    const existingFiles = readExistingFiles(worktreeDir, step.content);

    return {
        planContent,
        progressState,
        pastDecisions,
        reviewFeedback,
        projectStructure,
        languageFramework,
        existingFiles,
    };
}

/**
 * Format progress state as a human-readable string.
 */
function formatProgressState(progress: Progress): string {
    const lines: string[] = [];
    lines.push(`Plan: ${progress.planName}`);
    lines.push(`Branch: ${progress.branch}`);
    for (const step of progress.steps) {
        const icon = step.status === 'complete' ? '✅'
            : step.status === 'in-progress' ? '🔄'
            : '⏳';
        lines.push(`${icon} ${step.label} (iter ${step.iteration}/5, commit: ${step.lastCommit || '-'})`);
    }
    return lines.join('\n');
}

/**
 * Read past decisions from DECISIONS.md in the plan root.
 */
function readPastDecisions(planRoot: string): string {
    const decisionsPath = path.join(planRoot, 'DECISIONS.md');
    try {
        const content = fs.readFileSync(decisionsPath, 'utf-8');
        return content.trim() || '';
    } catch {
        return '';
    }
}

/**
 * Read review feedback if iteration > 1.
 *
 * Returns the raw REVIEW_FEEDBACK.md content, or undefined if not applicable.
 */
function readReviewFeedback(
    planRoot: string,
    progress: Progress | undefined,
    stepIndex: number
): string | undefined {
    if (!progress) {
        return undefined;
    }

    const stepEntry = progress.steps[stepIndex];
    if (!stepEntry || stepEntry.iteration <= 1) {
        return undefined;
    }

    const feedbackPath = path.join(planRoot, 'REVIEW_FEEDBACK.md');
    try {
        const content = fs.readFileSync(feedbackPath, 'utf-8');
        return content.trim() || undefined;
    } catch {
        return undefined;
    }
}

/**
 * Detect the project's language and framework from config files.
 */
function detectLanguageFramework(projectDir: string): string {
    const detections: string[] = [];

    // Check for package.json → JS/TS
    const pkgJsonPath = path.join(projectDir, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };

            if (deps['typescript'] || fs.existsSync(path.join(projectDir, 'tsconfig.json'))) {
                detections.push('TypeScript');
            } else {
                detections.push('JavaScript');
            }

            // Framework detection
            if (deps['react'] || deps['react-dom']) {
                detections.push('React');
            }
            if (deps['express']) {
                detections.push('Express');
            }
            if (deps['next']) {
                detections.push('Next.js');
            }
            if (deps['@types/vscode']) {
                detections.push('VSCode Extension');
            }
        } catch {
            detections.push('JavaScript');
        }
    }

    // Check for other language config files
    if (fs.existsSync(path.join(projectDir, 'Cargo.toml'))) {
        detections.push('Rust');
    }
    if (fs.existsSync(path.join(projectDir, 'pyproject.toml')) || fs.existsSync(path.join(projectDir, 'setup.py'))) {
        detections.push('Python');
    }
    if (fs.existsSync(path.join(projectDir, 'go.mod'))) {
        detections.push('Go');
    }
    if (fs.existsSync(path.join(projectDir, 'pom.xml')) || fs.existsSync(path.join(projectDir, 'build.gradle'))) {
        detections.push('Java');
    }

    return detections.length > 0 ? detections.join(' + ') : 'Unknown';
}

/**
 * Build a string representation of the project file tree.
 *
 * Recursively lists files and directories up to MAX_FILE_TREE_DEPTH,
 * skipping common generated/dependency directories.
 */
function buildFileTree(dir: string): string {
    const lines: string[] = [];
    buildFileTreeRecursive(dir, '', 0, lines);
    return lines.join('\n');
}

/**
 * Recursive helper for building the file tree.
 */
function buildFileTreeRecursive(dir: string, prefix: string, depth: number, lines: string[]): void {
    if (depth > MAX_FILE_TREE_DEPTH) {
        return;
    }

    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }

    // Sort: directories first, then files, both alphabetically
    const sorted = entries
        .filter(e => !SKIP_DIRS.has(e.name) && !e.name.startsWith('.'))
        .sort((a, b) => {
            if (a.isDirectory() && !b.isDirectory()) {
                return -1;
            }
            if (!a.isDirectory() && b.isDirectory()) {
                return 1;
            }
            return a.name.localeCompare(b.name);
        });

    for (const entry of sorted) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            lines.push(`${prefix}📁 ${entry.name}/`);
            buildFileTreeRecursive(fullPath, `${prefix}  `, depth + 1, lines);
        } else {
            lines.push(`${prefix}📄 ${entry.name}`);
        }
    }
}

/**
 * Read existing files that are referenced in the step content.
 *
 * Looks for file paths mentioned in the step markdown (e.g., `src/foo.ts`,
 * backtick-wrapped paths) and reads their content from the worktree.
 *
 * Limits to MAX_EXISTING_FILES to avoid context overflow.
 */
function readExistingFiles(worktreeDir: string, stepContent: string): Map<string, string> {
    const files = new Map<string, string>();

    // Extract file paths from backtick-wrapped strings and bare paths
    const backtickPaths = stepContent.match(/`([^`]+\.[a-zA-Z]+)`/g) ?? [];
    const candidates = new Set<string>();

    for (const raw of backtickPaths) {
        const cleaned = raw.replace(/`/g, '').trim();
        // Only include relative paths (not absolute, not URLs)
        if (!cleaned.startsWith('/') && !cleaned.startsWith('http') && cleaned.includes('/')) {
            candidates.add(cleaned);
        }
    }

    // Also look for common file patterns in plain text
    const plainPaths = stepContent.match(/\bsrc\/[^\s)\]"'`,]+/g) ?? [];
    for (const p of plainPaths) {
        candidates.add(p);
    }

    let count = 0;
    for (const candidate of candidates) {
        if (count >= MAX_EXISTING_FILES) {
            break;
        }

        const fullPath = path.join(worktreeDir, candidate);
        try {
            const stat = fs.statSync(fullPath);
            if (stat.isFile()) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                files.set(candidate, content);
                count++;
            }
        } catch {
            // File doesn't exist or can't be read — skip
        }
    }

    return files;
}
