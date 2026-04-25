import * as fs from 'fs';
import type { DevNotes } from '../types';

/**
 * Parse a DEV_NOTES.md file into a structured {@link DevNotes} object.
 *
 * Expects the exact format:
 * ```markdown
 * # DEV_NOTES — Step N: [Step Title]
 * ## What was implemented
 * - [item]
 * ## Files changed
 * - path/to/file — description
 * ## Decisions made
 * - **Decision name**: rationale
 * ## Questions for reviewer
 * - [question]
 * ## Review feedback addressed
 * - [items fixed]
 * ## Review feedback respectfully disputed
 * - [disputed items with reasoning]
 * ```
 *
 * @param filePath - Absolute path to DEV_NOTES.md.
 * @returns Parsed {@link DevNotes}, or `undefined` on error or if file is missing.
 */
export function parseDevNotes(filePath: string): DevNotes | undefined {
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        if (!raw.trim()) {
            return undefined;
        }

        // Extract step title from heading: "# DEV_NOTES — Step N: Title"
        const titleMatch = raw.match(/^#\s+DEV_NOTES\s*[—–-]\s*(.+)$/m);
        const stepTitle = titleMatch?.[1]?.trim() ?? '';

        return {
            raw,
            stepTitle,
            whatWasImplemented: extractSectionItems(raw, 'What was implemented'),
            filesChanged: extractSectionItems(raw, 'Files changed'),
            decisions: extractSectionItems(raw, 'Decisions made'),
            questions: extractSectionItems(raw, 'Questions for reviewer'),
            feedbackAddressed: extractSectionItems(raw, 'Review feedback addressed'),
            feedbackDisputed: extractSectionItems(raw, 'Review feedback respectfully disputed'),
        };
    } catch {
        return undefined;
    }
}

/**
 * Extract bullet-point items from a named `## Section`.
 *
 * Collects all `- item` lines until the next `##` heading.
 * Returns the items with the leading `- ` stripped.
 */
function extractSectionItems(content: string, sectionTitle: string): string[] {
    const items: string[] = [];

    // Match the section heading and capture everything until the next ## heading
    const sectionRegex = new RegExp(
        `^##\\s+${escapeRegex(sectionTitle)}\\s*\\n([\\s\\S]*?)(?=^##\\s|$(?!\\n))`,
        'm'
    );
    const sectionMatch = content.match(sectionRegex);
    if (!sectionMatch) {
        return items;
    }

    const sectionContent = sectionMatch[1];
    const lines = sectionContent.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ')) {
            items.push(trimmed.substring(2).trim());
        }
    }

    return items;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
