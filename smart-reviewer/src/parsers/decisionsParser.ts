import * as fs from 'fs';

/**
 * A single decision entry from DECISIONS.md.
 */
export interface Decision {
    /** Which step the decision belongs to (e.g., "Step 1: Extension Scaffold") */
    step: string;
    /** Short description of the decision */
    decision: string;
    /** Why this decision was needed */
    context: string;
    /** Why this approach was chosen */
    rationale: string;
    /** Date of the decision */
    date: string;
}

/**
 * Parse a DECISIONS.md file into a Decision array.
 *
 * Expected format:
 * ```
 * # Decisions Log — plan-name
 *
 * ## Step N: Step Title
 * - **Decision**: description
 *   - **Context**: why
 *   - **Rationale**: why this approach
 *   - **Date**: YYYY-MM-DD
 * ```
 *
 * @param filePath - Absolute path to DECISIONS.md
 * @returns Array of parsed decisions, or empty array if file doesn't exist
 */
export function parseDecisions(filePath: string): Decision[] {
    if (!fs.existsSync(filePath)) {
        return [];
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return parseDecisionsContent(content);
    } catch {
        return [];
    }
}

/**
 * Parse DECISIONS.md content string.
 */
function parseDecisionsContent(content: string): Decision[] {
    const decisions: Decision[] = [];
    const lines = content.split('\n');

    let currentStep = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match step heading: ## Step N: Title
        const stepMatch = line.match(/^##\s+(Step\s+\d+.*)$/);
        if (stepMatch) {
            currentStep = stepMatch[1].trim();
            continue;
        }

        // Match decision line: - **Decision**: text
        const decisionMatch = line.match(/^-\s+\*\*Decision\*\*:\s*(.+)$/);
        if (decisionMatch) {
            const decision = decisionMatch[1].trim();
            const context = lookAheadMatch(lines, i + 1, 'Context');
            const rationale = lookAheadMatch(lines, i + 1, 'Rationale');
            const date = lookAheadMatch(lines, i + 1, 'Date');

            decisions.push({
                step: currentStep,
                decision,
                context,
                rationale,
                date,
            });
        }
    }

    return decisions;
}

/**
 * Look ahead from a starting line for a **Key**: Value match.
 * Searches up to 10 lines ahead.
 */
function lookAheadMatch(lines: string[], startIdx: number, key: string): string {
    for (let i = startIdx; i < Math.min(startIdx + 10, lines.length); i++) {
        // Stop if we hit another decision or heading
        if (lines[i].match(/^-\s+\*\*Decision\*\*/) || lines[i].match(/^##\s+/)) {
            break;
        }
        const match = lines[i].match(new RegExp(`\\*\\*${key}\\*\\*:\\s*(.+)$`));
        if (match) {
            return match[1].trim();
        }
    }
    return '';
}
