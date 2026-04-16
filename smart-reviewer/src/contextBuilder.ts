import * as path from 'path';
import * as fs from 'fs';
import { Plan, Step, StepStatus, Progress } from './types';
import { parsePlan, findPlanFile } from './parsers/planParser';
import { parseProgress } from './parsers/progressParser';
import { parseDevNotes } from './parsers/devNotesParser';
import { parseDecisions } from './parsers/decisionsParser';
import { getProjectRoot, findDevWorktree } from './git';
import { getDiffForStep } from './diffViewer';
import { ReviewPromptContext } from './prompts/reviewSystemPrompt';

/**
 * Result of building review context.
 * Contains all the data needed to run an AI review.
 */
export interface ReviewContextResult {
    /** The plan being reviewed */
    plan: Plan;
    /** The step being reviewed */
    step: Step;
    /** Zero-based step index */
    stepIndex: number;
    /** Current iteration (1-based) */
    iteration: number;
    /** Progress state */
    progress: Progress | undefined;
    /** Dev worktree path */
    worktreePath: string;
    /** Assembled prompt context for the AI */
    promptContext: ReviewPromptContext;
}

/**
 * Build the full review context for a given step.
 *
 * Gathers all shared state files (PROGRESS.md, DEV_NOTES.md, DECISIONS.md),
 * finds the dev worktree, retrieves the diff, and assembles everything
 * into a ReviewContextResult ready for AI review.
 *
 * @param planRoot - Directory containing PLAN.md
 * @param stepIndex - Zero-based step index to review
 * @param iteration - Current review iteration (1-based)
 * @returns ReviewContextResult with all context, or undefined on error
 */
export function buildReviewContext(
    planRoot: string,
    stepIndex: number,
    iteration: number
): ReviewContextResult | undefined {
    // 1. Parse plan
    const planFilePath = findPlanFile(planRoot);
    if (!planFilePath) {
        return undefined;
    }

    const progress = parseProgress(path.join(planRoot, 'PROGRESS.md'));
    const plan = parsePlan(planFilePath);

    if (stepIndex < 0 || stepIndex >= plan.steps.length) {
        return undefined;
    }

    const step = plan.steps[stepIndex];

    // 2. Find dev worktree
    const projectRoot = getProjectRoot(planRoot);
    if (!projectRoot) {
        return undefined;
    }

    const worktree = findDevWorktree(projectRoot);
    if (!worktree.exists) {
        return undefined;
    }

    // 3. Gather context files
    const devNotes = parseDevNotes(path.join(planRoot, 'DEV_NOTES.md'));
    const decisions = parseDecisions(path.join(planRoot, 'DECISIONS.md'));

    // 4. Get diff
    const diff = getDiffForStep(worktree.path, iteration - 1);

    // 5. Build prompt context
    const promptContext: ReviewPromptContext = {
        planStep: step.content,
        planFull: plan.steps.map(s => '## ' + s.title + '\n' + s.content).join('\n\n'),
        progressState: readTextFile(path.join(planRoot, 'PROGRESS.md')),
        devNotes: devNotes ? devNotes.raw : 'No DEV_NOTES.md found.',
        pastDecisions: decisions.length > 0
            ? decisions.map(d => '- **' + d.decision + '** (' + d.step + '): ' + d.rationale).join('\n')
            : 'No decisions recorded.',
        diff: diff,
    };

    return {
        plan,
        step,
        stepIndex,
        iteration,
        progress,
        worktreePath: worktree.path,
        promptContext,
    };
}

/**
 * Convenience: find the current in-progress step and build context for it.
 *
 * @param planRoot - Directory containing PLAN.md
 * @returns ReviewContextResult for the current step, or undefined
 */
export function buildCurrentStepContext(planRoot: string): ReviewContextResult | undefined {
    const planFilePath = findPlanFile(planRoot);
    if (!planFilePath) {
        return undefined;
    }

    const progress = parseProgress(path.join(planRoot, 'PROGRESS.md'));
    const plan = parsePlan(planFilePath);

    const currentStep = plan.steps.find(s => s.status === StepStatus.InProgress);
    if (!currentStep) {
        return undefined;
    }

    const iteration = progress
        ? (progress.steps[currentStep.index]?.iteration || 0) + 1
        : 1;

    return buildReviewContext(planRoot, currentStep.index, iteration);
}

/**
 * Read a text file, returning a fallback string if not found.
 */
function readTextFile(filePath: string, fallback: string = 'File not found.'): string {
    try {
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf-8');
        }
    } catch {
        // Fall through to fallback
    }
    return fallback;
}
