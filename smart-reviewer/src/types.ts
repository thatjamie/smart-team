/**
 * Shared types for the Smart Reviewer extension.
 *
 * These types are used across parsers, writers, the sidebar tree view,
 * the chat handler, and the context builder.
 */

// ─── Step Status ───────────────────────────────────────────────────────────────

/**
 * Status of a plan step.
 * Mirrors the emoji-based status in PROGRESS.md.
 */
export enum StepStatus {
    Pending = 'pending',
    InProgress = 'in-progress',
    Complete = 'complete',
}

// ─── Plan ──────────────────────────────────────────────────────────────────────

/**
 * A single step parsed from PLAN.md.
 * Steps are identified by `##` headings (or `###` for sub-steps).
 */
export interface Step {
    /** Zero-based index of this step in the plan */
    index: number;
    /** Heading text (e.g., "Extension Scaffold") */
    title: string;
    /** Heading level (2 for `##`, 3 for `###`) */
    level: number;
    /** Full markdown content of the step (everything until the next heading) */
    content: string;
    /** Current status, may be overridden by PROGRESS.md */
    status: StepStatus;
    /** Review iteration count (from PROGRESS.md) */
    iteration: number;
    /** Last git commit hash for this step (from PROGRESS.md) */
    lastCommit: string;
}

/**
 * A parsed PLAN.md.
 */
export interface Plan {
    /** Plan name (derived from directory or explicit title) */
    name: string;
    /** Absolute path to PLAN.md */
    filePath: string;
    /** Parsed steps from the plan */
    steps: Step[];
}

// ─── Progress ──────────────────────────────────────────────────────────────────

/**
 * A single step entry in PROGRESS.md.
 */
export interface ProgressStepEntry {
    /** Step label (e.g., "Step 1: Extension Scaffold") */
    label: string;
    /** Current status */
    status: StepStatus;
    /** Review iteration count */
    iteration: number;
    /** Last git commit hash */
    lastCommit: string;
}

/**
 * Last action recorded in PROGRESS.md.
 */
export interface ProgressLastAction {
    /** Which agent performed the action (dev-agent or review-agent) */
    agent: string;
    /** Description of the action */
    action: string;
    /** ISO timestamp */
    timestamp: string;
}

/**
 * Parsed PROGRESS.md.
 */
export interface Progress {
    /** Plan name */
    planName: string;
    /** Git branch name */
    branch: string;
    /** Date the progress was created */
    created: string;
    /** Step entries from the progress table */
    steps: ProgressStepEntry[];
    /** Last action metadata */
    lastAction: ProgressLastAction;
}

// ─── Worktree ──────────────────────────────────────────────────────────────────

/**
 * Information about the dev worktree.
 */
export interface WorktreeInfo {
    /** Absolute path to the worktree directory */
    path: string;
    /** Git branch name checked out in the worktree */
    branch: string;
    /** Whether the worktree directory exists */
    exists: boolean;
}

// ─── Review Feedback ───────────────────────────────────────────────────────────

/**
 * A single blocking issue in a review.
 */
export interface ChangesRequiredItem {
    /** Description of the issue */
    description: string;
    /** Suggested fix */
    howToFix: string;
    /** Whether this issue has been resolved (for tracking across iterations) */
    resolved: boolean;
}

/**
 * Parsed REVIEW_FEEDBACK.md.
 */
export interface ReviewFeedback {
    /** Step index being reviewed */
    stepIndex: number;
    /** Step title */
    stepTitle: string;
    /** Brief overall assessment */
    summary: string;
    /** Items that look good and meet requirements */
    approvedItems: string[];
    /** Blocking issues that must be addressed */
    changesRequired: ChangesRequiredItem[];
    /** Non-blocking improvement suggestions */
    suggestions: string[];
    /** Clarifying questions */
    questions: string[];
    /** Current review iteration */
    iteration: number;
    /** Review status: APPROVED or CHANGES_REQUIRED */
    status: 'APPROVED' | 'CHANGES_REQUIRED';
}
