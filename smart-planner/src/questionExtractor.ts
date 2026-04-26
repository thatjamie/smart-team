/**
 * AI-powered question extractor.
 *
 * Uses the AI provider to reliably extract interview questions from
 * AI-generated text. Handles any format the AI produces — numbered,
 * bulleted, bold-topic, Q-format, or mixed.
 *
 * This replaces fragile regex-based extraction that fails when the AI's
 * output format varies.
 */

import type { AiProvider } from './types';

/**
 * System prompt for the extraction AI call.
 * Instructed to return a strict JSON array.
 */
const EXTRACTION_SYSTEM_PROMPT = `You are a precise text extraction tool. Your ONLY job is to extract the top-level interview questions from an AI-generated interview response.

Given the interview text, identify each distinct top-level question the interviewer is asking. Each question may have sub-questions, examples, or context — include ALL of that as part of the single question entry. Do NOT split sub-questions into separate items.

Rules:
1. Return ONLY a JSON array of strings. No other text.
2. Each string is one complete question including its sub-questions and context.
3. Do NOT include summary/acknowledgment paragraphs — only questions that require an answer.
4. Do NOT split a question with sub-bullets into multiple questions.
5. Preserve the original wording as closely as possible.
6. If no questions are found, return an empty array: []

Example input:
"Here is what I know. **Data model**: What fields to store? For example: symbol, strike? Also, how about fees? **CLI design**: How should commands look?"

Example output:
[
  "**Data model**: What fields to store? For example: symbol, strike? Also, how about fees?",
  "**CLI design**: How should commands look?"
]`;

/**
 * Extract top-level interview questions from AI-generated text using AI.
 *
 * @param aiText - The full AI interview response text.
 * @param provider - The AI provider to use for extraction.
 * @returns Array of question strings, or empty array if none found.
 */
export async function extractQuestions(aiText: string, provider: AiProvider): Promise<string[]> {
    try {
        const response = await provider.chat(
            [
                { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
                { role: 'user', content: `Extract the top-level questions from this interview text:\n\n${aiText}` },
            ],
            { maxTokens: 1024 }
        );

        const text = response.text.trim();

        // Strip markdown code fences if present
        const cleaned = text
            .replace(/^```(?:json)?\s*\n?/i, '')
            .replace(/\n?```\s*$/i, '')
            .trim();

        // Parse the JSON array
        const parsed = JSON.parse(cleaned);

        if (!Array.isArray(parsed)) {
            return [];
        }

        // Validate each item is a non-empty string
        return parsed.filter(
            (item: unknown) => typeof item === 'string' && item.trim().length > 0
        ).map((item: string) => item.trim());
    } catch {
        // JSON parse failed or AI call failed — return empty
        return [];
    }
}
