import * as fs from 'fs';
import { Progress, ProgressStepEntry, StepStatus, ProgressLastAction } from '../types';

/**
 * Write PROGRESS.md with the format used by the dev-agent workflow.
 *
 * The reviewer only updates:
 * - Last Action (agent, action, timestamp)
 * - Step status (keeps as In Progress, or marks Complete after user approval)
 *
 * @param filePath - Absolute path to PROGRESS.md
 * @param progress - The progress state to write
 */
export function writeProgress(filePath: string, progress: Progress): void {
    const lines: string[] = [];

    // Header
    lines.push('# Progress \u2014 ' + progress.planName);
    lines.push('');
    lines.push('**Plan**: ' + progress.planName);
    lines.push('**Branch**: ' + progress.branch);
    lines.push('**Created**: ' + progress.created);
    lines.push('');

    // Table header
    lines.push('| Step | Status | Iteration | Last Commit |');
    lines.push('|------|--------|-----------|-------------|');

    // Table rows
    for (const step of progress.steps) {
        const statusEmoji = statusToEmoji(step.status);
        const iterStr = step.iteration > 0 ? step.iteration + '/5' : '-';
        const commitStr = step.lastCommit || '-';
        lines.push('| ' + step.label + ' | ' + statusEmoji + ' | ' + iterStr + ' | ' + commitStr + ' |');
    }
    lines.push('');

    // Last Action
    lines.push('## Last Action');
    lines.push('- **Agent**: ' + progress.lastAction.agent);
    lines.push('- **Action**: ' + progress.lastAction.action);
    lines.push('- **Timestamp**: ' + progress.lastAction.timestamp);

    const content = lines.join('\n');
    fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Update a single step's status in a Progress object.
 * Returns a new Progress object with the updated step.
 *
 * @param progress - Current progress state
 * @param stepIndex - Zero-based step index to update
 * @param updates - Fields to update (status, iteration, lastCommit)
 * @returns New Progress with the step updated
 */
export function updateProgressStep(
    progress: Progress,
    stepIndex: number,
    updates: { status?: StepStatus; iteration?: number; lastCommit?: string }
): Progress {
    const newSteps = progress.steps.map((step, idx) => {
        if (idx === stepIndex) {
            return {
                ...step,
                status: updates.status ?? step.status,
                iteration: updates.iteration ?? step.iteration,
                lastCommit: updates.lastCommit ?? step.lastCommit,
            };
        }
        return step;
    });

    return {
        ...progress,
        steps: newSteps,
    };
}

/**
 * Update the Last Action in a Progress object.
 *
 * @param progress - Current progress state
 * @param agent - Agent name (dev-agent or review-agent)
 * @param action - Description of what was done
 * @param timestamp - When the action occurred
 * @returns New Progress with updated lastAction
 */
export function updateLastAction(
    progress: Progress,
    agent: string,
    action: string,
    timestamp: string
): Progress {
    return {
        ...progress,
        lastAction: { agent, action, timestamp },
    };
}

/**
 * Convert StepStatus enum to emoji string.
 */
function statusToEmoji(status: StepStatus): string {
    switch (status) {
        case StepStatus.Complete:
            return '\u2705 Complete';
        case StepStatus.InProgress:
            return '\uD83D\uDD04 In Progress';
        case StepStatus.Pending:
            return '\u23F3 Pending';
    }
}
