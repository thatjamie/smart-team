import * as fs from 'fs';
import { ReviewFeedback, ChangesRequiredItem } from '../types';

/**
 * Parse a REVIEW_FEEDBACK.md file into a structured ReviewFeedback object.
 *
 * Expected format:
 * ```
 * # Review Feedback — Step N: Title
 *
 * ## Summary
 * text...
 *
 * ## ✅ Approved Items
 * - item1
 * - item2
 *
 * ## ❌ Changes Required
 * - [ ] **Issue**: description and how to fix
 *
 * ## 💡 Suggestions (Optional)
 * - suggestion
 *
 * ## ❓ Questions
 * - question
 *
 * ## Iteration
 * - Iteration: X/5
 * - Status: APPROVED | CHANGES_REQUIRED
 * ```
 *
 * @param filePath - Absolute path to REVIEW_FEEDBACK.md
 * @returns Parsed ReviewFeedback, or undefined if file doesn't exist
 */
export function parseReviewFeedback(filePath: string): ReviewFeedback | undefined {
    if (!fs.existsSync(filePath)) {
        return undefined;
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return parseReviewFeedbackContent(content);
    } catch {
        return undefined;
    }
}

/**
 * Parse REVIEW_FEEDBACK.md content string.
 */
function parseReviewFeedbackContent(content: string): ReviewFeedback | undefined {
    const lines = content.split('\n');

    // Extract step info from heading: "# Review Feedback — Step N: Title"
    const headingMatch = content.match(/^#\s+Review Feedback\s*—\s*Step\s+(\d+):\s*(.+)$/m);
    if (!headingMatch) {
        return undefined;
    }

    const stepIndex = parseInt(headingMatch[1], 10) - 1; // Convert to zero-based
    const stepTitle = headingMatch[2].trim();

    return {
        stepIndex,
        stepTitle,
        summary: extractTextSection(lines, 'Summary'),
        approvedItems: extractBulletSection(lines, ['✅ Approved Items', 'Approved Items']),
        changesRequired: extractChangesRequired(lines),
        suggestions: extractBulletSection(lines, ['💡 Suggestions', 'Suggestions']),
        questions: extractBulletSection(lines, ['❓ Questions', 'Questions']),
        iteration: extractIteration(content),
        status: extractStatus(content),
    };
}

/**
 * Extract a plain text section (non-bullet paragraphs).
 */
function extractTextSection(lines: string[], sectionTitle: string): string {
    const parts: string[] = [];
    let inSection = false;

    for (const line of lines) {
        const headingMatch = line.match(/^##\s+(.+)$/);
        if (headingMatch) {
            if (headingMatch[1].includes(sectionTitle)) {
                inSection = true;
                continue;
            }
            if (inSection) { break; }
            continue;
        }
        if (!inSection) { continue; }
        if (line.trim()) { parts.push(line.trim()); }
    }

    return parts.join('\n');
}

/**
 * Extract bullet items from a section (matching any of the given title patterns).
 */
function extractBulletSection(lines: string[], sectionTitles: string[]): string[] {
    const items: string[] = [];
    let inSection = false;

    for (const line of lines) {
        const headingMatch = line.match(/^##\s+(.+)$/);
        if (headingMatch) {
            const title = headingMatch[1];
            if (sectionTitles.some(t => title.includes(t))) {
                inSection = true;
                continue;
            }
            if (inSection) { break; }
            continue;
        }
        if (!inSection) { continue; }

        const bulletMatch = line.match(/^\s*-\s+(.+)$/);
        if (bulletMatch) {
            items.push(bulletMatch[1].trim());
        }
    }

    return items;
}

/**
 * Extract Changes Required items with description and howToFix.
 */
function extractChangesRequired(lines: string[]): ChangesRequiredItem[] {
    const items: ChangesRequiredItem[] = [];
    let inSection = false;

    for (const line of lines) {
        const headingMatch = line.match(/^##\s+(.+)$/);
        if (headingMatch) {
            if (headingMatch[1].includes('❌ Changes Required') || headingMatch[1].includes('Changes Required')) {
                inSection = true;
                continue;
            }
            if (inSection) { break; }
            continue;
        }
        if (!inSection) { continue; }

        // Match: "- [ ] **Issue Title**: description and how to fix"
        const itemMatch = line.match(/^\s*-\s*\[?\s*[ x]\]?\s*\*\*(.+?)\*\*:?\s*(.+)$/);
        if (itemMatch) {
            items.push({
                description: itemMatch[1].trim(),
                howToFix: itemMatch[2].trim(),
                resolved: false,
            });
        }

        // Match "None." or empty
        if (line.trim() === 'None.' || line.trim() === 'None') {
            break;
        }
    }

    return items;
}

/**
 * Extract iteration count from "Iteration: X/5".
 */
function extractIteration(content: string): number {
    const match = content.match(/Iteration:\s*(\d+)\/\d+/);
    return match ? parseInt(match[1], 10) : 1;
}

/**
 * Extract status from "Status: APPROVED | CHANGES_REQUIRED".
 */
function extractStatus(content: string): 'APPROVED' | 'CHANGES_REQUIRED' {
    if (content.includes('CHANGES_REQUIRED')) {
        return 'CHANGES_REQUIRED';
    }
    if (content.includes('APPROVED')) {
        return 'APPROVED';
    }
    return 'CHANGES_REQUIRED'; // Default to changes required if unclear
}
