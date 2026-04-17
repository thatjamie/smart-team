import * as fs from 'fs';
import * as path from 'path';
import { Plan, Step, StepStatus } from '../types';

/**
 * Parse a PLAN.md file into a structured Plan object.
 *
 * Steps are identified by ## headings. Each heading's content
 * extends until the next same-level or higher heading.
 *
 * @param planFilePath - Absolute path to PLAN.md
 * @param progressOverrides - Optional progress data to merge step statuses
 * @returns Parsed Plan with steps
 */
export function parsePlan(planFilePath: string, progressOverrides?: Map<number, { status: StepStatus; iteration: number; lastCommit: string }>): Plan {
    const content = fs.readFileSync(planFilePath, 'utf-8');
    const planName = path.basename(path.dirname(planFilePath));
    const steps = parseSteps(content, progressOverrides);

    return {
        name: planName,
        filePath: planFilePath,
        steps,
    };
}

/**
 * Find PLAN.md in likely locations relative to a workspace root.
 *
 * Search order:
 * 1. PLAN.md at the workspace root
 * 2. Recursive search in subdirectories up to maxDepth levels deep
 *
 * @param workspaceRoot - The workspace root directory
 * @param maxDepth - Maximum subdirectory depth to search (default: 3)
 * @returns Absolute path to PLAN.md, or undefined if not found
 */
export function findPlanFile(workspaceRoot: string, maxDepth: number = 3): string | undefined {
    // Check root level
    const rootPlan = path.join(workspaceRoot, 'PLAN.md');
    if (fs.existsSync(rootPlan)) {
        return rootPlan;
    }

    // Recursive search in subdirectories
    if (maxDepth > 0) {
        const result = searchDirectory(workspaceRoot, maxDepth);
        if (result) {
            return result;
        }
    }

    return undefined;
}

/**
 * Recursively search for PLAN.md in subdirectories.
 *
 * Skips common non-project directories (node_modules, .git, .vscode, dist, out, build).
 * Returns the first match found (breadth-first search).
 *
 * @param dir - Directory to search in
 * @param remainingDepth - How many more levels to descend
 * @returns Absolute path to PLAN.md, or undefined if not found
 */
function searchDirectory(dir: string, remainingDepth: number): string | undefined {
    // Directories to skip
    const skipDirs = new Set([
        'node_modules', '.git', '.svn', '.hg',
        '.vscode', '.idea',
        'dist', 'out', 'build', 'target',
        '__pycache__', '.cache', '.next',
    ]);

    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return undefined;
    }

    // First pass: check for PLAN.md in immediate subdirectories
    const subdirs: string[] = [];
    for (const entry of entries) {
        if (!entry.isDirectory() || skipDirs.has(entry.name)) {
            continue;
        }
        const subPlan = path.join(dir, entry.name, 'PLAN.md');
        if (fs.existsSync(subPlan)) {
            return subPlan;
        }
        subdirs.push(path.join(dir, entry.name));
    }

    // Second pass: recurse into subdirectories if depth remains
    if (remainingDepth > 1) {
        for (const subdir of subdirs) {
            const result = searchDirectory(subdir, remainingDepth - 1);
            if (result) {
                return result;
            }
        }
    }

    return undefined;
}

/**
 * Parse steps from PLAN.md markdown content.
 *
 * Steps are delimited by ## headings. Content under each heading
 * extends until the next ## heading.
 */
function parseSteps(
    content: string,
    progressOverrides?: Map<number, { status: StepStatus; iteration: number; lastCommit: string }>
): Step[] {
    const lines = content.split('\n');
    const steps: Step[] = [];
    let currentStep: { index: number; title: string; level: number; lines: string[] } | null = null;

    for (const line of lines) {
        // Match ## or ### headings
        const headingMatch = line.match(/^(#{2,3})\s+(.+)$/);
        if (headingMatch) {
            // Save previous step
            if (currentStep) {
                steps.push(buildStep(currentStep, progressOverrides));
            }
            currentStep = {
                index: steps.length,
                title: headingMatch[2].trim(),
                level: headingMatch[1].length,
                lines: [line],
            };
        } else if (currentStep) {
            currentStep.lines.push(line);
        }
    }

    // Don't forget the last step
    if (currentStep) {
        steps.push(buildStep(currentStep, progressOverrides));
    }

    return steps;
}

/**
 * Build a Step object from parsed heading + lines.
 */
function buildStep(
    raw: { index: number; title: string; level: number; lines: string[] },
    progressOverrides?: Map<number, { status: StepStatus; iteration: number; lastCommit: string }>
): Step {
    const override = progressOverrides?.get(raw.index);

    return {
        index: raw.index,
        title: raw.title,
        level: raw.level,
        content: raw.lines.join('\n').trim(),
        status: override?.status ?? StepStatus.Pending,
        iteration: override?.iteration ?? 0,
        lastCommit: override?.lastCommit ?? '',
    };
}
