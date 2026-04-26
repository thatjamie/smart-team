import * as fs from 'fs';
import * as path from 'path';
import { parsePlan } from 'smart-team-common';
import { initProgress } from 'smart-team-common';

/**
 * Write PLAN.md to the project root with basic validation.
 *
 * Validates the plan content has expected structure, logs warnings for
 * missing sections, but writes the file regardless (AI may produce slightly
 * different formatting).
 *
 * @param projectRoot - Absolute path to the project root directory.
 * @param planContent - The full PLAN.md markdown content.
 * @returns The absolute path to the written PLAN.md file.
 */
export function writePlan(projectRoot: string, planContent: string): string {
    const filePath = path.join(projectRoot, 'PLAN.md');

    // Validate and log warnings (non-blocking)
    const warnings = validatePlan(planContent);
    for (const warning of warnings) {
        console.warn(`[smart-planner] Plan validation warning: ${warning}`);
    }

    fs.writeFileSync(filePath, planContent, 'utf-8');
    return filePath;
}

/**
 * Seed PROGRESS.md from a written PLAN.md.
 *
 * Parses the plan to extract step titles, then uses common's `initProgress`
 * to create a PROGRESS.md with all steps as ⏳ Pending.
 *
 * @param projectRoot - Absolute path to the project root directory.
 * @param planFilePath - Absolute path to the written PLAN.md.
 * @param planName - Name for the plan (used in PROGRESS.md metadata).
 * @param branch - Git branch name (used in PROGRESS.md metadata).
 */
export function seedProgress(
    projectRoot: string,
    planFilePath: string,
    planName: string,
    branch: string
): void {
    const plan = parsePlan(planFilePath);

    const stepLabels = plan.steps.map(
        (step, index) => `Step ${index + 1}: ${step.title}`
    );

    const progressFilePath = path.join(projectRoot, 'PROGRESS.md');
    initProgress(progressFilePath, planName, branch, stepLabels);
}

/**
 * Extract plan content from AI output text.
 *
 * Looks for plan content in this order:
 * 1. Between `[PLAN_START]` and `[PLAN_END]` markers
 * 2. Starting from a `# Plan:` heading to the end
 * 3. Returns undefined if no plan content is found
 *
 * @param aiText - The raw AI response text.
 * @returns The extracted plan content, or undefined if not found.
 */
export function parsePlanFromAiOutput(aiText: string): string | undefined {
    // Strategy 1: Extract between markers
    const markerStart = aiText.indexOf('[PLAN_START]');
    const markerEnd = aiText.indexOf('[PLAN_END]');

    if (markerStart !== -1 && markerEnd !== -1 && markerEnd > markerStart) {
        // Find the newline after the marker to skip the marker line itself
        const contentStart = aiText.indexOf('\n', markerStart);
        if (contentStart !== -1 && contentStart < markerEnd) {
            return aiText.substring(contentStart + 1, markerEnd).trim();
        }
        // Fallback: content between markers without newline handling
        return aiText.substring(markerStart + '[PLAN_START]'.length, markerEnd).trim();
    }

    // Strategy 2: Find `# Plan:` heading
    const planHeadingRegex = /^#\s+Plan\s*:/m;
    const headingMatch = planHeadingRegex.exec(aiText);

    if (headingMatch) {
        // Extract from the heading to the end
        return aiText.substring(headingMatch.index).trim();
    }

    return undefined;
}

/**
 * Validate plan content for expected structure.
 *
 * Returns an array of warning messages for missing or incorrect sections.
 * These are informational only — the plan is still written even if validation fails.
 *
 * @param content - The PLAN.md markdown content.
 * @returns Array of warning messages (empty if all checks pass).
 */
function validatePlan(content: string): string[] {
    const warnings: string[] = [];

    // Check for plan heading
    if (!/^#\s+Plan\s*:/m.test(content) && !/^#\s+Plan\s+/m.test(content)) {
        warnings.push('Missing "# Plan:" or "# Plan " heading');
    }

    // Check for Overview section
    if (!/^##\s+Overview/m.test(content)) {
        warnings.push('Missing "## Overview" section');
    }

    // Check for Context section
    if (!/^##\s+Context/m.test(content)) {
        warnings.push('Missing "## Context" section');
    }

    // Check for at least one step heading
    const stepHeadings = content.match(/^##\s+Step\s+\d+[:.]/gm);
    if (!stepHeadings || stepHeadings.length === 0) {
        warnings.push('Missing step headings (expected "## Step N: Title")');
    } else {
        // Check each step has Goal and Acceptance Criteria
        const steps = splitByStepHeadings(content);
        for (const step of steps) {
            const titleMatch = step.match(/^##\s+Step\s+(\d+)[:.]\s+(.+)$/m);
            const stepTitle = titleMatch ? `Step ${titleMatch[1]}` : 'Unknown step';

            if (!/\*\*Goal:\*\*/m.test(step) && !/\*\*Goal\*\*:/m.test(step)) {
                warnings.push(`${stepTitle} missing "**Goal:**" line`);
            }

            if (!/^###\s+Acceptance\s+Criteria/m.test(step)) {
                warnings.push(`${stepTitle} missing "### Acceptance Criteria" section`);
            }
        }
    }

    return warnings;
}

/**
 * Split plan content by step headings for per-step validation.
 *
 * @param content - The full plan content.
 * @returns Array of step content strings (including the heading line).
 */
function splitByStepHeadings(content: string): string[] {
    const steps: string[] = [];

    // Remove markdown code blocks to avoid matching headings inside examples
    const stripped = content.replace(/```[\s\S]*?```/g, '');

    const stepRegex = /^##\s+Step\s+\d+[:.]/gm;
    const indices: number[] = [];

    let match: RegExpExecArray | null;
    while ((match = stepRegex.exec(stripped)) !== null) {
        indices.push(match.index);
    }

    for (let i = 0; i < indices.length; i++) {
        const start = indices[i];
        const end = i + 1 < indices.length ? indices[i + 1] : stripped.length;
        steps.push(stripped.substring(start, end));
    }

    return steps;
}
