import * as fs from 'fs';
import type { ReviewFeedback } from '../types';

/**
 * Write a REVIEW_FEEDBACK.md file in the exact format that `parseReviewFeedback` expects.
 *
 * @param filePath - Absolute path to REVIEW_FEEDBACK.md.
 * @param feedback - The {@link ReviewFeedback} data to write.
 */
export function writeReviewFeedback(filePath: string, feedback: ReviewFeedback): void {
    const lines: string[] = [];

    // Title
    lines.push(`# Review Feedback — Step ${feedback.stepIndex + 1}: ${feedback.stepTitle}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push(feedback.summary);
    lines.push('');

    // Approved Items
    lines.push('## ✅ Approved Items');
    if (feedback.approvedItems.length === 0) {
        lines.push('- None.');
    } else {
        for (const item of feedback.approvedItems) {
            lines.push(`- ${item}`);
        }
    }
    lines.push('');

    // Changes Required
    lines.push('## ❌ Changes Required');
    if (feedback.changesRequired.length === 0) {
        lines.push('- None.');
    } else {
        for (const item of feedback.changesRequired) {
            const checkbox = item.resolved ? '[x]' : '[ ]';
            lines.push(`- ${checkbox} **${item.description}**: ${item.howToFix}`);
        }
    }
    lines.push('');

    // Suggestions (Optional)
    lines.push('## 💡 Suggestions (Optional)');
    if (feedback.suggestions.length === 0) {
        lines.push('- None.');
    } else {
        for (const item of feedback.suggestions) {
            lines.push(`- ${item}`);
        }
    }
    lines.push('');

    // Questions
    lines.push('## ❓ Questions');
    if (feedback.questions.length === 0) {
        lines.push('- None.');
    } else {
        for (const item of feedback.questions) {
            lines.push(`- ${item}`);
        }
    }
    lines.push('');

    // Iteration
    lines.push('## Iteration');
    lines.push(`- Iteration: ${feedback.iteration}/5`);
    lines.push(`- Status: ${feedback.status}`);
    lines.push('');

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}
