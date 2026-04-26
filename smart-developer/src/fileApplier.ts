/**
 * File applier for AI dev-agent responses.
 *
 * Parses the AI's XML output into structured DevAction objects and applies
 * file changes to the worktree. Never auto-commits or modifies PROGRESS.md.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { FileChange, DecisionEntry, DevAction } from './types';

// ─── XML Parsing ─────────────────────────────────────────────────────────────

/**
 * Parse the AI's XML response into a structured {@link DevAction}.
 *
 * Extracts content from `<dev-response>` tags, pulling out summary,
 * file changes, dev notes, and decisions.
 *
 * @param aiText - The raw text output from the AI.
 * @returns Parsed {@link DevAction}, or `undefined` if the response is unparseable.
 */
export function parseDevResponse(aiText: string): DevAction | undefined {
    try {
        // Extract content between <dev-response> and </dev-response>
        const responseMatch = aiText.match(/<dev-response>([\s\S]*?)<\/dev-response>/);
        if (!responseMatch) {
            return undefined;
        }

        const body = responseMatch[1];

        // Extract summary
        const summary = extractTagContent(body, 'summary') ?? '';

        // Extract all file changes
        const fileChanges = extractFileChanges(body);

        // Extract dev notes
        const devNotesContent = extractTagContent(body, 'dev-notes') ?? '';

        // Extract all decisions
        const decisions = extractDecisions(body);

        return {
            summary,
            fileChanges,
            devNotesContent,
            decisions,
        };
    } catch {
        return undefined;
    }
}

/**
 * Extract the text content of an XML tag.
 *
 * @param xml - The XML string to search.
 * @param tagName - The tag name (e.g., "summary").
 * @returns The inner text content, or `undefined` if the tag is not found.
 */
function extractTagContent(xml: string, tagName: string): string | undefined {
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'm');
    const match = xml.match(regex);
    return match ? match[1].trim() : undefined;
}

/**
 * Extract all `<file-change>` elements from the XML body.
 */
function extractFileChanges(xml: string): FileChange[] {
    const changes: FileChange[] = [];
    const regex = /<file-change\s+path="([^"]+)"\s+action="([^"]+)">([\s\S]*?)<\/file-change>/g;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(xml)) !== null) {
        changes.push({
            filePath: match[1].trim(),
            action: match[2].trim() as 'create' | 'edit',
            content: match[3].trim(),
        });
    }

    return changes;
}

/**
 * Extract all `<decision>` elements from the XML body.
 *
 * Handles attributes in any order (context before rationale or vice versa).
 */
function extractDecisions(xml: string): DecisionEntry[] {
    const decisions: DecisionEntry[] = [];
    const regex = /<decision\s+([^>]*)>([\s\S]*?)<\/decision>/g;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(xml)) !== null) {
        const attrs = match[1];
        const contextMatch = attrs.match(/context="([^"]*)"/);
        const rationaleMatch = attrs.match(/rationale="([^"]*)"/);

        decisions.push({
            decision: match[2].trim(),
            context: contextMatch?.[1]?.trim() ?? '',
            rationale: rationaleMatch?.[1]?.trim() ?? '',
        });
    }

    return decisions;
}

// ─── File Application ────────────────────────────────────────────────────────

/** Result of applying file changes to the worktree. */
export interface ApplyResult {
    /** Number of files successfully applied. */
    applied: number;
    /** List of file paths that were written. */
    paths: string[];
}

/**
 * Apply file changes to the worktree.
 *
 * Creates directories as needed and writes each file. Does NOT auto-commit
 * or modify PROGRESS.md.
 *
 * @param worktreeDir - Absolute path to the worktree root directory.
 * @param fileChanges - Array of file changes to apply.
 * @returns Summary of applied changes.
 */
export function applyFileChanges(
    worktreeDir: string,
    fileChanges: FileChange[]
): ApplyResult {
    const paths: string[] = [];
    let applied = 0;

    for (const change of fileChanges) {
        const fullPath = path.join(worktreeDir, change.filePath);

        try {
            // Ensure parent directories exist
            const dir = path.dirname(fullPath);
            fs.mkdirSync(dir, { recursive: true });

            // Write the file
            fs.writeFileSync(fullPath, change.content, 'utf-8');
            paths.push(change.filePath);
            applied++;
        } catch {
            // Skip files that fail to write — the user can review and retry
        }
    }

    return { applied, paths };
}
