import * as vscode from 'vscode';
import { ProviderFactory } from 'smart-team-common';
import { parsePlan, findPlanFile } from 'smart-team-common';
import { parseProgress } from 'smart-team-common';
import type { AiProvider, AiMessage, PlannerState, PlannerContext } from './types';
import { buildInterviewPrompt } from './prompts/interviewPrompt';
import { buildPlanGenerationPrompt } from './prompts/planGenerationPrompt';
import { buildPlanUpdatePrompt } from './prompts/planUpdatePrompt';
import { exploreCodebase } from './codebaseExplorer';
import { loadState, saveState, clearState, createInitialState, updatePhase, addInterviewQA, setDraftPlan, setCodebaseSummary } from './stateManager';
import { writePlan, seedProgress, parsePlanFromAiOutput } from './planWriter';

/** Maximum interview rounds before forcing plan generation. */
const MAX_INTERVIEW_ROUNDS = 8;

/** Keywords that indicate user approval of the plan. */
const APPROVAL_KEYWORDS = ['approve', 'approved', 'looks good', 'lgtm', 'ship it', 'finalize', 'confirmed', 'done', 'yes, write it', 'go ahead', 'write the plan'];

/**
 * Chat handler for the Smart Planner extension.
 *
 * Manages multi-turn conversations for `/plan`, `/update`, and `/status` commands.
 * Lazily creates the AI provider on first use and reuses it for the session.
 */
export class ChatHandler {
    private aiProvider: AiProvider | undefined;

    /**
     * Handle an incoming chat request.
     *
     * Dispatches to the appropriate command handler based on the chat participant command.
     */
    async handleRequest(
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        response: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> {
        const command = request.command;

        try {
            switch (command) {
                case 'plan':
                    await this.handlePlan(request, response, token);
                    break;
                case 'update':
                    await this.handleUpdate(request, response, token);
                    break;
                case 'status':
                    await this.handleStatus(request, response);
                    break;
                default:
                    response.markdown('Unknown command. Use `/plan`, `/update`, or `/status`.');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            response.markdown(`⚠️ **Error**: ${message}`);
        }
    }

    /**
     * Get or lazily create the AI provider.
     */
    private async getAiProvider(): Promise<AiProvider> {
        if (!this.aiProvider) {
            const secrets = await this.getSecretStorage();
            this.aiProvider = await ProviderFactory.create(secrets, 'smart-planner');
        }
        return this.aiProvider;
    }

    /**
     * Get VSCode SecretStorage. Accesses the extension global state.
     */
    private async getSecretStorage(): Promise<vscode.SecretStorage> {
        const ext = vscode.extensions.getExtension('smart-team.smart-planner');
        if (ext?.isActive && ext.exports?.secrets) {
            return ext.exports.secrets as vscode.SecretStorage;
        }
        // Fallback: this should be injected during activation in Step 6
        throw new Error('SecretStorage not available. Extension may not be fully activated.');
    }

    // ────────────────────────────────────────────────────────────────────────────
    // /plan handler
    // ────────────────────────────────────────────────────────────────────────────

    private async handlePlan(
        request: vscode.ChatRequest,
        response: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> {
        // 1. Resolve project root
        const projectRoot = resolveProjectRoot(request.prompt.trim());
        if (!projectRoot) {
            response.markdown('Please specify a project path: `/plan /path/to/project`, or open a workspace.');
            return;
        }
        if (!isDirectory(projectRoot)) {
            response.markdown(`Directory not found: \`${projectRoot}\`. Please provide a valid path.`);
            return;
        }

        // 2. Check for existing state (resume support)
        let state = loadState(projectRoot);

        if (state && request.prompt.trim() === '') {
            // Resuming with no new user input — summarize state
            response.markdown(formatResumeSummary(state));
        }

        const userMessage = request.prompt.trim();

        if (!state) {
            // 3. New planning session — explore codebase
            const isGreenfield = !hasSourceCode(projectRoot);
            state = createInitialState(projectRoot, userMessage || 'New project', isGreenfield);
            state = updatePhase(state, 'exploring');

            if (!isGreenfield) {
                response.markdown('🔍 Exploring your codebase...\n\n');
                const summary = exploreCodebase(projectRoot);
                state = setCodebaseSummary(state, summary);
                response.markdown(formatCodebaseOverview(summary));
            } else {
                response.markdown('🌱 Greenfield project detected. Starting fresh.\n\n');
            }

            state = updatePhase(state, 'interviewing');
            saveState(state);
        }

        // 4. Route by current phase
        state = await this.routeByPhase(state, userMessage, response, token);
        if (state) {
            saveState(state);
        }
    }

    /**
     * Route handling based on the current phase of the planning flow.
     */
    private async routeByPhase(
        state: PlannerState,
        userMessage: string,
        response: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<PlannerState> {
        switch (state.phase) {
            case 'interviewing':
                return await this.phaseInterviewing(state, userMessage, response, token);
            case 'drafting':
                return await this.phaseDrafting(state, response, token);
            case 'reviewing':
                return await this.phaseReviewing(state, userMessage, response, token);
            case 'finalized':
                return this.phaseFinalized(state, response);
            default:
                // idle or exploring — transition to interviewing
                state = updatePhase(state, 'interviewing');
                return await this.phaseInterviewing(state, userMessage, response, token);
        }
    }

    /**
     * Interviewing phase: gather requirements through multi-turn Q&A.
     */
    private async phaseInterviewing(
        state: PlannerState,
        userMessage: string,
        response: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<PlannerState> {
        // If there's a user message, it's an answer to a previous question
        if (userMessage) {
            // Record the answer — the question was asked in the previous turn
            const round = state.interviewRound + 1;
            state = addInterviewQA(state, 'Previous question', userMessage, round);
        }

        // Check if we've exceeded max interview rounds
        if (state.interviewRound >= MAX_INTERVIEW_ROUNDS) {
            response.markdown(`📋 **Maximum interview rounds reached (${MAX_INTERVIEW_ROUNDS}). Moving to plan generation.**\n\n`);
            state = updatePhase(state, 'drafting');
            saveState(state);
            return await this.phaseDrafting(state, response, token);
        }

        // Build interview prompt and call AI
        const plannerContext = stateToContext(state);
        const systemPrompt = buildInterviewPrompt(plannerContext);

        const provider = await this.getAiProvider();
        const aiResponse = await provider.chat(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage || 'Start the interview. Ask your first round of questions.' },
            ],
            { maxTokens: 2048 }
        );

        const aiText = aiResponse.text;

        // Check for requirements clear signal
        if (aiText.includes('[REQUIREMENTS_CLEAR]')) {
            response.markdown('✅ **Requirements gathered! Moving to plan generation...**\n\n');
            state = updatePhase(state, 'drafting');
            saveState(state);
            return await this.phaseDrafting(state, response, token);
        }

        // Show the AI's questions
        response.markdown(aiText);

        // Increment round
        state = { ...state, interviewRound: state.interviewRound + 1, lastActivity: new Date().toISOString() };
        return state;
    }

    /**
     * Drafting phase: generate the full PLAN.md content.
     */
    private async phaseDrafting(
        state: PlannerState,
        response: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<PlannerState> {
        response.markdown('📝 **Generating your plan...**\n\n');

        const plannerContext = stateToContext(state);
        const systemPrompt = buildPlanGenerationPrompt(plannerContext);

        const provider = await this.getAiProvider();
        const aiResponse = await provider.chat(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: 'Generate the complete PLAN.md based on all the requirements gathered above.' },
            ],
            { maxTokens: 8192 }
        );

        const aiText = aiResponse.text;
        const planContent = parsePlanFromAiOutput(aiText);

        if (!planContent) {
            // Could not extract plan — show raw output and ask user
            response.markdown('⚠️ Could not extract a structured plan from the AI response. Here is the raw output:\n\n');
            response.markdown(aiText);
            response.markdown('\n\nPlease review and tell me if this looks correct, or say "retry" to try again.');
            state = updatePhase(state, 'reviewing');
            state = setDraftPlan(state, aiText);
            return state;
        }

        // Save draft and transition to reviewing
        state = setDraftPlan(state, planContent);
        state = updatePhase(state, 'reviewing');

        // Show plan summary
        const stepCount = (planContent.match(/^##\s+Step\s+\d+[:.]/gm) || []).length;
        response.markdown(`📋 **Draft plan generated!** (${stepCount} steps)\n\n`);
        response.markdown('---\n\n');
        response.markdown(planContent);
        response.markdown('\n\n---\n\n');
        response.markdown('**Review the plan above.** You can:\n');
        response.markdown('- Ask for changes: *"Make Step 2 more detailed"*\n');
        response.markdown('- Approve: *"Looks good"* or *"Approve"*\n');

        return state;
    }

    /**
     * Reviewing phase: iterate on the plan based on user feedback.
     */
    private async phaseReviewing(
        state: PlannerState,
        userMessage: string,
        response: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<PlannerState> {
        // Check for approval
        if (isApproval(userMessage)) {
            state = updatePhase(state, 'finalized');
            return this.phaseFinalized(state, response);
        }

        // User wants changes — ask AI to revise
        response.markdown('🔄 **Revising the plan...**\n\n');

        const plannerContext = stateToContext(state);
        const systemPrompt = buildPlanGenerationPrompt(plannerContext);

        const provider = await this.getAiProvider();
        const aiResponse = await provider.chat(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Here is the user's feedback on the draft plan:\n\n${userMessage}\n\nPlease revise the plan based on this feedback and output the complete updated PLAN.md.` },
            ],
            { maxTokens: 8192 }
        );

        const aiText = aiResponse.text;
        const planContent = parsePlanFromAiOutput(aiText);

        if (planContent) {
            state = setDraftPlan(state, planContent);
            const stepCount = (planContent.match(/^##\s+Step\s+\d+[:.]/gm) || []).length;
            response.markdown(`📋 **Revised plan** (${stepCount} steps):\n\n`);
            response.markdown('---\n\n');
            response.markdown(planContent);
            response.markdown('\n\n---\n\n');
            response.markdown('Approve or request more changes.\n');
        } else {
            response.markdown('⚠️ Could not extract revised plan. Raw output:\n\n');
            response.markdown(aiText);
            response.markdown('\n\nPlease review and provide further feedback.\n');
        }

        return state;
    }

    /**
     * Finalized phase: write PLAN.md and PROGRESS.md.
     */
    private phaseFinalized(
        state: PlannerState,
        response: vscode.ChatResponseStream
    ): PlannerState {
        if (!state.draftPlan) {
            response.markdown('⚠️ No draft plan to finalize. Starting over.');
            clearState(state.projectRoot);
            return state;
        }

        try {
            // Write PLAN.md
            const planFilePath = writePlan(state.projectRoot, state.draftPlan);

            // Seed PROGRESS.md
            const planName = extractPlanName(state.draftPlan) || 'unnamed-plan';
            const branch = `feature/plan-${planName}`;
            seedProgress(state.projectRoot, planFilePath, planName, branch);

            // Parse the plan to get step count
            const plan = parsePlan(planFilePath);
            const stepCount = plan.steps.length;

            // Clear state
            clearState(state.projectRoot);

            response.markdown(`✅ **Plan finalized!**\n\n`);
            response.markdown(`- **PLAN.md**: \`${planFilePath}\`\n`);
            response.markdown(`- **PROGRESS.md**: \`${state.projectRoot}/PROGRESS.md\`\n`);
            response.markdown(`- **Steps**: ${stepCount}\n`);
            response.markdown(`- **Branch**: \`${branch}\`\n\n`);
            response.markdown('You can now start implementing with the Smart Developer extension!');

            return updatePhase(state, 'finalized');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            response.markdown(`⚠️ **Error writing plan files**: ${message}`);
            return state;
        }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // /update handler
    // ────────────────────────────────────────────────────────────────────────────

    private async handleUpdate(
        request: vscode.ChatRequest,
        response: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> {
        const projectRoot = resolveProjectRoot('');
        if (!projectRoot) {
            response.markdown('Please open a workspace or specify a project path.');
            return;
        }

        // Find existing PLAN.md
        const planFilePath = findPlanFile(projectRoot);
        if (!planFilePath) {
            response.markdown('⚠️ No existing PLAN.md found. Use `/plan` to create a new plan.');
            return;
        }

        const userMessage = request.prompt.trim();
        if (!userMessage) {
            response.markdown('Please describe what you want to change: `/update Add error handling to all API routes`');
            return;
        }

        response.markdown('🔄 **Updating your plan...**\n\n');

        // Read existing plan and progress
        let existingPlanContent: string | undefined;
        let existingProgressContent: string | undefined;

        try {
            existingPlanContent = require('fs').readFileSync(planFilePath, 'utf-8');
        } catch { /* ignore */ }

        const progressPath = require('path').join(projectRoot, 'PROGRESS.md');
        try {
            existingProgressContent = require('fs').readFileSync(progressPath, 'utf-8');
        } catch { /* ignore */ }

        // Build update context
        const context: PlannerContext = {
            intent: userMessage,
            interviewQA: [],
            phase: 'reviewing',
            existingPlan: existingPlanContent,
            existingProgress: existingProgressContent,
        };

        const systemPrompt = buildPlanUpdatePrompt(context);

        const provider = await this.getAiProvider();
        const aiResponse = await provider.chat(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
            ],
            { maxTokens: 8192 }
        );

        const aiText = aiResponse.text;
        const planContent = parsePlanFromAiOutput(aiText);

        if (!planContent) {
            response.markdown('⚠️ Could not extract updated plan from AI response. Raw output:\n\n');
            response.markdown(aiText);
            return;
        }

        // Write updated plan
        writePlan(projectRoot, planContent);

        const plan = parsePlan(planFilePath);
        const stepCount = plan.steps.length;

        response.markdown(`✅ **Plan updated!** (${stepCount} steps)\n\n`);
        response.markdown(`- **PLAN.md**: \`${planFilePath}\`\n`);
        response.markdown(`- **Steps**: ${stepCount}\n\n`);
        response.markdown('Review the changes above. If PROGRESS.md needs updating, use `/plan` to regenerate.');
    }

    // ────────────────────────────────────────────────────────────────────────────
    // /status handler
    // ────────────────────────────────────────────────────────────────────────────

    private async handleStatus(
        request: vscode.ChatRequest,
        response: vscode.ChatResponseStream
    ): Promise<void> {
        const projectRoot = resolveProjectRoot('');
        if (!projectRoot) {
            response.markdown('Please open a workspace or specify a project path.');
            return;
        }

        const state = loadState(projectRoot);

        if (!state) {
            response.markdown('📋 No active planning session found.\n\nUse `/plan` to start a new planning session.');
            return;
        }

        response.markdown('## 📊 Planning Session Status\n\n');
        response.markdown(`- **Project Root**: \`${state.projectRoot}\`\n`);
        response.markdown(`- **Phase**: ${formatPhase(state.phase)}\n`);
        response.markdown(`- **Intent**: ${state.intent}\n`);
        response.markdown(`- **Greenfield**: ${state.isGreenfield ? 'Yes' : 'No'}\n`);
        response.markdown(`- **Interview Round**: ${state.interviewRound}\n`);
        response.markdown(`- **Questions Asked**: ${state.interviewQA.length}\n`);
        response.markdown(`- **Draft Plan**: ${state.draftPlan ? 'Yes' : 'No'}\n`);
        response.markdown(`- **Last Activity**: ${state.lastActivity}\n`);
    }
}

// ────────────────────────────────────────────────────────────────────────────────
// Helper functions
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Resolve project root from: chat argument → VSCode setting → workspace root.
 */
function resolveProjectRoot(chatArgument: string): string | undefined {
    // 1. Chat argument
    if (chatArgument) {
        return chatArgument;
    }

    // 2. VSCode setting
    const config = vscode.workspace.getConfiguration('smart-planner');
    const settingRoot = config.get<string>('projectRoot', '');
    if (settingRoot) {
        return settingRoot;
    }

    // 3. Workspace root
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        return workspaceFolders[0].uri.fsPath;
    }

    return undefined;
}

/**
 * Check if a path is an existing directory.
 */
function isDirectory(filePath: string): boolean {
    try {
        const fs = require('fs');
        return fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();
    } catch {
        return false;
    }
}

/**
 * Check if a directory has source code (not empty/greenfield).
 */
function hasSourceCode(projectRoot: string): boolean {
    const fs = require('fs');
    const path = require('path');
    const indicators = ['package.json', 'Cargo.toml', 'pyproject.toml', 'go.mod', 'pom.xml', 'Gemfile', 'composer.json', 'src', 'lib', 'app'];
    try {
        const entries = fs.readdirSync(projectRoot);
        return entries.some((e: string) => indicators.includes(e));
    } catch {
        return false;
    }
}

/**
 * Check if user message indicates plan approval.
 */
function isApproval(message: string): boolean {
    const lower = message.toLowerCase().trim();
    return APPROVAL_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Convert PlannerState to PlannerContext for prompt building.
 */
function stateToContext(state: PlannerState): PlannerContext {
    return {
        intent: state.intent,
        codebaseSummary: state.codebaseSummary,
        interviewQA: state.interviewQA,
        phase: state.phase,
        existingPlan: state.draftPlan,
    };
}

/**
 * Extract plan name from the `# Plan: Name` heading.
 */
function extractPlanName(planContent: string): string | undefined {
    const match = planContent.match(/^#\s+Plan\s*[:：]\s*(.+)$/m);
    return match?.[1]?.trim();
}

/**
 * Format phase name for display.
 */
function formatPhase(phase: string): string {
    const labels: Record<string, string> = {
        idle: '⏸️ Idle',
        exploring: '🔍 Exploring',
        interviewing: '💬 Interviewing',
        drafting: '📝 Drafting',
        reviewing: '👁️ Reviewing',
        finalized: '✅ Finalized',
    };
    return labels[phase] ?? phase;
}

/**
 * Format resume summary when loading an interrupted session.
 */
function formatResumeSummary(state: PlannerState): string {
    return `📂 **Resuming planning session**\n\n` +
        `- **Phase**: ${formatPhase(state.phase)}\n` +
        `- **Interview Round**: ${state.interviewRound}\n` +
        `- **Questions Asked**: ${state.interviewQA.length}\n` +
        `- **Last Activity**: ${state.lastActivity}\n\n` +
        `Continue where you left off, or describe what you want to plan.\n`;
}

/**
 * Format codebase overview for display after exploration.
 */
function formatCodebaseOverview(summary: import('./types').CodebaseSummary): string {
    const parts: string[] = ['**Codebase detected:**\n'];

    if (summary.languages.length > 0) {
        parts.push(`- **Languages**: ${summary.languages.join(', ')}`);
    }
    if (summary.frameworks.length > 0) {
        parts.push(`- **Frameworks**: ${summary.frameworks.join(', ')}`);
    }
    if (summary.testFramework) {
        parts.push(`- **Test Framework**: ${summary.testFramework}`);
    }
    if (summary.entryPoints.length > 0) {
        parts.push(`- **Entry Points**: ${summary.entryPoints.join(', ')}`);
    }

    parts.push('\n');
    return parts.join('\n');
}
