import * as fs from 'fs';
import type { Decision } from '../types';

/**
 * Parse a DECISIONS.md file into an array of {@link Decision} objects.
 *
 * Expects the exact format:
 * ```markdown
 * # Decisions Log — plan-name
 * ## Step N: Step Title
 * - **Decision**: description
 *   - **Context**: why needed
 *   - **Rationale**: why this approach
 *   - **Date**: YYYY-MM-DD
 * ```
 *
 * @param filePath - Absolute path to DECISIONS.md.
 * @returns Array of parsed {@link Decision} objects, or empty array on error.
 */
export function parseDecisions(filePath: string): Decision[] {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (!content.trim()) {
            return [];
        }

        return parseDecisionEntries(content);
    } catch {
        return [];
    }
}

/**
 * Parse decision entries from the file content.
 *
 * Splits the content by `## Step` headings, then extracts each decision
 * block (the `- **Decision**: ...` entry and its sub-items).
 */
function parseDecisionEntries(content: string): Decision[] {
    const decisions: Decision[] = [];

    // Split by step headings: "## Step N: Title"
    const stepRegex = /^##\s+(Step\s+\d+:.+)$/gm;
    const stepMatches: Array<{ index: number; step: string }> = [];

    let match: RegExpExecArray | null;
    while ((match = stepRegex.exec(content)) !== null) {
        stepMatches.push({ index: match.index, step: match[1].trim() });
    }

    // Process each step section
    for (let i = 0; i < stepMatches.length; i++) {
        const start = stepMatches[i].index;
        const end = i + 1 < stepMatches.length ? stepMatches[i + 1].index : content.length;
        const section = content.substring(start, end);

        // Extract the step label (e.g., "Step 1: Project Scaffold and Types")
        const stepLabel = stepMatches[i].step;

        // Find all decision blocks within this step section
        // A decision block starts with: "- **Decision**: ..."
        // followed by indented sub-items
        const decisionBlocks = section.split(/(?=^- \*\*Decision\*\*:)/m);

        for (const block of decisionBlocks) {
            if (!block.trim().startsWith('- **Decision**')) {
                continue;
            }

            const decision = parseDecisionBlock(block, stepLabel);
            if (decision) {
                decisions.push(decision);
            }
        }
    }

    return decisions;
}

/**
 * Parse a single decision block into a {@link Decision} object.
 *
 * A block looks like:
 * ```
 * - **Decision**: description
 *   - **Context**: why needed
 *   - **Rationale**: why this approach
 *   - **Date**: YYYY-MM-DD
 * ```
 */
function parseDecisionBlock(block: string, step: string): Decision | undefined {
    const decisionMatch = block.match(/\*\*Decision\*\*:\s*(.+)/);
    if (!decisionMatch) {
        return undefined;
    }

    const contextMatch = block.match(/\*\*Context\*\*:\s*(.+)/);
    const rationaleMatch = block.match(/\*\*Rationale\*\*:\s*(.+)/);
    const dateMatch = block.match(/\*\*Date\*\*:\s*(.+)/);

    return {
        step,
        decision: decisionMatch[1].trim(),
        context: contextMatch?.[1]?.trim() ?? '',
        rationale: rationaleMatch?.[1]?.trim() ?? '',
        date: dateMatch?.[1]?.trim() ?? '',
    };
}
