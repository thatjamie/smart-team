import * as fs from 'fs';
import * as path from 'path';
import type { Plan, Step, Progress } from '../types';
import { StepStatus } from '../types';

/**
 * Parse a PLAN.md file into a structured {@link Plan} object.
 *
 * Steps are identified by `##` headings. Content between consecutive `##`
 * headings (or until EOF) is captured as the step content. The `Overview`
 * section (before the first `##` step heading) is not treated as a step.
 *
 * @param planFilePath - Absolute path to PLAN.md.
 * @param progressOverrides - Optional parsed Progress to merge step statuses from.
 * @returns A parsed {@link Plan}, or a Plan with empty steps on error.
 */
export function parsePlan(planFilePath: string, progressOverrides?: Progress): Plan {
    try {
        const content = fs.readFileSync(planFilePath, 'utf-8');
        const name = derivePlanName(planFilePath, content);
        const rawSteps = extractSteps(content);

        const steps: Step[] = rawSteps.map((raw, index) => {
            const progressEntry = progressOverrides?.steps[index];
            return {
                index,
                title: raw.title,
                level: raw.level,
                content: raw.content,
                status: progressEntry?.status ?? StepStatus.Pending,
                iteration: progressEntry?.iteration ?? 0,
                lastCommit: progressEntry?.lastCommit ?? '',
            };
        });

        return { name, filePath: planFilePath, steps };
    } catch {
        return {
            name: derivePlanName(planFilePath),
            filePath: planFilePath,
            steps: [],
        };
    }
}

/**
 * Breadth-first search for a PLAN.md file.
 *
 * Starts at `workspaceRoot` and searches up to `maxDepth` directory levels.
 * Skips common non-project directories: `node_modules`, `.git`, `dist`,
 * `out`, `build`, `__pycache__`.
 *
 * @param workspaceRoot - Directory to start searching from.
 * @param maxDepth - Maximum directory depth to search (default 5).
 * @returns Absolute path to PLAN.md, or `undefined` if not found.
 */
export function findPlanFile(workspaceRoot: string, maxDepth: number = 5): string | undefined {
    const skipDirs = new Set(['node_modules', '.git', 'dist', 'out', 'build', '__pycache__']);

    /** BFS queue entries: [directoryPath, currentDepth] */
    const queue: Array<[string, number]> = [[workspaceRoot, 0]];

    while (queue.length > 0) {
        const [dir, depth] = queue.shift()!;

        if (depth > maxDepth) {
            continue;
        }

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            // Check for PLAN.md in current directory first
            for (const entry of entries) {
                if (entry.isFile() && entry.name === 'PLAN.md') {
                    return path.join(dir, 'PLAN.md');
                }
            }

            // Then enqueue subdirectories for BFS
            if (depth < maxDepth) {
                for (const entry of entries) {
                    if (entry.isDirectory() && !skipDirs.has(entry.name)) {
                        queue.push([path.join(dir, entry.name), depth + 1]);
                    }
                }
            }
        } catch {
            // Skip directories we can't read
            continue;
        }
    }

    return undefined;
}

/**
 * Derive the plan name from the file path or content.
 * Uses the parent directory name by default, or extracts from the first `# ` heading.
 */
function derivePlanName(planFilePath: string, content?: string): string {
    if (content) {
        const headingMatch = content.match(/^#\s+(.+)$/m);
        if (headingMatch) {
            // Extract name after "—" if present (e.g., "# Plan — my-plan" → "my-plan")
            const afterDash = headingMatch[1].split('—').pop()?.trim();
            if (afterDash) {
                return afterDash;
            }
            return headingMatch[1].trim();
        }
    }
    return path.basename(path.dirname(planFilePath));
}

/**
 * Extract steps from PLAN.md content by splitting on `##` headings.
 * Skips the top-level `#` heading (plan title).
 */
function extractSteps(content: string): Array<{ title: string; level: number; content: string }> {
    const steps: Array<{ title: string; level: number; content: string }> = [];

    // Match all headings: capture level (# count) and title
    const headingRegex = /^(#{2,})\s+(.+)$/gm;
    const matches: Array<{ index: number; level: number; title: string }> = [];

    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(content)) !== null) {
        matches.push({
            index: match.index,
            level: match[1].length,
            title: match[2].trim(),
        });
    }

    // Extract content between consecutive headings
    for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index;
        const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
        const fullSection = content.substring(start, end);

        // Remove the heading line itself to get just the content
        const headingLineEnd = fullSection.indexOf('\n');
        const stepContent = headingLineEnd >= 0
            ? fullSection.substring(headingLineEnd + 1).trim()
            : '';

        // Only include ## level headings as steps (level 2)
        // Deeper headings (###, ####) are sub-sections within a step
        if (matches[i].level === 2) {
            steps.push({
                title: matches[i].title,
                level: matches[i].level,
                content: stepContent,
            });
        }
    }

    return steps;
}
