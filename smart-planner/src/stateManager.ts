import * as fs from 'fs';
import * as path from 'path';
import type { PlannerState, PlannerPhase } from './types';

/** Filename for the persisted planner state. */
const STATE_FILENAME = '.planner-state.json';

/**
 * Get the absolute path to the state file for a given project root.
 */
function stateFilePath(projectRoot: string): string {
    return path.join(projectRoot, STATE_FILENAME);
}

/**
 * Load the planner state from `.planner-state.json` in the project root.
 *
 * Returns `undefined` if the state file doesn't exist or is invalid JSON.
 *
 * @param projectRoot - Absolute path to the project root directory.
 * @returns The parsed PlannerState, or undefined if not found/corrupted.
 */
export function loadState(projectRoot: string): PlannerState | undefined {
    const filePath = stateFilePath(projectRoot);

    if (!fs.existsSync(filePath)) {
        return undefined;
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);

        // Basic shape validation — ensure required fields exist
        if (typeof parsed.projectRoot !== 'string' ||
            typeof parsed.phase !== 'string' ||
            typeof parsed.intent !== 'string' ||
            typeof parsed.isGreenfield !== 'boolean' ||
            !Array.isArray(parsed.interviewQA) ||
            typeof parsed.interviewRound !== 'number' ||
            typeof parsed.lastActivity !== 'string') {
            return undefined;
        }

        return parsed as PlannerState;
    } catch {
        // Corrupted or invalid JSON — treat as no state
        return undefined;
    }
}

/**
 * Save the planner state to `.planner-state.json` in the project root.
 *
 * Creates the file if it doesn't exist. Overwrites if it does.
 *
 * @param state - The PlannerState to persist.
 */
export function saveState(state: PlannerState): void {
    const filePath = stateFilePath(state.projectRoot);

    // Ensure project root directory exists
    if (!fs.existsSync(state.projectRoot)) {
        fs.mkdirSync(state.projectRoot, { recursive: true });
    }

    const content = JSON.stringify(state, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Clear the planner state by deleting `.planner-state.json`.
 *
 * No-op if the file doesn't exist.
 *
 * @param projectRoot - Absolute path to the project root directory.
 */
export function clearState(projectRoot: string): void {
    const filePath = stateFilePath(projectRoot);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

/**
 * Create an initial PlannerState for a new planning session.
 *
 * @param projectRoot - Absolute path to the project root directory.
 * @param intent - What the user wants to build.
 * @param isGreenfield - Whether this is a new project (true) or enhancing existing (false).
 * @returns A new PlannerState in the `idle` phase.
 */
export function createInitialState(
    projectRoot: string,
    intent: string,
    isGreenfield: boolean
): PlannerState {
    return {
        projectRoot,
        phase: 'idle' as PlannerPhase,
        intent,
        isGreenfield,
        interviewQA: [],
        interviewRound: 0,
        lastActivity: new Date().toISOString(),
    };
}

/**
 * Update the phase of an existing state and return a new state object.
 *
 * Also updates `lastActivity` to the current timestamp.
 *
 * @param state - Current planner state.
 * @param phase - New phase to set.
 * @returns A new PlannerState with the updated phase.
 */
export function updatePhase(state: PlannerState, phase: PlannerPhase): PlannerState {
    return {
        ...state,
        phase,
        lastActivity: new Date().toISOString(),
    };
}

/**
 * Add an interview Q&A pair to the state.
 *
 * Increments the round counter if this is a new round.
 *
 * @param state - Current planner state.
 * @param question - The question asked.
 * @param answer - The user's answer.
 * @param round - The round number for this question.
 * @returns A new PlannerState with the Q&A added.
 */
export function addInterviewQA(
    state: PlannerState,
    question: string,
    answer: string,
    round: number
): PlannerState {
    return {
        ...state,
        interviewQA: [
            ...state.interviewQA,
            { question, answer, round },
        ],
        interviewRound: Math.max(state.interviewRound, round),
        lastActivity: new Date().toISOString(),
    };
}

/**
 * Update the draft plan content in the state.
 *
 * @param state - Current planner state.
 * @param draftPlan - The generated plan content.
 * @returns A new PlannerState with the draft plan set.
 */
export function setDraftPlan(state: PlannerState, draftPlan: string): PlannerState {
    return {
        ...state,
        draftPlan,
        lastActivity: new Date().toISOString(),
    };
}

/**
 * Update the codebase summary in the state.
 *
 * @param state - Current planner state.
 * @param codebaseSummary - The codebase exploration results.
 * @returns A new PlannerState with the codebase summary set.
 */
export function setCodebaseSummary(
    state: PlannerState,
    codebaseSummary: import('./types').CodebaseSummary
): PlannerState {
    return {
        ...state,
        codebaseSummary,
        lastActivity: new Date().toISOString(),
    };
}
