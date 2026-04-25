import * as fs from 'fs';
import type { Progress, ProgressStepEntry, ProgressLastAction } from '../types';
import { StepStatus } from '../types';

/**
 * Parse a PROGRESS.md file into a structured {@link Progress} object.
 *
 * Expects the exact format:
 * ```markdown
 * # Progress — plan-name
 * **Plan**: plan-name
 * **Branch**: branch-name
 * **Created**: YYYY-MM-DD
 * | Step | Status | Iteration | Last Commit |
 * | Step 1: Title | ✅ Complete | 2/5 | abc1234 |
 * ## Last Action
 * - **Agent**: dev-agent
 * - **Action**: description
 * - **Timestamp**: YYYY-MM-DD HH:MM
 * ```
 *
 * @param filePath - Absolute path to PROGRESS.md.
 * @returns Parsed {@link Progress}, or `undefined` on error or if file is missing.
 */
export function parseProgress(filePath: string): Progress | undefined {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (!content.trim()) {
            return undefined;
        }

        const planName = extractMetadata(content, 'Plan');
        const branch = extractMetadata(content, 'Branch');
        const created = extractMetadata(content, 'Created');

        const steps = parseStepTable(content);
        const lastAction = parseLastAction(content);

        return {
            planName: planName ?? '',
            branch: branch ?? '',
            created: created ?? '',
            steps,
            lastAction,
        };
    } catch {
        return undefined;
    }
}

/** Emoji-to-status mapping */
const STATUS_MAP: Record<string, StepStatus> = {
    '⏳': StepStatus.Pending,
    '🔄': StepStatus.InProgress,
    '✅': StepStatus.Complete,
};

/**
 * Extract a metadata value from `**Key**: value` pattern.
 */
function extractMetadata(content: string, key: string): string | undefined {
    const regex = new RegExp(`\\*\\*${key}\\*\\*:\\s*(.+)`, 'i');
    const match = content.match(regex);
    return match?.[1]?.trim();
}

/**
 * Parse the markdown table into step entries.
 *
 * Table rows look like: `| Step 1: Title | ✅ Complete | 2/5 | abc1234 |`
 */
function parseStepTable(content: string): ProgressStepEntry[] {
    const entries: ProgressStepEntry[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        // Skip table header and separator rows
        if (!trimmed.startsWith('|') || trimmed.includes('Step | Status') || trimmed.match(/^\|[\s-|]+\|$/)) {
            continue;
        }

        const cells = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
        if (cells.length < 4) {
            continue;
        }

        const [label, statusCell, iterationCell, commitCell] = cells;

        // Parse status from emoji
        const statusEmoji = Object.keys(STATUS_MAP).find(emoji => statusCell.includes(emoji));
        const status: StepStatus = statusEmoji ? STATUS_MAP[statusEmoji] : StepStatus.Pending;

        // Parse iteration: "2/5" → 2, "-" → 0
        const iterationMatch = iterationCell.match(/(\d+)\/\d+/);
        const iteration = iterationMatch ? parseInt(iterationMatch[1], 10) : 0;

        // Parse commit hash: "abc1234" or "-"
        const lastCommit = commitCell === '-' ? '' : commitCell.trim();

        entries.push({ label, status, iteration, lastCommit });
    }

    return entries;
}

/**
 * Parse the ## Last Action section.
 */
function parseLastAction(content: string): ProgressLastAction {
    const result: ProgressLastAction = {
        agent: '',
        action: '',
        timestamp: '',
    };

    const lastActionMatch = content.match(/## Last Action\s*\n([\s\S]*?)$/);
    if (!lastActionMatch) {
        return result;
    }

    const section = lastActionMatch[1];

    const agentMatch = section.match(/\*\*Agent\*\*:\s*(.+)/);
    if (agentMatch) {
        result.agent = agentMatch[1].trim();
    }

    const actionMatch = section.match(/\*\*Action\*\*:\s*(.+)/);
    if (actionMatch) {
        result.action = actionMatch[1].trim();
    }

    const timestampMatch = section.match(/\*\*Timestamp\*\*:\s*(.+)/);
    if (timestampMatch) {
        result.timestamp = timestampMatch[1].trim();
    }

    return result;
}
