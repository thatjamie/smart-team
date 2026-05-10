/**
 * Chat handler for the Smart Developer extension.
 *
 * Implements the four chat commands:
 * - `/implement [step]` — AI implements a step
 * - `/commit` — show diff and commit changes
 * - `/feedback` — address review feedback
 * - `/status` — show plan state and step statuses
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
    parsePlan,
    parseProgress,
    parseReviewFeedback,
    findPlanFile,
    findDevWorktree,
    getProjectRoot,
    getProjectName,
    createDevWorktree,
    commitChanges,
    execGit,
    hasUncommittedChanges,
    openDiffEditor,
    getLatestCommit,
    ProviderFactory,
    writeProgress,
    writeDevNotes,
    updateProgressStep,
    updateLastAction,
    appendDecision,
    StepStatus,
} from 'smart-team-common';
import type { Plan, Progress, WorktreeInfo, AiMessage } from 'smart-team-common';
import { buildDevSystemPrompt } from './prompts/devSystemPrompt';
import { buildDevContext } from './contextBuilder';
import { parseDevResponse, applyFileChanges } from './fileApplier';
import type { DecisionEntry } from './types';

// ─── Chat Handler ────────────────────────────────────────────────────────────

/**
 * Handle a chat request for the Smart Developer participant.
 *
 * Dispatches to the appropriate command handler based on the user's message.
 *
 * @param request - The incoming chat request from VSCode.
 * @param context - The chat context (previous messages, participant info).
 * @param stream - The response stream for sending messages to the chat.
 * @param secretStorage - VSCode SecretStorage for API keys.
 */
export async function handleChatRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    secretStorage: vscode.SecretStorage
): Promise<void> {
    const command = request.command;

    switch (command) {
        case 'implement':
            await handleImplement(request, stream, secretStorage);
            break;
        case 'commit':
            await handleCommit(request, stream);
            break;
        case 'feedback':
            await handleFeedback(request, stream, secretStorage);
            break;
        case 'status':
            await handleStatus(request, stream);
            break;
        default:
            // No command — show help
            stream.markdown(getHelpText());
            break;
    }
}

// ─── /implement ──────────────────────────────────────────────────────────────

async function handleImplement(
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream,
    secretStorage: vscode.SecretStorage
): Promise<void> {
    // 1. Find plan
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        stream.markdown('❌ No workspace folder open.');
        return;
    }

    const planFilePath = findPlanFile(workspaceRoot, 3);
    if (!planFilePath) {
        stream.markdown('❌ No PLAN.md found in workspace.');
        return;
    }

    const planRoot = path.dirname(planFilePath);
    const plan = parsePlan(planFilePath);
    const progress = parseProgress(path.join(planRoot, 'PROGRESS.md'));

    // 2. Determine step index
    const stepArg = request.prompt?.trim();
    let stepIndex: number;

    if (stepArg) {
        const parsed = parseInt(stepArg, 10);
        if (isNaN(parsed) || parsed < 1 || parsed > plan.steps.length) {
            stream.markdown(`❌ Invalid step number "${stepArg}". Plan has ${plan.steps.length} steps.`);
            return;
        }
        stepIndex = parsed - 1; // Convert to zero-based
    } else {
        // Find current in-progress step, or first pending
        const inProgress = plan.steps.findIndex(s => s.status === StepStatus.InProgress);
        const pending = plan.steps.findIndex(s => s.status === StepStatus.Pending);
        stepIndex = inProgress >= 0 ? inProgress : pending;
        if (stepIndex < 0) {
            stream.markdown('✅ All steps are complete!');
            return;
        }
    }

    const step = plan.steps[stepIndex];
    stream.markdown(`🔄 Implementing **Step ${stepIndex + 1}: ${step.title}**...\n\n`);

    // 3. Resolve or create the dev worktree
    const projectRoot = getProjectRoot(workspaceRoot);
    if (!projectRoot) {
        stream.markdown('❌ Not inside a git repository.');
        return;
    }

    // Detect if we're already in the dev worktree
    const projectName = getProjectName(projectRoot);
    let worktreeInfo: WorktreeInfo;
    if (projectName.endsWith('-dev')) {
        // Already in the dev worktree — use it directly
        try {
            const branch = execGit(projectRoot, ['branch', '--show-current']);
            worktreeInfo = { path: projectRoot, branch, exists: true };
        } catch {
            worktreeInfo = { path: projectRoot, branch: '', exists: true };
        }
    } else {
        // In the main worktree — create or find the dev worktree
        worktreeInfo = createDevWorktree(projectRoot, plan.name);
        if (!worktreeInfo.exists) {
            stream.markdown('❌ Failed to create dev worktree.');
            return;
        }
    }

    // 3b. Resolve plan root inside the worktree
    // The worktree has its own copy of the repo, so plan files live there.
    const rel = path.relative(projectRoot, planRoot);
    const worktreePlanRoot = rel ? path.join(worktreeInfo.path, rel) : worktreeInfo.path;

    // 3c. Sync plan files from workspace to worktree if missing
    // (needed when the main repo has no commits yet — worktree won't have these files)
    const planFilesToSync = ['PLAN.md', 'PROGRESS.md'];
    for (const fileName of planFilesToSync) {
        const srcPath = path.join(planRoot, fileName);
        const dstPath = path.join(worktreePlanRoot, fileName);
        if (fs.existsSync(srcPath) && !fs.existsSync(dstPath)) {
            fs.mkdirSync(path.dirname(dstPath), { recursive: true });
            fs.copyFileSync(srcPath, dstPath);
        }
    }

    // 4. Build context
    const devContext = buildDevContext(planRoot, stepIndex, plan, progress, worktreeInfo.path);

    // 5. Build system prompt
    const systemPrompt = buildDevSystemPrompt(devContext);

    // 6. Stream to AI
    stream.markdown('📡 Sending to AI...\n\n');

    let aiResponse: string;
    try {
        const provider = await ProviderFactory.create(secretStorage, 'smart-developer');
        const messages: AiMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Implement Step ${stepIndex + 1}: ${step.title} now.` },
        ];

        let fullText = '';
        const response = await provider.stream(
            messages,
            (chunk) => {
                fullText += chunk;
            }
        );
        aiResponse = response.text;
    } catch (err) {
        stream.markdown(`❌ AI provider error: ${err instanceof Error ? err.message : String(err)}`);
        return;
    }

    // 7. Parse response
    const devAction = parseDevResponse(aiResponse);
    if (!devAction) {
        stream.markdown('❌ Failed to parse AI response. The AI output was not in the expected XML format.\n\n');
        stream.markdown('**Raw response:**\n```\n' + aiResponse.substring(0, 500) + '\n```\n');
        return;
    }

    stream.markdown(`📝 **Summary:** ${devAction.summary}\n\n`);

    // 8. Apply file changes
    const result = applyFileChanges(worktreeInfo.path, devAction.fileChanges);
    stream.markdown(`✅ Applied **${result.applied}** file(s):\n`);
    for (const p of result.paths) {
        stream.markdown(`  - \`${p}\`\n`);
    }
    stream.markdown('\n');

    // 9. Write DEV_NOTES.md using common writer
    if (devAction.devNotesContent) {
        const devNotesPath = path.join(worktreePlanRoot, 'DEV_NOTES.md');
        writeDevNotes(
            devNotesPath,
            stepIndex + 1,
            step.title,
            {
                whatWasImplemented: [devAction.summary],
                filesChanged: devAction.fileChanges.map(f => `${f.filePath} — ${f.action}`),
                decisions: devAction.decisions.map(d => d.decision),
                questions: [],
            }
        );
        stream.markdown('📝 DEV_NOTES.md written.\n');
    }

    // 10. Write decisions to DECISIONS.md
    if (devAction.decisions.length > 0) {
        const decisionsPath = path.join(worktreePlanRoot, 'DECISIONS.md');
        const stepLabel = `Step ${stepIndex + 1}: ${step.title}`;
        for (const d of devAction.decisions) {
            appendDecision(decisionsPath, stepLabel, {
                decision: d.decision,
                context: d.context,
                rationale: d.rationale,
                date: new Date().toISOString().split('T')[0],
            });
        }
        stream.markdown(`📋 ${devAction.decisions.length} decision(s) appended to DECISIONS.md.\n`);
    }

    // 11. Update PROGRESS.md to mark step as in-progress
    const iteration = progress?.steps[stepIndex]?.iteration ?? 0;
    const newIteration = iteration + 1;
    if (progress) {
        let updated = updateProgressStep(progress, stepIndex, {
            status: StepStatus.InProgress,
            iteration: newIteration,
            lastCommit: progress.steps[stepIndex]?.lastCommit ?? '',
        });
        updated = updateLastAction(
            updated,
            'dev-agent',
            `Implemented Step ${stepIndex + 1}, iteration ${newIteration} (awaiting commit)`,
            new Date().toISOString().replace('T', ' ').substring(0, 16)
        );
        writeProgress(path.join(worktreePlanRoot, 'PROGRESS.md'), updated);
        stream.markdown('📋 PROGRESS.md updated — step marked as in-progress.\n');
    }

    // 12. Show diff (use staged diff — files were written via fs.writeFileSync, not committed)
    const diff = getStagedDiff(worktreeInfo.path);
    if (diff) {
        stream.markdown('\n📊 **Diff preview:**\n```\n' + diff.substring(0, 2000) + (diff.length > 2000 ? '\n... (truncated)' : '') + '\n```\n\n');
        stream.markdown('💡 Full diff opened in editor tab.\n');
        await openDiffEditor(diff, `Step ${stepIndex + 1}: ${step.title}`);
    }

    stream.markdown('\n---\n✅ Implementation complete. Review the changes and use `/commit` when ready.');
}

// ─── /commit ─────────────────────────────────────────────────────────────────

async function handleCommit(
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream
): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        stream.markdown('❌ No workspace folder open.');
        return;
    }

    const planFilePath = findPlanFile(workspaceRoot, 3);
    if (!planFilePath) {
        stream.markdown('❌ No PLAN.md found in workspace.');
        return;
    }

    const planRoot = path.dirname(planFilePath);

    // Resolve dev worktree (works from either main or dev worktree)
    const resolved = resolveDevWorktree(workspaceRoot);
    if (!resolved) {
        stream.markdown('❌ Could not find or access the dev worktree.');
        return;
    }
    const { worktreeInfo, projectRoot } = resolved;

    // Resolve plan root inside the worktree and read state from there
    const rel = path.relative(projectRoot, planRoot);
    const worktreePlanRoot = rel ? path.join(worktreeInfo.path, rel) : worktreeInfo.path;
    const progress = parseProgress(path.join(worktreePlanRoot, 'PROGRESS.md'));
    const plan = parsePlan(planFilePath, progress);

    // Find current step
    const currentIdx = plan.steps.findIndex(s => s.status === StepStatus.InProgress);
    if (currentIdx < 0) {
        stream.markdown('❌ No step is currently in progress.');
        return;
    }

    const step = plan.steps[currentIdx];
    const iteration = progress?.steps[currentIdx]?.iteration ?? 1;

    // Check for uncommitted changes first
    if (!hasUncommittedChanges(worktreeInfo.path)) {
        stream.markdown('❌ No uncommitted changes found in the dev worktree.');
        return;
    }

    // Stage all changes and show the staged diff
    const diff = getStagedDiff(worktreeInfo.path);
    if (!diff) {
        stream.markdown('❌ No changes to commit.');
        return;
    }

    stream.markdown(`📊 **Diff for Step ${currentIdx + 1}: ${step.title}**\n\n`);
    stream.markdown('```\n' + diff.substring(0, 2000) + (diff.length > 2000 ? '\n... (truncated)' : '') + '\n```\n\n');
    await openDiffEditor(diff, `Commit: Step ${currentIdx + 1}: ${step.title}`);

    // Ask for confirmation
    const confirm = await vscode.window.showWarningMessage(
        `Commit changes for Step ${currentIdx + 1}: ${step.title}?`,
        { modal: true },
        'Commit'
    );

    if (confirm !== 'Commit') {
        stream.markdown('⏸️ Commit cancelled.');
        return;
    }

    // Commit
    const commitMessage = `feat(${plan.name}): step ${currentIdx + 1} - ${step.title}\n\nRefs: PLAN.md Step ${currentIdx + 1}`;
    const commitHash = commitChanges(worktreeInfo.path, commitMessage);

    stream.markdown(`✅ Committed: \`${commitHash}\`\n`);

    // Update PROGRESS.md
    if (progress) {
        let updated = updateProgressStep(progress, currentIdx, {
            status: StepStatus.InProgress,
            iteration,
            lastCommit: commitHash,
        });
        updated = updateLastAction(
            updated,
            'dev-agent',
            `Committed Step ${currentIdx + 1}, iteration ${iteration}`,
            new Date().toISOString().replace('T', ' ').substring(0, 16)
        );
        writeProgress(path.join(worktreePlanRoot, 'PROGRESS.md'), updated);
        stream.markdown('📋 PROGRESS.md updated.\n');
    }

    stream.markdown('\n---\n✅ Commit complete. Changes are ready for review.');
}

// ─── /feedback ───────────────────────────────────────────────────────────────

async function handleFeedback(
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream,
    secretStorage: vscode.SecretStorage
): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        stream.markdown('❌ No workspace folder open.');
        return;
    }

    const planFilePath = findPlanFile(workspaceRoot, 3);
    if (!planFilePath) {
        stream.markdown('❌ No PLAN.md found in workspace.');
        return;
    }

    const planRoot = path.dirname(planFilePath);

    // Resolve dev worktree (works from either main or dev worktree)
    const resolved = resolveDevWorktree(workspaceRoot);
    const worktreePlanRoot = resolved
        ? (() => {
            const rel = path.relative(resolved.projectRoot, planRoot);
            return rel ? path.join(resolved.worktreeInfo.path, rel) : resolved.worktreeInfo.path;
        })()
        : planRoot;

    const feedbackPath = path.join(worktreePlanRoot, 'REVIEW_FEEDBACK.md');

    if (!fs.existsSync(feedbackPath)) {
        stream.markdown('❌ No REVIEW_FEEDBACK.md found. Has the reviewer provided feedback?');
        return;
    }

    const feedback = parseReviewFeedback(feedbackPath);
    if (!feedback) {
        stream.markdown('❌ Could not parse REVIEW_FEEDBACK.md.');
        return;
    }

    stream.markdown(`📋 **Review Feedback — Step ${feedback.stepIndex + 1}: ${feedback.stepTitle}**\n`);
    stream.markdown(`**Status:** ${feedback.status} | **Iteration:** ${feedback.iteration}/5\n\n`);

    if (feedback.status === 'APPROVED') {
        stream.markdown('✅ Step approved!\n\n');

        // Offer to mark step complete
        const markComplete = await vscode.window.showInformationMessage(
            `Step ${feedback.stepIndex + 1} was approved. Mark as complete?`,
            'Mark Complete',
            'Skip'
        );

        if (markComplete === 'Mark Complete') {
            const progress = parseProgress(path.join(worktreePlanRoot, 'PROGRESS.md'));
            if (progress) {
                let updated = updateProgressStep(progress, feedback.stepIndex, {
                    status: StepStatus.Complete,
                });
                updated = updateLastAction(
                    updated,
                    'dev-agent',
                    `Marked Step ${feedback.stepIndex + 1} as Complete (review approved)`,
                    new Date().toISOString().replace('T', ' ').substring(0, 16)
                );
                writeProgress(path.join(worktreePlanRoot, 'PROGRESS.md'), updated);
                stream.markdown('✅ PROGRESS.md updated — step marked as Complete.');
            }
        }
        return;
    }

    // CHANGES_REQUIRED — re-run implement with feedback in context
    stream.markdown(`❌ **${feedback.changesRequired.length} issue(s) to address:**\n`);
    for (const issue of feedback.changesRequired) {
        stream.markdown(`  - ${issue.description}\n`);
    }
    stream.markdown('\n🔄 Re-implementing with feedback...\n\n');

    // Delegate to implement flow — the context builder will pick up REVIEW_FEEDBACK.md
    // because iteration > 1
    await handleImplement(request, stream, secretStorage);
}

// ─── /status ─────────────────────────────────────────────────────────────────

async function handleStatus(
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream
): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        stream.markdown('❌ No workspace folder open.');
        return;
    }

    const planFilePath = findPlanFile(workspaceRoot, 3);
    if (!planFilePath) {
        stream.markdown('❌ No PLAN.md found in workspace.');
        return;
    }

    const planRoot = path.dirname(planFilePath);
    const progress = parseProgress(path.join(planRoot, 'PROGRESS.md'));
    const plan = parsePlan(planFilePath, progress);
    const resolved = resolveDevWorktree(workspaceRoot);

    // Header
    stream.markdown(`## 📋 Plan: **${plan.name}**\n\n`);
    stream.markdown(`- **Branch:** ${progress?.branch ?? 'unknown'}\n`);
    stream.markdown(`- **Worktree:** ${resolved?.worktreeInfo?.exists ? `\`${resolved.worktreeInfo.path}\`` : 'none'}\n`);
    stream.markdown(`- **Steps:** ${plan.steps.length}\n\n`);

    // Step table
    stream.markdown('| # | Step | Status | Iter | Commit |\n');
    stream.markdown('|---|------|--------|------|--------|\n');

    for (const step of plan.steps) {
        const icon = step.status === StepStatus.Complete ? '✅'
            : step.status === StepStatus.InProgress ? '🔄'
            : '⏳';
        const iter = step.iteration > 0 ? `${step.iteration}/5` : '-';
        const commit = step.lastCommit || '-';
        stream.markdown(`| ${step.index + 1} | ${step.title} | ${icon} | ${iter} | \`${commit}\` |\n`);
    }

    // Last action
    if (progress?.lastAction) {
        stream.markdown(`\n**Last Action:** ${progress.lastAction.action} (${progress.lastAction.agent}) — ${progress.lastAction.timestamp}\n`);
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve the dev worktree regardless of which worktree VSCode is opened in.
 *
 * Handles two scenarios:
 * 1. VSCode opened in **main worktree** → `findDevWorktree()` works normally
 * 2. VSCode opened in **dev worktree** → detect via `-dev` suffix, use it directly
 *
 * @param workspaceRoot - The VSCode workspace root path.
 * @returns `{ worktreeInfo, projectRoot }` where `worktreeInfo` points to the dev
 *          worktree and `projectRoot` is the main repo root, or `undefined` on failure.
 */
function resolveDevWorktree(workspaceRoot: string): {
    worktreeInfo: WorktreeInfo;
    projectRoot: string;
} | undefined {
    const projectRoot = getProjectRoot(workspaceRoot);
    if (!projectRoot) {
        return undefined;
    }

    // Check if we're already inside the dev worktree (name ends with -dev)
    const projectName = getProjectName(projectRoot);
    if (projectName.endsWith('-dev')) {
        // We ARE the dev worktree — return self
        try {
            const branch = execGit(projectRoot, ['branch', '--show-current']);
            return { worktreeInfo: { path: projectRoot, branch, exists: true }, projectRoot };
        } catch {
            return { worktreeInfo: { path: projectRoot, branch: '', exists: true }, projectRoot };
        }
    }

    // Normal case: we're in the main worktree, find the dev worktree
    const worktreeInfo = findDevWorktree(projectRoot);
    if (!worktreeInfo?.exists) {
        return undefined;
    }
    return { worktreeInfo, projectRoot };
}

/**
 * Get a diff that captures uncommitted (working directory) changes.
 *
 * Stages all changes with `git add -A`, then returns `git diff --cached`.
 * This is the correct diff to use after `/implement` writes files via
 * `fs.writeFileSync` (no commits yet).
 *
 * @param worktreeDir - Absolute path to the worktree directory.
 * @returns The staged diff string, or empty string if nothing to show.
 */
function getStagedDiff(worktreeDir: string): string {
    try {
        // Stage everything so new files appear in the diff
        execGit(worktreeDir, ['add', '-A']);
        const diff = execGit(worktreeDir, ['diff', '--cached']);
        return diff;
    } catch {
        return '';
    }
}

function getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    return folders?.[0]?.uri?.fsPath;
}

function getHelpText(): string {
    return `## Smart Developer Commands

- \`/implement [step]\` — AI implements a plan step (e.g., \`/implement 2\`)
- \`/commit\` — Review diff and commit current changes
- \`/feedback\` — Address review feedback from REVIEW_FEEDBACK.md
- \`/status\` — Show plan state and step statuses

Type a command to get started!`;
}
