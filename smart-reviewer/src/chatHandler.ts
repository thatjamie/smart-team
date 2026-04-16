import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StepStatus, Progress, ReviewFeedback, ChangesRequiredItem } from './types';
import { parsePlan, findPlanFile } from './parsers/planParser';
import { parseProgress } from './parsers/progressParser';
import { parseReviewFeedback } from './parsers/reviewFeedbackParser';
import { getLatestCommit, getProjectRoot, findDevWorktree } from './git';
import { buildReviewSystemPrompt } from './prompts/reviewSystemPrompt';
import { writeReviewFeedback } from './writers/reviewFeedbackWriter';
import { writeProgress, updateProgressStep, updateLastAction } from './writers/progressWriter';
import { ProviderFactory } from './ai/providerFactory';
import { AiMessage } from './ai/provider';
import { buildReviewContext } from './contextBuilder';

/**
 * Handle the @smart-reviewer chat participant request.
 *
 * Supports two sub-commands:
 * - /review [stepNumber] — Run an AI review on a specific step
 * - /status — Show current review status
 *
 * @param request - The chat request from VSCode
 * @param response - Stream for sending markdown responses to the chat
 * @param token - Cancellation token
 */
export async function handleChatRequest(
    request: vscode.ChatRequest,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
    planRoot: string | undefined,
    secretStorage: vscode.SecretStorage
): Promise<void> {
    const command = request.command;

    if (command === 'status') {
        await handleStatus(response, planRoot);
        return;
    }

    if (command === 'review') {
        await handleReview(request, response, token, planRoot, secretStorage);
        return;
    }

    // No command — show help
    response.markdown('Welcome to **Smart Reviewer**! Use:\n\n');
    response.markdown('- `/review [step]` \u2014 Review a step (e.g., `/review 2`)\n');
    response.markdown('- `/status` \u2014 Show current review status\n');
}

// ─── Status Command ──────────────────────────────────────────────────────────

async function handleStatus(
    response: vscode.ChatResponseStream,
    planRoot: string | undefined
): Promise<void> {
    if (!planRoot) {
        response.markdown('\u26A0\uFE0F No plan root found. Open a workspace with a PLAN.md file.');
        return;
    }

    const planFilePath = findPlanFile(planRoot);
    if (!planFilePath) {
        response.markdown('\u26A0\uFE0F No PLAN.md found in workspace.');
        return;
    }

    const progress = parseProgress(path.join(planRoot, 'PROGRESS.md'));
    const plan = parsePlan(planFilePath);

    response.markdown('\uD83D\uDCCB **Plan: ' + plan.name + '**\n\n');

    if (progress) {
        response.markdown('**Branch**: ' + progress.branch + '\n\n');

        const projectRoot = getProjectRoot(planRoot);
        if (projectRoot) {
            const worktree = findDevWorktree(projectRoot);
            response.markdown('**Worktree**: ' + (worktree.exists ? worktree.path : 'Not found') + '\n\n');
        }

        // Show step status
        response.markdown('| Step | Status | Iteration |\n');
        response.markdown('|------|--------|----------|\n');
        for (const step of progress.steps) {
            const statusIcon = step.status === StepStatus.Complete ? '\u2705' : step.status === StepStatus.InProgress ? '\uD83D\uDD04' : '\u23F3';
            const iter = step.iteration > 0 ? step.iteration + '/5' : '-';
            response.markdown('| ' + step.label + ' | ' + statusIcon + ' | ' + iter + ' |\n');
        }
        response.markdown('\n');

        if (progress.lastAction) {
            response.markdown('**Last**: ' + progress.lastAction.agent + ' \u2014 ' + progress.lastAction.action + '\n\n');
        }
    }

    // Check review feedback
    const feedbackPath = path.join(planRoot, 'REVIEW_FEEDBACK.md');
    const feedback = fs.existsSync(feedbackPath) ? parseReviewFeedback(feedbackPath) : undefined;
    if (feedback) {
        const statusIcon = feedback.status === 'APPROVED' ? '\u2705' : '\u274C';
        response.markdown(statusIcon + ' **Review Feedback**: ' + feedback.status + ' (' + feedback.changesRequired.length + ' issues)\n');
    } else {
        response.markdown('\uD83D\uDD0D No review feedback found.');
    }
}

// ─── Review Command ──────────────────────────────────────────────────────────

async function handleReview(
    request: vscode.ChatRequest,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
    planRoot: string | undefined,
    secretStorage: vscode.SecretStorage
): Promise<void> {
    if (!planRoot) {
        response.markdown('\u26A0\uFE0F No plan root found. Open a workspace with a PLAN.md file.');
        return;
    }

    const planFilePath = findPlanFile(planRoot);
    if (!planFilePath) {
        response.markdown('\u26A0\uFE0F No PLAN.md found in workspace.');
        return;
    }

    // Determine step to review
    const progress = parseProgress(path.join(planRoot, 'PROGRESS.md'));
    const plan = parsePlan(planFilePath);
    const stepArg = request.prompt.trim();
    let stepIndex: number;

    if (stepArg && !isNaN(Number(stepArg))) {
        stepIndex = parseInt(stepArg, 10) - 1; // Convert to zero-based
        if (stepIndex < 0 || stepIndex >= plan.steps.length) {
            response.markdown('\u26A0\uFE0F Invalid step number. Plan has ' + plan.steps.length + ' steps.');
            return;
        }
    } else {
        // Default: review the current in-progress step
        const currentStep = plan.steps.find(s => s.status === StepStatus.InProgress);
        if (!currentStep) {
            response.markdown('\u26A0\uFE0F No step is currently in progress. Specify a step number: `/review 2`');
            return;
        }
        stepIndex = currentStep.index;
    }

    const step = plan.steps[stepIndex];
    const stepNumber = stepIndex + 1;
    const iteration = progress
        ? (progress.steps[stepIndex]?.iteration || 1) + 1
        : 1;

    if (iteration > 5) {
        response.markdown('\u26A0\uFE0F **Max iterations reached (5/5)** for Step ' + stepNumber + '. Please escalate to the user for direction.');
        return;
    }

    response.markdown('\uD83D\uDD0D **Reviewing Step ' + stepNumber + ': ' + step.title + '** (iteration ' + iteration + '/5)\n\n');
    response.progress('Gathering review context...');

    // Build full review context using contextBuilder
    const reviewContext = buildReviewContext(planRoot, stepIndex, iteration);
    if (!reviewContext) {
        response.markdown('\u26A0\uFE0F Could not build review context. Ensure dev worktree exists with commits.');
        return;
    }

    if (!reviewContext.promptContext.diff || reviewContext.promptContext.diff.trim().length === 0) {
        response.markdown('\u26A0\uFE0F No diff found. Ensure the dev worktree has commits.');
        return;
    }

    // Build messages
    const systemPrompt = buildReviewSystemPrompt(reviewContext.promptContext);
    const messages: AiMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Please review Step ' + stepNumber + ': ' + step.title + '. Produce your review in the REVIEW_FEEDBACK.md format.' },
    ];

    // Send to AI with streaming
    response.progress('Sending to AI for review...');
    let aiResponseText = '';

    try {
        const provider = await ProviderFactory.create(secretStorage);
        const aiResponse = await provider.stream(
            messages,
            (chunk) => {
                if (!token.isCancellationRequested) {
                    response.markdown(chunk);
                    aiResponseText += chunk;
                }
            }
        );
        aiResponseText = aiResponse.text;
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        response.markdown('\n\n\u274C **AI Error**: ' + errorMsg);
        return;
    }

    if (token.isCancellationRequested) {
        return;
    }

    // Parse AI response into structured feedback
    const feedback = parseAiResponse(aiResponseText, stepIndex, reviewContext.step.title, iteration);
    if (!feedback) {
        response.markdown('\n\n\u26A0\uFE0F Could not parse AI response into structured feedback.');
        return;
    }

    // 8. Ask user for approval
    response.markdown('\n\n---\n\n');
    const statusLabel = feedback.status === 'APPROVED' ? '\u2705 APPROVED' : '\u274C CHANGES_REQUIRED';
    response.markdown('**Review Result**: ' + statusLabel + ' (' + feedback.changesRequired.length + ' issues)\n\n');

    const userChoice = await vscode.window.showInformationMessage(
        'Review complete: ' + feedback.status + '. Write REVIEW_FEEDBACK.md and update PROGRESS.md?',
        { modal: false },
        'Write & Save',
        'Discard'
    );

    if (userChoice === 'Write & Save') {
        // 9. Write REVIEW_FEEDBACK.md
        writeReviewFeedback(path.join(planRoot, 'REVIEW_FEEDBACK.md'), feedback);

        // Update PROGRESS.md — keep step as In Progress (reviewer never marks Complete)
        if (reviewContext.progress) {
            let updatedProgress = updateProgressStep(reviewContext.progress, stepIndex, {
                status: StepStatus.InProgress,
                iteration: iteration,
                lastCommit: getLatestCommit(reviewContext.worktreePath) || reviewContext.step.lastCommit,
            });

            const now = new Date();
            const timestamp = now.getFullYear() + '-' +
                String(now.getMonth() + 1).padStart(2, '0') + '-' +
                String(now.getDate()).padStart(2, '0') + ' ' +
                String(now.getHours()).padStart(2, '0') + ':' +
                String(now.getMinutes()).padStart(2, '0');

            updatedProgress = updateLastAction(
                updatedProgress,
                'review-agent',
                'Reviewed Step ' + stepNumber + ', iteration ' + iteration + ' \u2014 ' + feedback.status,
                timestamp
            );

            writeProgress(path.join(planRoot, 'PROGRESS.md'), updatedProgress);
        }

        response.markdown('\u2705 Review feedback written to REVIEW_FEEDBACK.md and PROGRESS.md updated.');
        response.markdown('\n\n\uD83D\uDD04 **Step ' + stepNumber + ' remains In Progress.**');

        // 11. Phase 2: If APPROVED, ask user to explicitly approve marking Complete
        if (feedback.status === 'APPROVED') {
            response.markdown('\n\n\u2705 The review was **APPROVED**. ');
            const approvalChoice = await vscode.window.showInformationMessage(
                'Review APPROVED for Step ' + stepNumber + '. Mark step as Complete?',
                { modal: false },
                'Mark Complete',
                'Keep In Progress'
            );

            if (approvalChoice === 'Mark Complete') {
                // Re-read and update PROGRESS.md to mark Complete
                const updatedProgress2 = parseProgress(path.join(planRoot, 'PROGRESS.md'));
                if (updatedProgress2) {
                    let finalProgress = updateProgressStep(updatedProgress2, stepIndex, {
                        status: StepStatus.Complete,
                    });

                    const now2 = new Date();
                    const timestamp2 = now2.getFullYear() + '-' +
                        String(now2.getMonth() + 1).padStart(2, '0') + '-' +
                        String(now2.getDate()).padStart(2, '0') + ' ' +
                        String(now2.getHours()).padStart(2, '0') + ':' +
                        String(now2.getMinutes()).padStart(2, '0');

                    finalProgress = updateLastAction(
                        finalProgress,
                        'review-agent',
                        'Step ' + stepNumber + ' APPROVED and marked Complete by user',
                        timestamp2
                    );

                    writeProgress(path.join(planRoot, 'PROGRESS.md'), finalProgress);
                }
                response.markdown('\u2705 **Step ' + stepNumber + ' marked as Complete.**');
            } else {
                response.markdown('\u23F8 Step ' + stepNumber + ' kept In Progress.');
            }
        } else {
            response.markdown('\n\n\u274C **CHANGES_REQUIRED** \u2014 Address the ' + feedback.changesRequired.length + ' issues and re-review.');
        }
    } else {
        response.markdown('\n\u23F8 Review discarded. No files were written.');
    }
}

// ─── AI Response Parser ──────────────────────────────────────────────────────

/**
 * Parse the AI's text response into a structured ReviewFeedback object.
 * Extracts sections based on markdown headings.
 */
function parseAiResponse(
    text: string,
    stepIndex: number,
    stepTitle: string,
    iteration: number
): ReviewFeedback | undefined {
    // Extract status from the Iteration section specifically
    const iterSection = text.match(/##\s*Iteration[\s\S]*?(?=\n##|$)/i);
    const statusText = iterSection ? iterSection[0] : '';
    const status = statusText.includes('CHANGES_REQUIRED') ? 'CHANGES_REQUIRED' as const
        : statusText.includes('APPROVED') ? 'APPROVED' as const
        : 'CHANGES_REQUIRED' as const; // safe default

    // Extract summary
    const summaryMatch = text.match(/##\s+Summary\s*\n([\s\S]*?)(?=\n##|$)/i);
    const summary = summaryMatch ? summaryMatch[1].trim() : '';

    // Extract approved items
    const approvedItems = extractBulletSection(text, ['\u2705 Approved', 'Approved Items', 'Approved']);

    // Extract changes required
    const changesRequired = extractChangesRequired(text);

    // Extract suggestions
    const suggestions = extractBulletSection(text, ['\uD83D\uDCA1 Suggestions', 'Suggestions']);

    // Extract questions
    const questions = extractBulletSection(text, ['\u2753 Questions', 'Questions']);

    return {
        stepIndex,
        stepTitle,
        summary,
        approvedItems,
        changesRequired,
        suggestions,
        questions,
        iteration,
        status,
    };
}

function extractBulletSection(text: string, headings: string[]): string[] {
    const items: string[] = [];
    const lines = text.split('\n');
    let inSection = false;

    for (const line of lines) {
        const headingMatch = line.match(/^##\s+(.+)$/);
        if (headingMatch) {
            const heading = headingMatch[1];
            if (headings.some(h => heading.includes(h))) {
                inSection = true;
                continue;
            }
            if (inSection) { break; }
            continue;
        }
        if (!inSection) { continue; }

        const bulletMatch = line.match(/^\s*-\s+(.+)$/);
        if (bulletMatch) {
            items.push(bulletMatch[1].trim());
        }
    }
    return items;
}

function extractChangesRequired(text: string): ChangesRequiredItem[] {
    const items: ChangesRequiredItem[] = [];
    const lines = text.split('\n');
    let inSection = false;

    for (const line of lines) {
        const headingMatch = line.match(/^##\s+(.+)$/);
        if (headingMatch) {
            const heading = headingMatch[1];
            if (heading.includes('\u274C Changes Required') || heading.includes('Changes Required')) {
                inSection = true;
                continue;
            }
            if (inSection) { break; }
            continue;
        }
        if (!inSection) { continue; }

        // Match checkbox items
        const itemMatch = line.match(/^\s*-\s*\[?\s*[ x]\]?\s*\*\*(.+?)\*\*:?\s*(.*)$/);
        if (itemMatch) {
            items.push({
                description: itemMatch[1].trim(),
                howToFix: itemMatch[2].trim(),
                resolved: false,
            });
        }

        if (line.trim() === 'None.' || line.trim() === 'None') {
            break;
        }
    }
    return items;
}
