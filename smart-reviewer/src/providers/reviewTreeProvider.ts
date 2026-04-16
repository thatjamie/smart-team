import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Plan, Step, StepStatus, Progress, ReviewFeedback } from '../types';
import { parsePlan, findPlanFile } from '../parsers/planParser';
import { parseProgress } from '../parsers/progressParser';
import { parseDevNotes } from '../parsers/devNotesParser';
import { parseReviewFeedback } from '../parsers/reviewFeedbackParser';
import { parseDecisions } from '../parsers/decisionsParser';
import { getProjectRoot, getProjectName, findDevWorktree } from '../git';

// ─── Tree Item Types ─────────────────────────────────────────────────────────

/**
 * Custom tree item for the review context sidebar.
 */
export class ReviewTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: string,
        public readonly filePath?: string,
        public readonly stepIndex?: number
    ) {
        super(label, collapsibleState);
    }
}

// ─── Tree Data Provider ──────────────────────────────────────────────────────

/**
 * Provides the sidebar tree view showing review context:
 * - Plan info (name, branch, worktree)
 * - Current step (status, iteration, last action)
 * - Review files (DEV_NOTES, DECISIONS, REVIEW_FEEDBACK)
 * - All steps with status
 */
export class ReviewTreeProvider implements vscode.TreeDataProvider<ReviewTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ReviewTreeItem | undefined | null>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private planRoot: string | undefined;

    /**
     * Refresh the tree view.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    /**
     * Set the plan root directory (where PLAN.md lives).
     */
    setPlanRoot(planRoot: string | undefined): void {
        this.planRoot = planRoot;
        this.refresh();
    }

    getTreeItem(element: ReviewTreeItem): vscode.TreeItem {
        // Set icons based on item type
        switch (element.itemType) {
            case 'plan':
                element.iconPath = new vscode.ThemeIcon('notebook');
                break;
            case 'worktree':
                element.iconPath = new vscode.ThemeIcon('root-folder');
                break;
            case 'currentStep':
                element.iconPath = new vscode.ThemeIcon('pin');
                break;
            case 'file':
                element.iconPath = new vscode.ThemeIcon('file-text');
                element.command = {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [vscode.Uri.file(element.filePath || '')],
                };
                break;
            case 'step-complete':
                element.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
                break;
            case 'step-inprogress':
                element.iconPath = new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.blue'));
                break;
            case 'step-pending':
                element.iconPath = new vscode.ThemeIcon('circle-outline');
                break;
            case 'step-issues':
                element.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
                break;
            case 'section':
                element.iconPath = new vscode.ThemeIcon('folder');
                break;
        }

        // Make steps clickable to open PLAN.md
        if (element.stepIndex !== undefined && element.filePath) {
            element.command = {
                command: 'vscode.open',
                title: 'Open Plan',
                arguments: [vscode.Uri.file(element.filePath)],
            };
            element.tooltip = 'Click to open PLAN.md';
        }

        return element;
    }

    getChildren(element?: ReviewTreeItem): ReviewTreeItem[] {
        if (!this.planRoot) {
            return [new ReviewTreeItem(
                'No plan found. Open a workspace with PLAN.md',
                vscode.TreeItemCollapsibleState.None,
                'section'
            )];
        }

        if (!element) {
            return this.getRootItems();
        }

        switch (element.itemType) {
            case 'plan':
            case 'worktree':
            case 'currentStep':
                return this.getSectionChildren(element.itemType);
            case 'section':
                if (element.label.includes('Review Files')) {
                    return this.getReviewFileItems();
                }
                if (element.label.includes('All Steps')) {
                    return this.getStepItems();
                }
                return [];
            default:
                return [];
        }
    }

    // ─── Root Items ─────────────────────────────────────────────────────────

    private getRootItems(): ReviewTreeItem[] {
        const items: ReviewTreeItem[] = [];

        // Load data
        const planFilePath = findPlanFile(this.planRoot!);
        if (!planFilePath) {
            return [new ReviewTreeItem(
                'No PLAN.md found in workspace',
                vscode.TreeItemCollapsibleState.None,
                'section'
            )];
        }

        const progress = parseProgress(path.join(this.planRoot!, 'PROGRESS.md'));
        const plan = parsePlan(planFilePath, buildProgressOverrides(progress));

        // 1. Plan info
        const planItem = new ReviewTreeItem(
            '\uD83D\uDCCB Plan: ' + plan.name + ' (' + (progress?.branch || 'unknown') + ')',
            vscode.TreeItemCollapsibleState.Collapsed,
            'plan'
        );
        planItem.description = progress?.branch || '';
        items.push(planItem);

        // 2. Worktree info
        const projectRoot = getProjectRoot(this.planRoot!);
        if (projectRoot) {
            const worktree = findDevWorktree(projectRoot);
            const worktreeLabel = worktree.exists
                ? '\uD83D\uDCCD Worktree: ' + path.basename(worktree.path)
                : '\uD83D\uDCCD No dev worktree found';
            const worktreeItem = new ReviewTreeItem(
                worktreeLabel,
                vscode.TreeItemCollapsibleState.Collapsed,
                'worktree'
            );
            worktreeItem.description = worktree.exists ? worktree.branch : 'not found';
            items.push(worktreeItem);
        }

        // 3. Current step
        const currentStep = findCurrentStep(plan.steps);
        if (currentStep) {
            const statusLabel = statusToLabel(currentStep.status);
            const iterLabel = currentStep.iteration > 0 ? ' \u2014 iter ' + currentStep.iteration + '/5' : '';
            const currentLabel = '\uD83D\uDCCC Current: ' + currentStep.title + ' (' + statusLabel + iterLabel + ')';
            const currentItem = new ReviewTreeItem(
                currentLabel,
                vscode.TreeItemCollapsibleState.Collapsed,
                'currentStep',
                planFilePath,
                currentStep.index
            );
            items.push(currentItem);
        }

        // 4. Review Files section
        const filesItem = new ReviewTreeItem(
            '\uD83D\uDCC2 Review Files',
            vscode.TreeItemCollapsibleState.Collapsed,
            'section'
        );
        items.push(filesItem);

        // 5. All Steps section
        const stepsItem = new ReviewTreeItem(
            '\uD83D\uDCCD All Steps (' + plan.steps.length + ')',
            vscode.TreeItemCollapsibleState.Collapsed,
            'section'
        );
        items.push(stepsItem);

        return items;
    }

    // ─── Section Children ──────────────────────────────────────────────────

    private getSectionChildren(parentType: string): ReviewTreeItem[] {
        const progress = parseProgress(path.join(this.planRoot!, 'PROGRESS.md'));

        if (parentType === 'plan') {
            const items: ReviewTreeItem[] = [];
            if (progress) {
                items.push(new ReviewTreeItem(
                    'Branch: ' + progress.branch,
                    vscode.TreeItemCollapsibleState.None,
                    'section'
                ));
                items.push(new ReviewTreeItem(
                    'Created: ' + progress.created,
                    vscode.TreeItemCollapsibleState.None,
                    'section'
                ));
            }
            return items;
        }

        if (parentType === 'worktree') {
            const items: ReviewTreeItem[] = [];
            const projectRoot = getProjectRoot(this.planRoot!);
            if (projectRoot) {
                const worktree = findDevWorktree(projectRoot);
                if (worktree.exists) {
                    items.push(new ReviewTreeItem(
                        'Path: ' + worktree.path,
                        vscode.TreeItemCollapsibleState.None,
                        'section'
                    ));
                    items.push(new ReviewTreeItem(
                        'Branch: ' + worktree.branch,
                        vscode.TreeItemCollapsibleState.None,
                        'section'
                    ));
                }
            }
            return items;
        }

        if (parentType === 'currentStep') {
            const items: ReviewTreeItem[] = [];
            if (progress && progress.lastAction) {
                const actionLabel = progress.lastAction.agent + ' \u2014 "' + progress.lastAction.action + '"';
                items.push(new ReviewTreeItem(
                    'Last: ' + actionLabel,
                    vscode.TreeItemCollapsibleState.None,
                    'section'
                ));
                items.push(new ReviewTreeItem(
                    'Time: ' + progress.lastAction.timestamp,
                    vscode.TreeItemCollapsibleState.None,
                    'section'
                ));
            }
            return items;
        }

        return [];
    }

    // ─── Review File Items ─────────────────────────────────────────────────

    private getReviewFileItems(): ReviewTreeItem[] {
        const items: ReviewTreeItem[] = [];
        const root = this.planRoot!;

        // DEV_NOTES.md
        const devNotesPath = path.join(root, 'DEV_NOTES.md');
        const devNotes = fs.existsSync(devNotesPath) ? parseDevNotes(devNotesPath) : undefined;
        const devNotesLabel = devNotes
            ? '\uD83D\uDCDD DEV_NOTES.md \u2014 ' + devNotes.filesChanged.length + ' files, ' + devNotes.decisions.length + ' decisions'
            : '\uD83D\uDCDD DEV_NOTES.md \u2014 not found';
        const devNotesItem = new ReviewTreeItem(
            devNotesLabel,
            vscode.TreeItemCollapsibleState.None,
            'file',
            fs.existsSync(devNotesPath) ? devNotesPath : undefined
        );
        if (devNotes && devNotes.feedbackDisputed.length > 0) {
            devNotesItem.description = devNotes.feedbackDisputed.length + ' disputes';
        }
        items.push(devNotesItem);

        // DECISIONS.md
        const decisionsPath = path.join(root, 'DECISIONS.md');
        const decisions = fs.existsSync(decisionsPath) ? parseDecisions(decisionsPath) : [];
        const decisionsLabel = '\uD83D\uDCDC DECISIONS.md \u2014 ' + decisions.length + ' decisions';
        items.push(new ReviewTreeItem(
            decisionsLabel,
            vscode.TreeItemCollapsibleState.None,
            'file',
            fs.existsSync(decisionsPath) ? decisionsPath : undefined
        ));

        // REVIEW_FEEDBACK.md
        const feedbackPath = path.join(root, 'REVIEW_FEEDBACK.md');
        const feedback = fs.existsSync(feedbackPath) ? parseReviewFeedback(feedbackPath) : undefined;
        let feedbackLabel = '\uD83D\uDD0D REVIEW_FEEDBACK.md \u2014 not found';
        if (feedback) {
            const statusIcon = feedback.status === 'APPROVED' ? '\u2705' : '\u274C';
            feedbackLabel = '\uD83D\uDD0D REVIEW_FEEDBACK.md \u2014 ' + statusIcon + ' ' + feedback.status + ', ' + feedback.changesRequired.length + ' issues';
        }
        const feedbackItem = new ReviewTreeItem(
            feedbackLabel,
            vscode.TreeItemCollapsibleState.None,
            feedback && feedback.status === 'CHANGES_REQUIRED' ? 'step-issues' : 'file',
            fs.existsSync(feedbackPath) ? feedbackPath : undefined
        );
        items.push(feedbackItem);

        return items;
    }

    // ─── Step Items ────────────────────────────────────────────────────────

    private getStepItems(): ReviewTreeItem[] {
        const items: ReviewTreeItem[] = [];
        const planFilePath = findPlanFile(this.planRoot!);
        const progress = parseProgress(path.join(this.planRoot!, 'PROGRESS.md'));
        const plan = planFilePath ? parsePlan(planFilePath, buildProgressOverrides(progress)) : null;

        if (!plan) {
            return items;
        }

        for (const step of plan.steps) {
            const iconType = stepStatusToItemType(step.status);
            const iterLabel = step.iteration > 0 ? ' (iter ' + step.iteration + '/5)' : '';
            const stepNumber = step.index + 1;
            const label = 'Step ' + stepNumber + ': ' + step.title + iterLabel;

            const item = new ReviewTreeItem(
                label,
                vscode.TreeItemCollapsibleState.None,
                iconType,
                planFilePath,
                step.index
            );
            item.description = step.lastCommit || '';
            items.push(item);
        }

        return items;
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a progress overrides map from parsed Progress.
 */
function buildProgressOverrides(progress: Progress | undefined): Map<number, { status: StepStatus; iteration: number; lastCommit: string }> | undefined {
    if (!progress) {
        return undefined;
    }
    const map = new Map<number, { status: StepStatus; iteration: number; lastCommit: string }>();
    for (const step of progress.steps) {
        map.set(progress.steps.indexOf(step), {
            status: step.status,
            iteration: step.iteration,
            lastCommit: step.lastCommit,
        });
    }
    return map;
}

/**
 * Find the current in-progress step.
 */
function findCurrentStep(steps: Step[]): Step | undefined {
    return steps.find(s => s.status === StepStatus.InProgress);
}

/**
 * Convert StepStatus to a display label.
 */
function statusToLabel(status: StepStatus): string {
    switch (status) {
        case StepStatus.Complete: return '\u2705 Complete';
        case StepStatus.InProgress: return '\uD83D\uDD04 In Progress';
        case StepStatus.Pending: return '\u23F3 Pending';
    }
}

/**
 * Convert StepStatus to tree item type for icon selection.
 */
function stepStatusToItemType(status: StepStatus): string {
    switch (status) {
        case StepStatus.Complete: return 'step-complete';
        case StepStatus.InProgress: return 'step-inprogress';
        case StepStatus.Pending: return 'step-pending';
    }
}
