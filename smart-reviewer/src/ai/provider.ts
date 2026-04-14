/**
 * AI Provider interfaces for Smart Reviewer.
 * Shared across all provider implementations (Copilot, Anthropic, OpenAI).
 */

/**
 * A single message in a chat conversation.
 */
export interface AiMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * Response from an AI provider.
 */
export interface AiResponse {
    text: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
}

/**
 * Options for AI chat calls.
 */
export interface AiChatOptions {
    maxTokens?: number;
}

/**
 * Abstract AI provider interface.
 * All providers must implement both synchronous chat and streaming.
 */
export interface AiProvider {
    /**
     * Send messages and get a complete response.
     */
    chat(messages: AiMessage[], options?: AiChatOptions): Promise<AiResponse>;

    /**
     * Send messages and stream the response, calling onChunk for each text fragment.
     * Returns the final assembled response when streaming is complete.
     */
    stream(
        messages: AiMessage[],
        onChunk: (text: string) => void,
        options?: AiChatOptions
    ): Promise<AiResponse>;
}
