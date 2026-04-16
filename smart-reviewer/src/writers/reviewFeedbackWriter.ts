import * as fs from 'fs';
import { ReviewFeedback } from '../types';

/**
 * Write REVIEW_FEEDBACK.md with the exact format expected by
 * the dev-agent / Smart Developer workflow.
 *
 * Format:
 * - Summary
 * - Approved Items (with checkmarks)
 * - Changes Required (with checkboxes)
 * - Suggestions (optional)
 * - Questions
 * - Iteration and Status
 *
 * @param filePath - Absolute path to REVIEW_FEEDBACK.md
 * @param feedback - The review feedback to write
 */
export function writeReviewFeedback(filePath: string, feedback: ReviewFeedback): void {
    const lines: string[] = [];

    // Heading
    const stepNumber = feedback.stepIndex + 1;
    lines.push('# Review Feedback \u2014 Step ' + stepNumber + ': ' + feedback.stepTitle);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push(feedback.summary);
    lines.push('');

    // Approved Items
    lines.push('## \u2705 Approved Items');
    if (feedback.approvedItems.length === 0) {
        lines.push('None.');
    } else {
        for (const item of feedback.approvedItems) {
            lines.push('- ' + item);
        }
    }
    lines.push('');

    // Changes Required
    lines.push('## \u274C Changes Required');
    if (feedback.changesRequired.length === 0) {
        lines.push('None.');
    } else {
        for (const item of feedback.changesRequired) {
            lines.push('- [ ] **' + item.description + '**: ' + item.howToFix);
        }
    }
    lines.push('');

    // Suggestions
    lines.push('## \uD83D\uDCA1 Suggestions (Optional)');
    if (feedback.suggestions.length === 0) {
        lines.push('None.');
    } else {
        for (const suggestion of feedback.suggestions) {
            lines.push('- ' + suggestion);
        }
    }
    lines.push('');

    // Questions
    lines.push('## \u2753 Questions');
    if (feedback.questions.length === 0) {
        lines.push('None.');
    } else {
        for (const question of feedback.questions) {
            lines.push('- ' + question);
        }
    }
    lines.push('');

    // Iteration and Status
    lines.push('## Iteration');
    lines.push('- Iteration: ' + feedback.iteration + '/5');
    lines.push('- Status: ' + feedback.status);
    lines.push('');

    const content = lines.join('\n');
    fs.writeFileSync(filePath, content, 'utf-8');
}
