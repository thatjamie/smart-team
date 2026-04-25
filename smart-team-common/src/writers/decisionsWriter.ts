import * as fs from 'fs';
import type { Decision } from '../types';

/**
 * Append a single decision entry to DECISIONS.md.
 *
 * This function **never overwrites** existing content. If the file exists,
 * it reads the current content and appends the new entry. If the file does
 * not exist, it creates a new file with the proper header.
 *
 * The entry is appended under the appropriate step heading. If a heading
 * for the given step already exists, the decision is added under it.
 * Otherwise, a new step heading is created.
 *
 * @param filePath - Absolute path to DECISIONS.md.
 * @param stepLabel - Step label (e.g., "Step 1: Project Scaffold and Types").
 * @param decision - The decision to append.
 */
export function appendDecision(
    filePath: string,
    stepLabel: string,
    decision: Omit<Decision, 'step'>
): void {
    let existingContent = '';

    // Read existing file if it exists
    try {
        existingContent = fs.readFileSync(filePath, 'utf-8');
    } catch {
        // File doesn't exist — will create new
    }

    const entry = formatDecisionEntry(decision);

    if (!existingContent.trim()) {
        // Create new file with header
        const lines: string[] = [];
        // Extract plan name from the first ## heading or use directory name
        const planNameMatch = existingContent.match(/^#\s+Decisions Log\s*[—–-]\s*(.+)$/m);
        // No header yet — create one
        lines.push(`# Decisions Log — plan`);
        lines.push('');
        lines.push(`## ${stepLabel}`);
        lines.push(entry);
        lines.push('');
        fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
        return;
    }

    // Check if the step heading already exists
    const stepHeadingRegex = new RegExp(
        `^##\\s+${escapeRegex(stepLabel)}\\s*$`,
        'm'
    );
    const stepMatch = existingContent.match(stepHeadingRegex);

    if (stepMatch) {
        // Find the end of this step section (next ## heading or EOF)
        const afterStep = existingContent.substring(stepMatch.index!);
        const nextHeading = afterStep.match(/\n(?=## )/);
        const insertPos = stepMatch.index! + (nextHeading ? nextHeading.index! + 1 : afterStep.length);
        // Insert at the end of the step section, before the next heading
        const updated =
            existingContent.substring(0, insertPos) +
            entry + '\n' +
            existingContent.substring(insertPos);
        fs.writeFileSync(filePath, updated, 'utf-8');
    } else {
        // Append a new step heading + entry at the end
        const separator = existingContent.endsWith('\n') ? '' : '\n';
        const updated =
            existingContent +
            separator +
            `\n## ${stepLabel}\n` +
            entry +
            '\n';
        fs.writeFileSync(filePath, updated, 'utf-8');
    }
}

/**
 * Format a single decision entry as markdown.
 */
function formatDecisionEntry(decision: Omit<Decision, 'step'>): string {
    const lines: string[] = [];
    lines.push(`- **Decision**: ${decision.decision}`);
    lines.push(`  - **Context**: ${decision.context}`);
    lines.push(`  - **Rationale**: ${decision.rationale}`);
    lines.push(`  - **Date**: ${decision.date}`);
    return lines.join('\n');
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
