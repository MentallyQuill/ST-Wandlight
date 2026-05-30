/**
 * prompt-injector.js — Wandlight Continuity
 * Registers the generate_interceptor on globalThis that prepends the
 * continuity memo into the chat array clone before generation.
 * Ephemeral: only modifies the in-flight clone, never persists to messages.
 *
 * Imports: constants.js, state-manager.js, memo-builder.js
 * Imported by: index.js
 */

import { LOG_PREFIX, MEMO_MAX_TOKENS } from './constants.js';
import { getSettings, getState } from './state-manager.js';
import { buildMemo } from './memo-builder.js';

/** Marker used to detect if memo was already injected into a message */
const MEMO_MARKER = '[WANDLIGHT CONTINUITY STATE]';

/**
 * Installs the interceptor on globalThis.wandlightContinuityInterceptor.
 * Called once from index.js on jQuery document ready.
 */
export function installInterceptor() {
    globalThis.wandlightContinuityInterceptor = wandlightContinuityInterceptor;
    if (typeof globalThis.wandlightContinuityInterceptor === 'function') {
        console.log(`${LOG_PREFIX} generate_interceptor registered`);
    } else {
        console.error(`${LOG_PREFIX} Failed to register generate_interceptor`);
    }
}

/**
 * ST's generate_interceptor hook function. Called mid-flight with a mutable
 * CLONE of the chat array. The clone is ephemeral — modifications here never
 * write back to stored chat messages.
 *
 * This follows the generate_interceptor contract:
 * - Receives a MUTABLE clone of chat array (modifications don't persist)
 * - Must NOT throw (ST wraps in try/catch but we still guard)
 * - Cannot be async per ST's current manifest hook spec
 *
 * @param {Array} chat - Mutable clone of the chat array (ephemeral)
 */
function wandlightContinuityInterceptor(chat) {
    try {
        const settings = getSettings();

        if (!settings.enabled) return;
        if (!settings.injectMemo) return;
        if (!chat || !Array.isArray(chat) || chat.length === 0) return;

        // Get the live continuity state (reacquired from ST context every time)
        const state = getState();
        if (!state) return;

        // Build the compact memo from current state
        const memo = buildMemo(state);
        if (!memo || typeof memo !== 'string' || memo.trim().length === 0) return;

        // Find the last user message to prepend injection to.
        // Walk backward so we only modify the most recent user turn.
        for (let i = chat.length - 1; i >= 0; i--) {
            const msg = chat[i];
            if (!msg || !msg.is_user) continue;

            // Determine which field holds the message content (ST uses 'mes' primarily)
            const contentField = typeof msg.mes === 'string' ? 'mes'
                : typeof msg.content === 'string' ? 'content'
                : null;
            if (!contentField) continue;

            const originalContent = msg[contentField];

            // DOUBLE-INJECTION GUARD: skip if memo marker already present.
            // This can happen if ST re-processes an already-modified array
            // or if another extension prepends the same memo pattern.
            if (originalContent && originalContent.includes(MEMO_MARKER)) {
                if (settings.debugMode) {
                    console.log(`${LOG_PREFIX} Memo marker already present — skipping injection`);
                }
                return;
            }

            // Prepend the memo before the user's message text.
            // This is ephemeral: the chat array is a clone, so this never
            // persists to the stored chat messages.
            msg[contentField] = memo + '\n\n' + originalContent;

            if (settings.debugMode) {
                console.log(`${LOG_PREFIX} Memo injected into last user message (${memo.length} chars, ~${estimateTokens(memo)} tokens)`);
            }
            return; // Only inject into the last user message
        }

        // If we got here, no valid user message was found — that's fine, skip
        if (settings.debugMode) {
            console.log(`${LOG_PREFIX} No user message found to inject memo into`);
        }
    } catch (e) {
        console.error(`${LOG_PREFIX} Interceptor error:`, e);
        // Never throw from an interceptor — ST silently swallows but we guard anyway
    }
}

/**
 * Rough token estimate from character length.
 * ST uses ~4 chars per token as a rule of thumb.
 * @param {string} text
 * @returns {number} estimated token count
 */
function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
}