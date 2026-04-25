import * as fs from 'fs';

/**
 * Write a DEV_NOTES.md file in the exact format that `parseDevNotes` expects.
 *
 * @param filePath - Absolute path to DEV_NOTES.md.
 * @param stepNumber - Step number (e.g., 1, 2, 3).
 * @param stepTitle - Step title (e.g., "Project Scaffold and Types").
 * @param notes - Structured dev notes content.
 * @param notes.whatWasImplemented - Items listed under "What was implemented".
 * @param notes.filesChanged - Items listed under "Files changed".
 * @param notes.decisions - Items listed under "Decisions made".
 * @param notes.questions - Items listed under "Questions for reviewer".
 * @param notes.feedbackAddressed - Items listed under "Review feedback addressed".
 * @param notes.feedbackDisputed - Items listed under "Review feedback respectfully disputed".
 */
export function writeDevNotes(
    filePath: string,
    stepNumber: number,
    stepTitle: string,
    notes: {
        whatWasImplemented: string[];
        filesChanged: string[];
        decisions: string[];
        questions: string[];
        feedbackAddressed?: string[];
        feedbackDisputed?: string[];
    }
): void {
    const lines: string[] = [];

    // Title
    lines.push(`# DEV_NOTES — Step ${stepNumber}: ${stepTitle}`);
    lines.push('');

    // What was implemented
    lines.push('## What was implemented');
    for (const item of notes.whatWasImplemented) {
        lines.push(`- ${item}`);
    }
    lines.push('');

    // Files changed
    lines.push('## Files changed');
    for (const item of notes.filesChanged) {
        lines.push(`- ${item}`);
    }
    lines.push('');

    // Decisions made
    lines.push('## Decisions made');
    for (const item of notes.decisions) {
        lines.push(`- ${item}`);
    }
    lines.push('');

    // Questions for reviewer
    lines.push('## Questions for reviewer');
    for (const item of notes.questions) {
        lines.push(`- ${item}`);
    }
    lines.push('');

    // Review feedback addressed (optional)
    if (notes.feedbackAddressed && notes.feedbackAddressed.length > 0) {
        lines.push('## Review feedback addressed');
        for (const item of notes.feedbackAddressed) {
            lines.push(`- ${item}`);
        }
        lines.push('');
    }

    // Review feedback respectfully disputed (optional)
    if (notes.feedbackDisputed && notes.feedbackDisputed.length > 0) {
        lines.push('## Review feedback respectfully disputed');
        for (const item of notes.feedbackDisputed) {
            lines.push(`- ${item}`);
        }
        lines.push('');
    }

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}
