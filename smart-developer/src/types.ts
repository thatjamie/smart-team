/**
 * Type definitions for Smart Developer.
 *
 * Re-exports all shared types from smart-team-common and defines
 * dev-agent-specific types for AI output parsing and context building.
 */

// ─── Re-exports from smart-team-common ────────────────────────────────────────

export {
    StepStatus,
    type Step,
    type Plan,
    type Progress,
    type ProgressStepEntry,
    type ProgressLastAction,
    type WorktreeInfo,
    type ReviewFeedback,
    type ChangesRequiredItem,
    type Decision,
    type DevNotes,
    type AiMessage,
    type AiResponse,
    type AiChatOptions,
    type AiProvider,
} from 'smart-team-common';

// ─── Dev-Agent-Specific Types ─────────────────────────────────────────────────

/** A single file change produced by the AI. */
export interface FileChange {
    /** Relative path within the worktree */
    filePath: string;
    /** Whether the file is being created or edited */
    action: 'create' | 'edit';
    /** Full file content to write */
    content: string;
}

/** A decision entry to append to DECISIONS.md. */
export interface DecisionEntry {
    /** Short description of the decision */
    decision: string;
    /** Why this decision was needed */
    context: string;
    /** Why this approach was chosen */
    rationale: string;
}

/** The AI's structured response for a step implementation. */
export interface DevAction {
    /** Brief summary of what was implemented */
    summary: string;
    /** File changes to apply to the worktree */
    fileChanges: FileChange[];
    /** Content to write to DEV_NOTES.md */
    devNotesContent: string;
    /** Decisions to append to DECISIONS.md */
    decisions: DecisionEntry[];
}

/** The full context assembled for an AI prompt. */
export interface DevContext {
    /** Raw PLAN.md content */
    planContent: string;
    /** Current PROGRESS.md state as text */
    progressState: string;
    /** Past decisions from DECISIONS.md as text */
    pastDecisions: string;
    /** Review feedback from REVIEW_FEEDBACK.md (if iteration > 1) */
    reviewFeedback?: string;
    /** Project file tree as a string representation */
    projectStructure: string;
    /** Detected language and framework info */
    languageFramework: string;
    /** Map of existing file paths to their content */
    existingFiles: Map<string, string>;
}
