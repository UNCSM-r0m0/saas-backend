/**
 * Token Counter Service
 * 
 * Provides unified token counting across all AI providers.
 * Falls back to estimation when provider-native counts aren't available.
 */

import { Injectable } from '@nestjs/common';

/**
 * Message interface for token estimation.
 * Minimal interface to accept any message-like object.
 */
interface MessageLike {
  content: string;
}

@Injectable()
export class TokenCounterService {
  /**
   * Estimates token count for text.
   * 
   * Uses provider-native counts when available, falls back to estimation.
   * Estimation formula: ~4 characters per token (industry standard for English text)
   * For code, use ~3.5 characters per token.
   * 
   * @param text - The text to estimate tokens for
   * @returns Estimated token count
   * 
   * @example
   * ```typescript
   * const tokens = tokenCounter.estimateTokens('Hello world');
   * // Returns: 3 (11 chars / 4 = 2.75, ceil = 3)
   * ```
   */
  estimateTokens(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimates token count for code.
   * Code typically has fewer tokens per character due to whitespace patterns.
   * 
   * @param code - The code text to estimate tokens for
   * @returns Estimated token count
   */
  estimateCodeTokens(code: string): number {
    if (!code || code.length === 0) {
      return 0;
    }
    return Math.ceil(code.length / 3.5);
  }

  /**
   * Calculates total tokens for a conversation (array of messages).
   * 
   * Sums the token estimates for all messages in the conversation.
   * Useful for context window management.
   * 
   * @param messages - Array of messages with content property
   * @returns Total estimated tokens
   * 
   * @example
   * ```typescript
   * const messages = [
   *   { role: 'system', content: 'You are a helpful assistant' },
   *   { role: 'user', content: 'Hello!' },
   *   { role: 'assistant', content: 'Hi there!' }
   * ];
   * const total = tokenCounter.estimateConversationTokens(messages);
   * // Returns: ~10 tokens
   * ```
   */
  estimateConversationTokens(messages: MessageLike[]): number {
    if (!messages || messages.length === 0) {
      return 0;
    }
    return messages.reduce(
      (total, msg) => total + this.estimateTokens(msg.content),
      0,
    );
  }

  /**
   * Limits messages to fit within a token budget.
   * 
   * Keeps the most recent messages that fit within the token limit.
   * Useful for context window management before sending to the API.
   * 
   * @param messages - Array of messages to limit
   * @param maxTokens - Maximum tokens allowed
   * @returns Filtered array that fits within token budget
   * 
   * @example
   * ```typescript
   * const limited = tokenCounter.limitMessagesByTokens(messages, 4000);
   * // Returns messages array that stays within 4000 tokens
   * ```
   */
  limitMessagesByTokens<T extends MessageLike>(
    messages: T[],
    maxTokens: number,
  ): T[] {
    if (!messages || messages.length === 0) {
      return [];
    }

    let totalTokens = 0;
    const limited: T[] = [];

    // Traverse from end (most recent) to start
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgTokens = this.estimateTokens(msg.content);

      if (totalTokens + msgTokens > maxTokens && limited.length > 0) {
        // Would exceed limit and we already have some messages, stop
        break;
      }

      limited.unshift(msg); // Add to beginning to maintain order
      totalTokens += msgTokens;
    }

    return limited;
  }

  /**
   * Gets token statistics for a conversation.
   * 
   * Returns detailed breakdown of token usage across messages.
   * 
   * @param messages - Array of messages to analyze
   * @returns Token statistics
   */
  getConversationTokenStats(messages: MessageLike[]): {
    totalTokens: number;
    messageCount: number;
    averageTokensPerMessage: number;
    largestMessage: { index: number; tokens: number };
  } {
    if (!messages || messages.length === 0) {
      return {
        totalTokens: 0,
        messageCount: 0,
        averageTokensPerMessage: 0,
        largestMessage: { index: -1, tokens: 0 },
      };
    }

    let totalTokens = 0;
    let largestTokens = 0;
    let largestIndex = -1;

    messages.forEach((msg, index) => {
      const tokens = this.estimateTokens(msg.content);
      totalTokens += tokens;

      if (tokens > largestTokens) {
        largestTokens = tokens;
        largestIndex = index;
      }
    });

    return {
      totalTokens,
      messageCount: messages.length,
      averageTokensPerMessage: Math.round(totalTokens / messages.length),
      largestMessage: { index: largestIndex, tokens: largestTokens },
    };
  }
}
