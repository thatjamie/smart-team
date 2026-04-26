import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { loadState } from '../stateManager';
import type { PlannerState, PlannerPhase } from '../types';

/**
 * Tree data provider for the Smart Planner sidebar.
 *
 * Shows planning session state organized as:
 * - Session info (project root, phase, interview progress)
 * - Interview history (grouped by round)
 * - Plan outline (after drafting)
 */
export class PlannerTreeProvider implements vscode.TreeDataProvider<PlannerTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<PlannerTreeItem | undefined | null>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
    }

    /**
     * Update the project root and refresh the tree.
     */
    setProjectRoot(root: string): void {
        this.projectRoot = root;
        this.refresh();
    }

    /**
     * Refresh the tree view.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: PlannerTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: PlannerTreeItem): PlannerTreeItem[] {
        const state = loadState(this.projectRoot);

        if (!state) {
            if (!element) {
                return [
                    new PlannerTreeItem(
                        'No active planning session',
                        vscode.TreeItemCollapsibleState.None,
                        'info'
                    ),
                    new PlannerTreeItem(
                        'Use /plan to start planning',
                        vscode.TreeItemCollapsibleState.None,
                        'hint'
                    ),
                ];
            }
            return [];
        }

        // Root level — show main sections
        if (!element) {
            return this.getRootItems(state);
        }

        // Expand children based on context value
        switch (element.contextValue) {
            case 'session':
                return this.getSessionDetails(state);
            case 'interview':
                return this.getInterviewHistory(state);
            case `round-${element.metadata?.round}`:
                return this.getRoundDetails(state, element.metadata?.round as number);
            case 'planOutline':
                return this.getPlanOutline(state);
            default:
                return [];
        }
    }

    /**
     * Root-level items: session info, interview history, plan outline.
     */
    private getRootItems(state: PlannerState): PlannerTreeItem[] {
        const items: PlannerTreeItem[] = [];

        // Session info section
        const phaseLabel = formatPhaseLabel(state.phase);
        const phaseDetail = state.phase === 'interviewing'
            ? `${phaseLabel} (Round ${state.interviewRound})`
            : phaseLabel;

        items.push(new PlannerTreeItem(
            `📋 ${phaseDetail}`,
            vscode.TreeItemCollapsibleState.Expanded,
            'session',
            { state }
        ));

        // Interview history (if any Q&A exists)
        if (state.interviewQA.length > 0) {
            const roundCount = new Set(state.interviewQA.map(qa => qa.round)).size;
            items.push(new PlannerTreeItem(
                `❓ Interview History (${state.interviewQA.length} questions, ${roundCount} rounds)`,
                vscode.TreeItemCollapsibleState.Collapsed,
                'interview'
            ));
        }

        // Plan outline (if draft exists)
        if (state.draftPlan) {
            const stepCount = (state.draftPlan.match(/^##\s+Step\s+\d+[:.]/gm) || []).length;
            items.push(new PlannerTreeItem(
                `📝 Plan Outline (${stepCount} steps)`,
                vscode.TreeItemCollapsibleState.Collapsed,
                'planOutline'
            ));
        }

        return items;
    }

    /**
     * Session detail items: project root, phase, stats.
     */
    private getSessionDetails(state: PlannerState): PlannerTreeItem[] {
        const items: PlannerTreeItem[] = [];

        items.push(new PlannerTreeItem(
            `📂 ${state.projectRoot}`,
            vscode.TreeItemCollapsibleState.None,
            'path'
        ));

        items.push(new PlannerTreeItem(
            `🌱 ${state.isGreenfield ? 'Greenfield' : 'Brownfield'} project`,
            vscode.TreeItemCollapsibleState.None,
            'info'
        ));

        items.push(new PlannerTreeItem(
            `💬 Questions: ${state.interviewQA.length}`,
            vscode.TreeItemCollapsibleState.None,
            'info'
        ));

        if (state.pendingQuestions.length > 0) {
            items.push(new PlannerTreeItem(
                `⏳ Pending: ${state.pendingQuestions.length} question(s) to answer`,
                vscode.TreeItemCollapsibleState.None,
                'pending'
            ));
        }

        items.push(new PlannerTreeItem(
            `🕐 Last activity: ${formatTimestamp(state.lastActivity)}`,
            vscode.TreeItemCollapsibleState.None,
            'info'
        ));

        return items;
    }

    /**
     * Interview history: grouped by round.
     */
    private getInterviewHistory(state: PlannerState): PlannerTreeItem[] {
        const rounds = new Map<number, typeof state.interviewQA>();
        for (const qa of state.interviewQA) {
            if (!rounds.has(qa.round)) {
                rounds.set(qa.round, []);
            }
            rounds.get(qa.round)!.push(qa);
        }

        const items: PlannerTreeItem[] = [];
        for (const [round, qas] of rounds) {
            items.push(new PlannerTreeItem(
                `Round ${round} (${qas.length} questions)`,
                vscode.TreeItemCollapsibleState.Collapsed,
                `round-${round}`,
                { round }
            ));
        }

        return items;
    }

    /**
     * Round details: individual Q&A pairs.
     */
    private getRoundDetails(state: PlannerState, round: number): PlannerTreeItem[] {
        return state.interviewQA
            .filter(qa => qa.round === round)
            .map(qa => new PlannerTreeItem(
                `Q: ${truncate(qa.question, 60)} → ${truncate(qa.answer, 40)}`,
                vscode.TreeItemCollapsibleState.None,
                'qa'
            ));
    }

    /**
     * Plan outline: extracted step titles from draft plan.
     */
    private getPlanOutline(state: PlannerState): PlannerTreeItem[] {
        if (!state.draftPlan) {
            return [];
        }

        const stepRegex = /^##\s+Step\s+(\d+)[:.]\s+(.+)$/gm;
        const items: PlannerTreeItem[] = [];

        let match: RegExpExecArray | null;
        while ((match = stepRegex.exec(state.draftPlan)) !== null) {
            const stepNum = match[1];
            const stepTitle = match[2].trim();

            // Determine icon based on phase
            let icon = '📄';
            if (state.phase === 'finalized') {
                icon = '✅';
            } else if (state.phase === 'reviewing') {
                icon = '👁️';
            }

            items.push(new PlannerTreeItem(
                `${icon} Step ${stepNum}: ${stepTitle}`,
                vscode.TreeItemCollapsibleState.None,
                'step'
            ));
        }

        return items;
    }
}

/**
 * Tree item for the planner sidebar.
 */
export class PlannerTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        contextValue: string,
        public readonly metadata?: Record<string, unknown>
    ) {
        super(label, collapsibleState);
        this.contextValue = contextValue;
    }
}

// ────────────────────────────────────────────────────────────────────────────────
// Helper functions
// ────────────────────────────────────────────────────────────────────────────────

function formatPhaseLabel(phase: PlannerPhase): string {
    const labels: Record<PlannerPhase, string> = {
        idle: '⏸️ Idle',
        exploring: '🔍 Exploring Codebase',
        interviewing: '💬 Interviewing',
        drafting: '📝 Drafting Plan',
        reviewing: '👁️ Reviewing Plan',
        finalized: '✅ Plan Finalized',
    };
    return labels[phase] ?? phase;
}

function formatTimestamp(iso: string): string {
    try {
        const date = new Date(iso);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);

        if (diffMin < 1) { return 'Just now'; }
        if (diffMin < 60) { return `${diffMin}m ago`; }
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) { return `${diffHr}h ago`; }
        return date.toLocaleDateString();
    } catch {
        return iso;
    }
}

function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) { return text; }
    return text.substring(0, maxLength - 3) + '...';
}
