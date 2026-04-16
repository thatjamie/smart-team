import * as fs from 'fs';

/**
 * Structured representation of DEV_NOTES.md.
 * Contains everything the reviewer needs to understand what was done.
 */
export interface DevNotes {
    /** Raw content of the file */
    raw: string;
    /** Step title from the heading */
    stepTitle: string;
    /** Items listed under "What was implemented" */
    whatWasImplemented: string[];
    /** Files listed under "Files changed" */
    filesChanged: string[];
    /** Decisions listed under "Decisions made" */
    decisions: string[];
    /** Questions for the reviewer */
    questions: string[];
    /** Review feedback that was addressed (if iteration > 1) */
    feedbackAddressed: string[];
    /** Review feedback respectfully disputed */
    feedbackDisputed: string[];
}

/**
 * Parse a DEV_NOTES.md file into a structured DevNotes object.
 *
 * Expected sections:
 * - What was implemented
 * - Files changed
 * - Decisions made
 * - Questions for reviewer
 * - Review feedback addressed
 * - Review feedback respectfully disputed
 *
 * @param filePath - Absolute path to DEV_NOTES.md
 * @returns Parsed DevNotes, or undefined if file doesn't exist
 */
export function parseDevNotes(filePath: string): DevNotes | undefined {
    if (!fs.existsSync(filePath)) {
        return undefined;
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return parseDevNotesContent(content);
    } catch {
        return undefined;
    }
}

/**
 * Parse DEV_NOTES.md content string.
 */
function parseDevNotesContent(content: string): DevNotes {
    const lines = content.split('\n');

    // Extract step title from first heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const stepTitle = titleMatch ? titleMatch[1].trim() : '';

    return {
        raw: content,
        stepTitle,
        whatWasImplemented: extractListSection(lines, 'What was implemented'),
        filesChanged: extractListSection(lines, 'Files changed'),
        decisions: extractListSection(lines, 'Decisions made'),
        questions: extractListSection(lines, 'Questions for reviewer'),
        feedbackAddressed: extractListSection(lines, 'Review feedback addressed'),
        feedbackDisputed: extractListSection(lines, 'Review feedback respectfully disputed'),
    };
}

/**
 * Extract bullet points from a section identified by its heading.
 * A section extends from its heading until the next heading of the same or higher level.
 */
function extractListSection(lines: string[], sectionTitle: string): string[] {
    const items: string[] = [];
    let inSection = false;

    for (const line of lines) {
        const headingMatch = line.match(/^(#{2,3})\s+(.+)$/);
        if (headingMatch) {
            const title = headingMatch[2].toLowerCase();
            if (title.includes(sectionTitle.toLowerCase())) {
                inSection = true;
                continue;
            }
            // Hit another section heading — stop
            if (inSection) {
                break;
            }
            continue;
        }

        if (!inSection) { continue; }

        // Match bullet list items: "- text" or "1. text"
        const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
        const numberedMatch = line.match(/^\s*\d+\.\s+\*\*(.+?)\*\*:?\s*(.*)$/);
        if (bulletMatch) {
            items.push(bulletMatch[1].trim());
        } else if (numberedMatch) {
            items.push(`${numberedMatch[1]}: ${numberedMatch[2]}`.trim());
        }
    }

    return items;
}
