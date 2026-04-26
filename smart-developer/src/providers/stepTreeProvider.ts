/**
 * Sidebar tree view provider for the Smart Developer extension.
 *
 * Displays plan info, worktree status, dev files, and all steps with
 * status icons. Uses shared parsers from smart-team-common.
 * File items are clickable and open in the editor.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
    parsePlan,
    parseProgress,
    parseDevNotes,
    parseDecisions,
    parseReviewFeedback,
    findPlanFile,
    findDevWorktree,
    getProjectRoot,
    StepStatus,
} from 'smart-team-common';
import type { Plan, Progress, WorktreeInfo } from 'smart-team-common';

// ─── Tree Item Types ────────────────────────────────────────────────────────

/** Discriminator for tree item types. */
type TreeItemType =
    | 'planInfo'
    | 'worktree'
    | 'currentStep'
    | 'devFilesHeader'
    | 'devFile'
    | 'stepsHeader'
    | 'step'
    | 'noPlan';

/**
 * A single tree item in the Smart Developer sidebar.
 */
class DevTreeItem extends vscode.TreeItem {
    constructor(
        public readonly type: TreeItemType,
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        options?: {
            description?: string;
            tooltip?: string;
            resourceUri?: vscode.Uri;
            command?: vscode.Command;
            iconPath?: vscode.ThemeIcon;
        }
    ) {
        super(label, collapsibleState);
        this.description = options?.description ?? '';
        this.tooltip = options?.tooltip ?? label;
        this.iconPath = options?.iconPath;
        this.command = options?.command;
        if (options?.resourceUri) {
            this.resourceUri = options.resourceUri;
        }
    }
}

// ─── Provider ───────────────────────────────────────────────────────────────

/**
 * Tree data provider for the Smart Developer sidebar.
 *
 * Reads PLAN.md, PROGRESS.md, and related files to populate a hierarchical
 * tree view with plan info, worktree details, dev files, and step statuses.
 */
export class StepTreeProvider implements vscode.TreeDataProvider<DevTreeItem> {

    private _onDidChangeTreeData = new vscode.EventEmitter<DevTreeItem | undefined | null>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    /** Plan root directory (where PLAN.md lives). */
    private planRoot: string | undefined;

    /**
     * Create a new StepTreeProvider.
     *
     * @param workspaceRoot - The workspace root directory to search for PLAN.md.
     */
    constructor(private workspaceRoot: string | undefined) {
        this.refresh();
    }

    /**
     * Refresh the tree view. Call when files change.
     */
    refresh(): void {
        this.planRoot = undefined;
        this._onDidChangeTreeData.fire(undefined);
    }

    /**
     * Get the tree item representation for an element.
     */
    getTreeItem(element: DevTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get the children of an element (or root if element is undefined).
     */
    getChildren(element?: DevTreeItem): DevTreeItem[] {
        if (!element) {
            return this.getRootChildren();
        }

        switch (element.type) {
            case 'devFilesHeader':
                return this.getDevFileChildren();
            case 'stepsHeader':
                return this.getStepChildren();
            default:
                return [];
        }
    }

    // ─── Root Level ──────────────────────────────────────────────────────

    private getRootChildren(): DevTreeItem[] {
        if (!this.workspaceRoot) {
            return [this.createNoPlanItem('No workspace folder open')];
        }

        // Find PLAN.md
        const planFilePath = findPlanFile(this.workspaceRoot, 3);
        if (!planFilePath) {
            return [this.createNoPlanItem('No PLAN.md found in workspace')];
        }

        this.planRoot = path.dirname(planFilePath);

        // Parse plan and progress
        const plan = parsePlan(planFilePath);
        const progress = parseProgress(path.join(this.planRoot, 'PROGRESS.md'));

        // Get worktree info
        const projectRoot = getProjectRoot(this.workspaceRoot);
        const worktreeInfo = projectRoot ? findDevWorktree(projectRoot) : undefined;

        const items: DevTreeItem[] = [];

        // Plan info
        items.push(this.createPlanInfoItem(plan, progress));
        items.push(this.createWorktreeItem(worktreeInfo));
        items.push(this.createCurrentStepItem(plan, progress));
        items.push(this.createDevFilesHeader(this.planRoot));
        items.push(this.createStepsHeader());

        return items;
    }

    // ─── Plan Info ───────────────────────────────────────────────────────

    private createPlanInfoItem(plan: Plan, progress: Progress | undefined): DevTreeItem {
        const branch = progress?.branch ?? 'unknown';
        const label = `📋 Plan: ${plan.name} (${branch})`;

        return new DevTreeItem('planInfo', label, vscode.TreeItemCollapsibleState.None, {
            tooltip: `Plan: ${plan.name}\nBranch: ${branch}\nSteps: ${plan.steps.length}`,
            command: {
                command: 'vscode.open',
                title: 'Open Plan',
                arguments: [vscode.Uri.file(plan.filePath)],
            },
        });
    }

    // ─── Worktree ────────────────────────────────────────────────────────

    private createWorktreeItem(worktreeInfo: WorktreeInfo | undefined): DevTreeItem {
        if (!worktreeInfo) {
            return new DevTreeItem('worktree', '📍 Worktree: not found', vscode.TreeItemCollapsibleState.None, {
                tooltip: 'No dev worktree detected',
            });
        }

        const statusText = worktreeInfo.exists ? `✅ ${worktreeInfo.path}` : '❌ not created';
        const label = `📍 Worktree: ${worktreeInfo.exists ? 'active' : 'none'}`;
        const desc = worktreeInfo.exists ? path.basename(worktreeInfo.path) : '';

        return new DevTreeItem('worktree', label, vscode.TreeItemCollapsibleState.None, {
            description: desc,
            tooltip: `Worktree: ${statusText}\nBranch: ${worktreeInfo.branch}`,
        });
    }

    // ─── Current Step ────────────────────────────────────────────────────

    private createCurrentStepItem(plan: Plan, progress: Progress | undefined): DevTreeItem {
        const currentStep = this.findCurrentStep(plan, progress);

        if (!currentStep) {
            return new DevTreeItem('currentStep', '📌 Current: —', vscode.TreeItemCollapsibleState.None, {
                tooltip: 'No step currently in progress',
            });
        }

        const statusIcon = this.getStatusIcon(currentStep.status);
        const iterText = currentStep.iteration > 0 ? ` — iter ${currentStep.iteration}/5` : '';
        const label = `📌 Current: Step ${currentStep.index + 1}: ${currentStep.title}`;
        const desc = `${statusIcon} ${this.getStatusLabel(currentStep.status)}${iterText}`;

        return new DevTreeItem('currentStep', label, vscode.TreeItemCollapsibleState.None, {
            description: desc,
            tooltip: `Step ${currentStep.index + 1}: ${currentStep.title}\nStatus: ${this.getStatusLabel(currentStep.status)}\nIteration: ${currentStep.iteration}/5\nCommit: ${currentStep.lastCommit || '-'}`,
            command: {
                command: 'vscode.open',
                title: 'Open Plan',
                arguments: [vscode.Uri.file(plan.filePath)],
            },
        });
    }

    // ─── Dev Files ───────────────────────────────────────────────────────

    private createDevFilesHeader(planRoot: string): DevTreeItem {
        return new DevTreeItem('devFilesHeader', '📂 Dev Files', vscode.TreeItemCollapsibleState.Expanded, {
            tooltip: 'Development workflow files',
        });
    }

    private getDevFileChildren(): DevTreeItem[] {
        if (!this.planRoot) {
            return [];
        }

        const items: DevTreeItem[] = [];
        const planRoot = this.planRoot;

        // DEV_NOTES.md
        const devNotesPath = path.join(planRoot, 'DEV_NOTES.md');
        const devNotes = fs.existsSync(devNotesPath) ? parseDevNotes(devNotesPath) : undefined;
        const devNotesDesc = devNotes
            ? `${devNotes.filesChanged.length} files, ${devNotes.decisions.length} decisions`
            : 'not created';
        items.push(this.createFileItem(
            '📝 DEV_NOTES.md',
            devNotesDesc,
            devNotesPath,
            devNotes ? `Step: ${devNotes.stepTitle}\nFiles: ${devNotes.filesChanged.length}\nDecisions: ${devNotes.decisions.length}` : 'DEV_NOTES.md has not been created yet'
        ));

        // DECISIONS.md
        const decisionsPath = path.join(planRoot, 'DECISIONS.md');
        const decisions = fs.existsSync(decisionsPath) ? parseDecisions(decisionsPath) : [];
        const decisionsDesc = decisions.length > 0 ? `${decisions.length} decisions` : 'empty';
        items.push(this.createFileItem(
            '📋 DECISIONS.md',
            decisionsDesc,
            decisionsPath,
            `Decision count: ${decisions.length}`
        ));

        // REVIEW_FEEDBACK.md
        const feedbackPath = path.join(planRoot, 'REVIEW_FEEDBACK.md');
        const feedback = fs.existsSync(feedbackPath) ? parseReviewFeedback(feedbackPath) : undefined;
        const feedbackDesc = feedback
            ? feedback.status === 'CHANGES_REQUIRED'
                ? `❌ ${feedback.changesRequired.length} issues`
                : '✅ approved'
            : 'not created';
        items.push(this.createFileItem(
            '🔍 REVIEW_FEEDBACK.md',
            feedbackDesc,
            feedbackPath,
            feedback
                ? `Step: ${feedback.stepTitle}\nStatus: ${feedback.status}\nIssues: ${feedback.changesRequired.length}\nIteration: ${feedback.iteration}/5`
                : 'REVIEW_FEEDBACK.md has not been created yet'
        ));

        return items;
    }

    private createFileItem(label: string, description: string, filePath: string, tooltip: string): DevTreeItem {
        const exists = fs.existsSync(filePath);
        return new DevTreeItem('devFile', label, vscode.TreeItemCollapsibleState.None, {
            description,
            tooltip,
            command: exists
                ? {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [vscode.Uri.file(filePath)],
                }
                : undefined,
        });
    }

    // ─── Steps ───────────────────────────────────────────────────────────

    private createStepsHeader(): DevTreeItem {
        return new DevTreeItem('stepsHeader', '📂 All Steps', vscode.TreeItemCollapsibleState.Expanded, {
            tooltip: 'All plan steps',
        });
    }

    private getStepChildren(): DevTreeItem[] {
        if (!this.workspaceRoot || !this.planRoot) {
            return [];
        }

        const planFilePath = path.join(this.planRoot, 'PLAN.md');
        const progress = parseProgress(path.join(this.planRoot, 'PROGRESS.md'));
        const plan = parsePlan(planFilePath, progress);

        const items: DevTreeItem[] = [];

        for (const step of plan.steps) {
            const icon = this.getStatusIcon(step.status);
            const label = `${icon} Step ${step.index + 1}: ${step.title}`;
            const desc = step.lastCommit || '';

            items.push(new DevTreeItem('step', label, vscode.TreeItemCollapsibleState.None, {
                description: desc,
                tooltip: `Step ${step.index + 1}: ${step.title}\nStatus: ${this.getStatusLabel(step.status)}\nIteration: ${step.iteration}/5\nCommit: ${step.lastCommit || '-'}`,
                command: {
                    command: 'vscode.open',
                    title: 'Open Plan',
                    arguments: [vscode.Uri.file(plan.filePath)],
                },
            }));
        }

        return items;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private createNoPlanItem(message: string): DevTreeItem {
        return new DevTreeItem('noPlan', message, vscode.TreeItemCollapsibleState.None, {
            iconPath: new vscode.ThemeIcon('info'),
        });
    }

    private findCurrentStep(plan: Plan, progress: Progress | undefined): Plan['steps'][0] | undefined {
        // Prefer the in-progress step from progress
        if (progress) {
            for (const step of plan.steps) {
                if (step.status === StepStatus.InProgress) {
                    return step;
                }
            }
        }
        // Fall back to first pending step
        for (const step of plan.steps) {
            if (step.status === StepStatus.Pending) {
                return step;
            }
        }
        return undefined;
    }

    private getStatusIcon(status: StepStatus): string {
        switch (status) {
            case StepStatus.Complete: return '✅';
            case StepStatus.InProgress: return '🔄';
            case StepStatus.Pending: return '⏳';
            default: return '⏳';
        }
    }

    private getStatusLabel(status: StepStatus): string {
        switch (status) {
            case StepStatus.Complete: return 'Complete';
            case StepStatus.InProgress: return 'In Progress';
            case StepStatus.Pending: return 'Pending';
            default: return 'Unknown';
        }
    }
}
