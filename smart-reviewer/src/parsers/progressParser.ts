import * as fs from 'fs';
import { Progress, ProgressStepEntry, ProgressLastAction, StepStatus } from '../types';

/**
 * Parse a PROGRESS.md file into a structured Progress object.
 *
 * Expected format:
 * ```
 * # Progress — plan-name
 *
 * **Plan**: plan-name
 * **Branch**: branch-name
 * **Created**: YYYY-MM-DD
 *
 * | Step | Status | Iteration | Last Commit |
 * |------|--------|-----------|-------------|
 * | Step 1: Title | ✅ Complete | 2/5 | abc1234 |
 *
 * ## Last Action
 * - **Agent**: dev-agent
 * - **Action**: description
 * - **Timestamp**: YYYY-MM-DD HH:MM
 * ```
 *
 * @param filePath - Absolute path to PROGRESS.md
 * @returns Parsed Progress, or undefined if file doesn't exist or can't be parsed
 */
export function parseProgress(filePath: string): Progress | undefined {
    if (!fs.existsSync(filePath)) {
        return undefined;
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return parseProgressContent(content);
    } catch {
        return undefined;
    }
}

/**
 * Parse PROGRESS.md content string.
 */
function parseProgressContent(content: string): Progress | undefined {
    const lines = content.split('\n');

    // Parse metadata
    const planName = extractMetadata(lines, 'Plan');
    const branch = extractMetadata(lines, 'Branch');
    const created = extractMetadata(lines, 'Created');

    if (!planName) {
        return undefined;
    }

    // Parse step table
    const steps = parseStepTable(lines);

    // Parse last action
    const lastAction = parseLastAction(lines);

    return {
        planName,
        branch: branch ?? '',
        created: created ?? '',
        steps,
        lastAction: lastAction ?? { agent: '', action: '', timestamp: '' },
    };
}

/**
 * Extract a `**Key**: Value` metadata line.
 */
function extractMetadata(lines: string[], key: string): string | undefined {
    const pattern = new RegExp(`^\\*\\*${key}\\*\\*:\\s*(.+)$`);
    for (const line of lines) {
        const match = line.match(pattern);
        if (match) {
            return match[1].trim();
        }
    }
    return undefined;
}

/**
 * Parse the markdown table into ProgressStepEntry[].
 */
function parseStepTable(lines: string[]): ProgressStepEntry[] {
    const entries: ProgressStepEntry[] = [];

    for (const line of lines) {
        // Match table rows: | Step 1: Title | ✅ Complete | 2/5 | abc1234 |
        const rowMatch = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/);
        if (!rowMatch) {
            continue;
        }

        const label = rowMatch[1].trim();
        const statusStr = rowMatch[2].trim();
        const iterStr = rowMatch[3].trim();
        const commitStr = rowMatch[4].trim();

        // Skip header and separator rows
        if (label === 'Step' || label.startsWith('---') || label.startsWith('|--')) {
            continue;
        }

        entries.push({
            label,
            status: parseStatusEmoji(statusStr),
            iteration: parseIteration(iterStr),
            lastCommit: commitStr === '-' ? '' : commitStr,
        });
    }

    return entries;
}

/**
 * Convert emoji status to StepStatus enum.
 */
function parseStatusEmoji(status: string): StepStatus {
    if (status.includes('✅')) { return StepStatus.Complete; }
    if (status.includes('🔄')) { return StepStatus.InProgress; }
    return StepStatus.Pending;
}

/**
 * Parse "2/5" iteration format to the current iteration number.
 */
function parseIteration(iterStr: string): number {
    if (iterStr === '-') { return 0; }
    const match = iterStr.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * Parse the ## Last Action section.
 */
function parseLastAction(lines: string[]): ProgressLastAction | undefined {
    let inLastAction = false;
    let agent = '';
    let action = '';
    let timestamp = '';

    for (const line of lines) {
        if (line.startsWith('## Last Action')) {
            inLastAction = true;
            continue;
        }
        if (inLastAction && line.startsWith('## ')) {
            break; // Next section
        }
        if (!inLastAction) { continue; }

        const agentMatch = line.match(/^-?\s*\*?\*?Agent\*?\*?:\s*(.+)$/);
        if (agentMatch) { agent = agentMatch[1].replace(/\*+/g, '').trim(); }

        const actionMatch = line.match(/^-?\s*\*?\*?Action\*?\*?:\s*(.+)$/);
        if (actionMatch) { action = actionMatch[1].replace(/\*+/g, '').trim(); }

        const tsMatch = line.match(/^-?\s*\*?\*?Timestamp\*?\*?:\s*(.+)$/);
        if (tsMatch) { timestamp = tsMatch[1].replace(/\*+/g, '').trim(); }
    }

    if (!agent && !action) { return undefined; }

    return { agent, action, timestamp };
}
