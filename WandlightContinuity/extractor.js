/**
 * extractor.js — Wandlight Continuity
 * Runs the LLM extraction process on GENERATION_ENDED to produce JSON deltas
 * that are validated, merged into state, and persisted.
 *
 * Uses generateQuietPrompt (with generateRaw fallback) for the extraction call.
 * Guard flag _extractionRunning prevents concurrent extraction passes.
 *
 * Imports: constants.js, state-manager.js
 * Imported by: index.js
 * Registered on globalThis as: _wandlightRunExtraction
 */

import { LOG_PREFIX, EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_PROMPT } from './constants.js';
import { getSettings, getState, applyDelta, saveStateWithSnapshot } from './state-manager.js';

/** Guard flag to prevent concurrent extraction passes. */
let _extractionRunning = false;

/**
 * Collects recent narrative text from the chat array for the extraction prompt.
 * Collects from the last user turn forward (user message + all assistant replies
 * since then, until current generation end).
 * @param {Array} chat - The chat array from SillyTavern.getContext()
 * @returns {string} Formatted recent messages string
 */
function collectRecentMessages(chat) {
    if (!chat || chat.length === 0) return '';

    // Walk backward to find the last user message, then collect everything after it
    let startIdx = -1;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (chat[i]?.is_user) {
            startIdx = i;
            break;
        }
    }
    if (startIdx === -1) startIdx = 0;

    const messages = [];
    for (let i = startIdx; i < chat.length; i++) {
        const msg = chat[i];
        if (!msg) continue;
        const role = msg.is_user ? 'User' : (msg.is_system ? 'System' : 'Assistant');
        let content = msg.mes || msg.content || '';
        if (!content.trim()) continue;

        // Strip thinking/reasoning tags
        content = content.replace(/<think\b[^>]*>([\s\S]*?)<\/think>/gi, '');
        content = content.replace(/<thinking\b[^>]*>([\s\S]*?)<\/thinking>/gi, '');
        content = content.replace(/<reasoning\b[^>]*>([\s\S]*?)<\/reasoning>/gi, '');
        content = content.trim();

        if (content) {
            messages.push(`[${role}]\n${content}`);
        }
    }

    return messages.join('\n\n');
}

/**
 * Parses and validates a JSON delta string from the LLM extraction response.
 * Handles markdown fences, leading/trailing non-JSON text, and bad escapes.
 * @param {string} response - Raw LLM response text
 * @returns {Object|null} Parsed WandlightDelta or null on failure
 */
function parseDeltaResponse(response) {
    if (!response || typeof response !== 'string') return null;

    // Try to extract JSON from markdown fences
    let jsonStr = response.trim();

    // Remove ```json fences if present
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
    } else {
        // Try to find the first { and last }
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
        }
    }

    try {
        const parsed = JSON.parse(jsonStr);
        // Validate structure
        if (!parsed || typeof parsed !== 'object') return null;
        // Accept empty changes as valid (no-op delta)
        return parsed;
    } catch (e) {
        console.warn(`${LOG_PREFIX} Failed to parse delta JSON:`, e.message);
        console.debug(`${LOG_PREFIX} Raw response was:`, response.substring(0, 200));
        return null;
    }
}

/**
 * Runs a quiet LLM call to extract continuity state changes.
 * Uses SillyTavern.generateQuietPrompt with generateRaw fallback.
 *
 * @param {string} stateJson - JSON string of current state
 * @param {string} messages - Recent roleplay messages text
 * @returns {Promise<Object|null>} Parsed WandlightDelta or null on failure
 */
async function runExtractionCall(stateJson, messages) {
    const { generateQuietPrompt, generateRaw } = SillyTavern.getContext();

    // Build the system prompt with state and messages interpolated
    const systemPrompt = EXTRACTION_SYSTEM_PROMPT
        .replace('{{stateJson}}', stateJson)
        .replace('{{messages}}', messages);

    try {
        // Try generateQuietPrompt first (ST's preferred silent call API)
        if (typeof generateQuietPrompt === 'function') {
            const response = await generateQuietPrompt(
                EXTRACTION_USER_PROMPT,
                false,  // quietToLlm = false (don't forward)
                '',     // quietName
                '',     // quietImage
                false,  // forceSystemPrompt = false (use what's configured)
                systemPrompt, // systemPromptOverride — we supply our own
                '',     // quietModal — use current model
            );

            if (response && typeof response === 'string') {
                return parseDeltaResponse(response);
            }
        }

        // Fallback: generateRaw
        if (typeof generateRaw === 'function') {
            console.log(`${LOG_PREFIX} generateQuietPrompt unavailable, falling back to generateRaw`);
            const response = await generateRaw(
                systemPrompt,
                '',     // apiType
                false,  // instruct — use raw completion
                '',     // quietName
                '',     // quietImage
            );
            if (response && typeof response === 'string') {
                return parseDeltaResponse(response);
            }
        }

        console.warn(`${LOG_PREFIX} No generate function available for extraction`);
        return null;
    } catch (e) {
        console.error(`${LOG_PREFIX} Extraction call failed:`, e);
        return null;
    }
}

/**
 * Main extraction handler. Called on GENERATION_ENDED if autoExtract is enabled.
 * Collects recent messages, calls the LLM for delta extraction, validates,
 * applies the delta, and persists state.
 *
 * Guarded by _extractionRunning to prevent concurrent passes.
 */
export async function onExtractionTriggered() {
    if (_extractionRunning) {
        if (getSettings().debugMode) {
            console.log(`${LOG_PREFIX} Extraction already running, skipping`);
        }
        return;
    }

    const settings = getSettings();
    if (!settings.enabled || !settings.autoExtract) return;

    // Throttle: only run every N generations
    // Use a static counter
    if (typeof onExtractionTriggered._counter === 'undefined') {
        onExtractionTriggered._counter = 0;
    }
    onExtractionTriggered._counter++;
    const interval = settings.extractionInterval || 1;
    if (onExtractionTriggered._counter < interval) return;
    onExtractionTriggered._counter = 0;

    _extractionRunning = true;

    try {
        const { chat } = SillyTavern.getContext();
        if (!chat || chat.length === 0) return;

        // Collect recent messages
        const messages = collectRecentMessages(chat);
        if (!messages) {
            if (settings.debugMode) {
                console.log(`${LOG_PREFIX} No recent messages to extract from`);
            }
            return;
        }

        // Get current state
        const state = getState();
        let stateJson;
        try {
            stateJson = JSON.stringify(state);
        } catch (e) {
            console.error(`${LOG_PREFIX} Failed to serialize state:`, e);
            return;
        }

        if (settings.debugMode) {
            console.log(`${LOG_PREFIX} Running extraction pass...`);
            console.debug(`${LOG_PREFIX} Messages length:`, messages.length);
            console.debug(`${LOG_PREFIX} State JSON length:`, stateJson.length);
        }

        // Run the extraction LLM call
        const delta = await runExtractionCall(stateJson, messages);

        if (!delta) {
            if (settings.debugMode) {
                console.log(`${LOG_PREFIX} Extraction returned no valid delta`);
            }
            return;
        }

        // Check for no-op delta
        if (!delta.changes || Object.keys(delta.changes).length === 0) {
            if (settings.debugMode) {
                console.log(`${LOG_PREFIX} Extraction delta has no changes — skipping`);
            }
            return;
        }

        if (settings.debugMode) {
            console.log(`${LOG_PREFIX} Extraction delta:`, delta.summary || '(no summary)');
            console.debug(`${LOG_PREFIX} Delta changes:`, Object.keys(delta.changes));
        }

        // Apply the delta
        if (settings.autoApplyDelta) {
            const newState = applyDelta(state, delta);
            saveStateWithSnapshot(newState, settings.maxSnapshots);

            if (settings.debugMode) {
                console.log(`${LOG_PREFIX} Delta applied and state saved`);
            }
        }

        // Trigger UI refresh
        if (typeof globalThis._wandlightRefreshUI === 'function') {
            globalThis._wandlightRefreshUI();
        }
    } catch (e) {
        console.error(`${LOG_PREFIX} Extraction failed:`, e);
    } finally {
        _extractionRunning = false;
    }
}

// ── Expose guard and handler on globalThis for external access ──
/**
 * Returns whether extraction is currently running.
 * @returns {boolean}
 */
export function isExtractionRunning() {
    return _extractionRunning;
}

globalThis._wandlightRunExtraction = onExtractionTriggered;
globalThis._wandlightIsExtractionRunning = isExtractionRunning;

/**
 * Resets the throttle counter. Called on chat change.
 */
export function resetExtractionCounter() {
    onExtractionTriggered._counter = 0;
}