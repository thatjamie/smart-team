import * as fs from 'fs';
import type { ReviewFeedback, ChangesRequiredItem } from '../types';

/**
 * Parse a REVIEW_FEEDBACK.md file into a structured {@link ReviewFeedback} object.
 *
 * Expects the exact format:
 * ```markdown
 * # Review Feedback — Step N: [Step Title]
 * ## Summary
 * [assessment text]
 * ## ✅ Approved Items
 * - [items] (or "None.")
 * ## ❌ Changes Required
 * - [ ] **Issue**: how to fix (or "None.")
 * ## 💡 Suggestions (Optional)
 * - [suggestions] (or "None.")
 * ## ❓ Questions
 * - [questions] (or "None.")
 * ## Iteration
 * - Iteration: X/5
 * - Status: APPROVED | CHANGES_REQUIRED
 * ```
 *
 * @param filePath - Absolute path to REVIEW_FEEDBACK.md.
 * @returns Parsed {@link ReviewFeedback}, or `undefined` on error or if file is missing.
 */
export function parseReviewFeedback(filePath: string): ReviewFeedback | undefined {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (!content.trim()) {
            return undefined;
        }

        // Extract step info from heading: "# Review Feedback — Step N: Title"
        const titleMatch = content.match(/^#\s+Review Feedback\s*[—–-]\s*(.+)$/m);
        const fullTitle = titleMatch?.[1]?.trim() ?? '';

        // Parse "Step N: Title" from the heading
        const stepParts = fullTitle.match(/^Step\s+(\d+):\s*(.+)$/);
        const stepIndex = stepParts ? parseInt(stepParts[1], 10) - 1 : 0;
        const stepTitle = stepParts ? stepParts[2] : fullTitle;

        // Parse sections
        const summary = extractSectionText(content, 'Summary');
        const approvedItems = extractBulletItems(content, /##\s*✅\s*Approved Items/);
        const changesRequired = parseChangesRequired(content);
        const suggestions = extractBulletItems(content, /##\s*💡\s*Suggestions/);
        const questions = extractBulletItems(content, /##\s*❓\s*Questions/);

        // Parse iteration section
        const iterationSection = extractSectionContent(content, /##\s*Iteration/);
        const iterationMatch = iterationSection?.match(/Iteration:\s*(\d+)\/\d+/);
        const iteration = iterationMatch ? parseInt(iterationMatch[1], 10) : 1;

        const statusMatch = iterationSection?.match(/Status:\s*(APPROVED|CHANGES_REQUIRED)/);
        const status = (statusMatch?.[1] as 'APPROVED' | 'CHANGES_REQUIRED') ?? 'CHANGES_REQUIRED';

        return {
            stepIndex,
            stepTitle,
            summary,
            approvedItems,
            changesRequired,
            suggestions,
            questions,
            iteration,
            status,
        };
    } catch {
        return undefined;
    }
}

/**
 * Extract plain text from a section (paragraph text, not bullets).
 */
function extractSectionText(content: string, heading: string): string {
    const regex = new RegExp(
        `^##\\s+${escapeRegex(heading)}\\s*\\n([\\s\\S]*?)(?=^##\\s|$(?!\\n))`,
        'm'
    );
    const match = content.match(regex);
    if (!match) {
        return '';
    }
    return match[1].trim();
}

/**
 * Extract the raw content of a section matching a heading regex.
 */
function extractSectionContent(content: string, headingRegex: RegExp): string | undefined {
    const regex = new RegExp(
        `${headingRegex.source}\\s*\\n([\\s\\S]*?)(?=^##\\s|$(?!\\n))`,
        'm'
    );
    const match = content.match(regex);
    return match?.[1];
}

/**
 * Extract bullet-point items from a section identified by a heading pattern.
 * Filters out "None." entries.
 */
function extractBulletItems(content: string, headingRegex: RegExp): string[] {
    const sectionContent = extractSectionContent(content, headingRegex);
    if (!sectionContent) {
        return [];
    }

    const items: string[] = [];
    for (const line of sectionContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') && trimmed !== '- None.') {
            items.push(trimmed.substring(2).trim());
        }
    }
    return items;
}

/**
 * Parse the ❌ Changes Required section.
 *
 * Entries may look like:
 * - `- [ ] **Issue description**: how to fix`
 * or just:
 * - `- **Issue description**: how to fix`
 * or:
 * - `- None.`
 */
function parseChangesRequired(content: string): ChangesRequiredItem[] {
    const sectionContent = extractSectionContent(content, /##\s*❌\s*Changes Required/);
    if (!sectionContent || sectionContent.trim() === '- None.') {
        return [];
    }

    const items: ChangesRequiredItem[] = [];
    // Match bullet items, possibly spanning multiple lines until the next bullet or end
    const itemRegex = /^- \[[ x]\]\s+\*\*(.+?)\*\*:\s*([\s\S]*?)(?=^- \[|$(?!\\n))/gm;

    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(sectionContent)) !== null) {
        items.push({
            description: match[1].trim(),
            howToFix: match[2].trim(),
            resolved: match[0].includes('[x]'),
        });
    }

    return items;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
