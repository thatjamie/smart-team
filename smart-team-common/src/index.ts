/**
 * Barrel export for smart-team-common.
 *
 * Exports types, AI providers. Will be expanded in later steps to include
 * parsers, writers, git operations, and diff viewer.
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
