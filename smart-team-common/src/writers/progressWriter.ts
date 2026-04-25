import * as fs from 'fs';
import { StepStatus } from '../types';
import type { Progress, ProgressStepEntry } from '../types';

/** Emoji map for step status values */
const STATUS_EMOJI: Record<string, string> = {
    [StepStatus.Pending]: '⏳',
    [StepStatus.InProgress]: '🔄',
    [StepStatus.Complete]: '✅',
};

/** Status text map */
const STATUS_TEXT: Record<string, string> = {
    [StepStatus.Pending]: 'Pending',
    [StepStatus.InProgress]: 'In Progress',
    [StepStatus.Complete]: 'Complete',
};

/**
 * Write a full PROGRESS.md file from a {@link Progress} object.
 *
 * Produces output that `parseProgress` can round-trip parse.
 *
 * @param filePath - Absolute path to PROGRESS.md.
 * @param progress - The {@link Progress} data to write.
 */
export function writeProgress(filePath: string, progress: Progress): void {
    const lines: string[] = [];

    // Title
    lines.push(`# Progress — ${progress.planName}`);
    lines.push('');

    // Metadata
    lines.push(`**Plan**: ${progress.planName}`);
    lines.push(`**Branch**: ${progress.branch}`);
    lines.push(`**Created**: ${progress.created}`);
    lines.push('');

    // Table header
    lines.push('| Step | Status | Iteration | Last Commit |');
    lines.push('|------|--------|-----------|-------------|');

    // Table rows
    for (const step of progress.steps) {
        const emoji = STATUS_EMOJI[step.status] ?? '⏳';
        const statusText = STATUS_TEXT[step.status] ?? 'Pending';
        const iteration = step.iteration > 0 ? `${step.iteration}/5` : '-';
        const commit = step.lastCommit || '-';
        lines.push(`| ${step.label} | ${emoji} ${statusText} | ${iteration} | ${commit} |`);
    }

    lines.push('');

    // Last Action section
    lines.push('## Last Action');
    lines.push(`- **Agent**: ${progress.lastAction.agent}`);
    lines.push(`- **Action**: ${progress.lastAction.action}`);
    lines.push(`- **Timestamp**: ${progress.lastAction.timestamp}`);
    lines.push('');

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

/**
 * Update a single step in a Progress object, returning a new Progress.
 *
 * Does not mutate the input. Use this to update status, iteration, or commit
 * for a specific step, then call `writeProgress` to persist.
 *
 * @param progress - Current Progress state.
 * @param stepIndex - Zero-based index of the step to update.
 * @param updates - Partial step fields to merge.
 * @returns A new Progress with the specified step updated.
 */
export function updateProgressStep(
    progress: Progress,
    stepIndex: number,
    updates: Partial<Pick<ProgressStepEntry, 'status' | 'iteration' | 'lastCommit'>>
): Progress {
    const newSteps = progress.steps.map((step, i) =>
        i === stepIndex ? { ...step, ...updates } : step
    );
    return { ...progress, steps: newSteps };
}

/**
 * Update the Last Action metadata in a Progress object, returning a new Progress.
 *
 * Does not mutate the input.
 *
 * @param progress - Current Progress state.
 * @param agent - Agent name (e.g., "dev-agent" or "review-agent").
 * @param action - Description of the action.
 * @param timestamp - ISO or formatted timestamp string.
 * @returns A new Progress with updated lastAction.
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
 * Create an initial PROGRESS.md file with all steps set to Pending.
 *
 * @param filePath - Absolute path to PROGRESS.md.
 * @param planName - Plan name for the title and metadata.
 * @param branch - Git branch name.
 * @param stepLabels - Array of step labels (e.g., ["Step 1: Title", "Step 2: Title"]).
 */
export function initProgress(
    filePath: string,
    planName: string,
    branch: string,
    stepLabels: string[]
): void {
    const steps: ProgressStepEntry[] = stepLabels.map((label) => ({
        label,
        status: StepStatus.Pending,
        iteration: 0,
        lastCommit: '',
    }));

    const now = new Date();
    const created = now.toISOString().split('T')[0];

    const progress: Progress = {
        planName,
        branch,
        created,
        steps,
        lastAction: {
            agent: 'plan-agent',
            action: 'Plan created and PROGRESS.md seeded',
            timestamp: now.toISOString().replace('T', ' ').substring(0, 16),
        },
    };

    writeProgress(filePath, progress);
}
