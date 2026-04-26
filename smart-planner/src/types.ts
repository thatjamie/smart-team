// Re-export all common types for convenience
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

/** Phases of the planning workflow. */
export type PlannerPhase = 'idle' | 'exploring' | 'interviewing' | 'drafting' | 'reviewing' | 'finalized';

/** Persistent interview state saved to .planner-state.json */
export interface PlannerState {
    /** Project root directory */
    projectRoot: string;
    /** Current phase */
    phase: PlannerPhase;
    /** What the user wants to build */
    intent: string;
    /** Whether this is greenfield (new) or brownfield (enhance existing) */
    isGreenfield: boolean;
    /** Codebase exploration results */
    codebaseSummary?: CodebaseSummary;
    /** Questions asked so far (with answers) */
    interviewQA: InterviewQA[];
    /** Number of interview rounds completed */
    interviewRound: number;
    /** AI-generated questions from the last turn, awaiting user answers */
    pendingQuestions: string[];
    /** Draft plan content (if any) */
    draftPlan?: string;
    /** Path to the generated PLAN.md */
    planFilePath?: string;
    /** ISO timestamp of last activity */
    lastActivity: string;
}

/** Codebase exploration results. */
export interface CodebaseSummary {
    /** Detected language(s) */
    languages: string[];
    /** Detected framework(s) */
    frameworks: string[];
    /** Key directories and their purposes */
    directoryStructure: string;
    /** Entry point files */
    entryPoints: string[];
    /** Conventions detected (naming, file org, etc.) */
    conventions: string[];
    /** Testing framework (if detected) */
    testFramework?: string;
    /** Key config files found (package.json, Cargo.toml, etc.) */
    configFiles: string[];
    /** Raw file tree (limited depth) */
    fileTree: string;
}

/** A single interview Q&A pair. */
export interface InterviewQA {
    /** The question asked */
    question: string;
    /** The user's answer */
    answer: string;
    /** Round number (starts at 1) */
    round: number;
}

/** Context for the planner system prompt. */
export interface PlannerContext {
    /** User's stated intent */
    intent: string;
    /** Codebase exploration results (if brownfield) */
    codebaseSummary?: CodebaseSummary;
    /** Interview Q&A so far */
    interviewQA: InterviewQA[];
    /** Current phase */
    phase: PlannerPhase;
    /** Existing PLAN.md content (if updating) */
    existingPlan?: string;
    /** Existing PROGRESS.md content (if updating) */
    existingProgress?: string;
}
