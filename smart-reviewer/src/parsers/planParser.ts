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
 * 2. Any subdirectory/PLAN.md (monorepo pattern)
 *
 * @param workspaceRoot - The workspace root directory
 * @returns Absolute path to PLAN.md, or undefined if not found
 */
export function findPlanFile(workspaceRoot: string): string | undefined {
    // Check root level
    const rootPlan = path.join(workspaceRoot, 'PLAN.md');
    if (fs.existsSync(rootPlan)) {
        return rootPlan;
    }

    // Check subdirectories (monorepo pattern)
    try {
        const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const subPlan = path.join(workspaceRoot, entry.name, 'PLAN.md');
                if (fs.existsSync(subPlan)) {
                    return subPlan;
                }
            }
        }
    } catch {
        // Ignore errors reading directory
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
