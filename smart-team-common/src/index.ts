/**
 * Barrel export for smart-team-common.
 *
 * Exports types, AI providers, parsers, writers, and git operations.
 * Exports types, AI providers, parsers, writers, git operations, and diff viewer.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export {
    StepStatus,
    type Step,
    type Plan,
    type ProgressStepEntry,
    type ProgressLastAction,
    type Progress,
    type WorktreeInfo,
    type ChangesRequiredItem,
    type ReviewFeedback,
    type Decision,
    type DevNotes,
    type AiMessage,
    type AiResponse,
    type AiChatOptions,
    type AiProvider,
} from './types';

// ─── AI Providers ─────────────────────────────────────────────────────────────

export { CopilotProvider } from './ai/copilotProvider';
export { AnthropicProvider } from './ai/anthropicProvider';
export { OpenAIProvider } from './ai/openaiProvider';
export { ProviderFactory } from './ai/providerFactory';

// ─── Parsers ───────────────────────────────────────────────────────────────────

export { parsePlan, findPlanFile } from './parsers/planParser';
export { parseProgress } from './parsers/progressParser';
export { parseDevNotes } from './parsers/devNotesParser';
export { parseReviewFeedback } from './parsers/reviewFeedbackParser';
export { parseDecisions } from './parsers/decisionsParser';

// ─── Writers ───────────────────────────────────────────────────────────────────

export { writeProgress, updateProgressStep, updateLastAction, initProgress } from './writers/progressWriter';
export { writeDevNotes } from './writers/devNotesWriter';
export { appendDecision } from './writers/decisionsWriter';
export { writeReviewFeedback } from './writers/reviewFeedbackWriter';

// ─── Git Operations ────────────────────────────────────────────────────────────

export { execGit, isDirectory, getProjectRoot, getProjectName, findDevWorktree, getDiff, getLatestDiff, guessBaseBranch, getCurrentBranch, getLatestCommit } from './git/gitRead';
export { createDevWorktree, hasUncommittedChanges, commitChanges, removeWorktree } from './git/gitWrite';

// ─── Diff Viewer ───────────────────────────────────────────────────────────────

export { getDiffForStep, openDiffEditor } from './diffViewer';
