/**
 * prompt-injector.js — Wandlight Continuity
 * Registers the generate_interceptor on globalThis that prepends the
 * continuity memo into the chat array clone before generation.
 * Ephemeral: only modifies the in-flight clone, never persists to messages.
 *
 * Imports: constants.js, state-manager.js, memo-builder.js
 * Imported by: index.js
 */

import { LOG_PREFIX } from './constants.js';
import { getSettings, getState } from './state-manager.js';
import { buildMemo } from './memo-builder.js';

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
 * clone of the chat array. Prepends the continuity memo to the last user
 * message if injection is enabled.
 *
 * This follows the generate_interceptor contract:
 * - Receives a MUTABLE clone of chat array (modifications don't persist)
 * - Must NOT throw (ST wraps in try/catch but we still guard)
 * - Cannot be async per ST's current manifest hook spec
 *
 * @param {Array} chat - Mutable clone of the chat array
 */
function wandlightContinuityInterceptor(chat) {
    try {
        const settings = getSettings();

        if (!settings.enabled) return;
        if (!settings.injectMemo) return;
        if (!chat || chat.length === 0) return;

        // Get the live continuity state
        const state = getState();
        if (!state) return;

        // Build the memo
        const memo = buildMemo(state);
        if (!memo) return;

        // Find the last user message to prepend injection to
        // (same pattern as the Fatbody framework)
        for (let i = chat.length - 1; i >= 0; i--) {
            const msg = chat[i];
            if (msg && msg.is_user) {
                // Prepend memo to the existing message content (ephemeral only)
                const originalContent = msg.content || msg.mes || '';
                if (typeof msg.content === 'string') {
                    msg.content = memo + '\n\n' + originalContent;
                } else if (typeof msg.mes === 'string') {
                    msg.mes = memo + '\n\n' + originalContent;
                }
                if (settings.debugMode) {
                    console.log(`${LOG_PREFIX} Memo injected into last user message (${memo.length} chars)`);
                }
                return; // Only inject into the last user message
            }
        }
    } catch (e) {
        console.error(`${LOG_PREFIX} Interceptor error:`, e);
        // Never throw from an interceptor — ST silently swallows but we guard anyway
    }
}