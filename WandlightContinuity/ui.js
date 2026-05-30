/**
 * ui.js — Wandlight Continuity
 * Settings panel UI helpers: memo preview refresh, state display refresh,
 * and the globalThis._wandlightRefreshUI function that index.js and
 * extractor.js call to keep the panel in sync.
 *
 * Imports: constants.js, state-manager.js, memo-builder.js
 * Imported by: index.js
 */

import { LOG_PREFIX } from './constants.js';
import { getState } from './state-manager.js';

/**
 * Refreshes both the state JSON textarea and the memo preview in the
 * settings panel. Registered on globalThis._wandlightRefreshUI so that
 * extractor.js and event handlers can trigger a refresh without importing
 * this module.
 */
export function refreshSettingsUI() {
    // Refresh state JSON textarea
    const stateTextarea = document.getElementById('wandlight_state_json');
    if (stateTextarea) {
        try {
            const state = getState();
            stateTextarea.value = JSON.stringify(state, null, 2);
        } catch (e) {
            console.error(`${LOG_PREFIX} Failed to refresh state textarea:`, e);
        }
    }

    // Refresh memo preview
    const memoPreview = document.getElementById('wandlight_memo_preview');
    if (memoPreview && typeof globalThis._wandlightBuildMemo === 'function') {
        try {
            const state = getState();
            const memo = globalThis._wandlightBuildMemo(state);
            memoPreview.textContent = memo || '(No continuity data to display)';
        } catch (e) {
            console.error(`${LOG_PREFIX} Failed to refresh memo preview:`, e);
            memoPreview.textContent = '(Error building memo)';
        }
    }
}

// Register on globalThis so extractor.js and index.js event handlers can
// call it without importing this module.
globalThis._wandlightRefreshUI = refreshSettingsUI;

/**
 * Wires the "Refresh Preview" button in the memo preview section.
 * Called from index.js when the settings panel enters the DOM.
 * (Separate from refreshSettingsUI to avoid redundant wiring attempts.)
 */
export function wireMemoPreviewButton() {
    const refreshMemoBtn = document.getElementById('wandlight_refresh_memo');
    if (refreshMemoBtn) {
        // Remove old listeners by cloning (simple dedup)
        const clone = refreshMemoBtn.cloneNode(true);
        refreshMemoBtn.parentNode.replaceChild(clone, refreshMemoBtn);

        clone.addEventListener('click', function () {
            const memoPreview = document.getElementById('wandlight_memo_preview');
            if (memoPreview && typeof globalThis._wandlightBuildMemo === 'function') {
                try {
                    const state = getState();
                    const memo = globalThis._wandlightBuildMemo(state);
                    memoPreview.textContent = memo || '(No continuity data to display)';
                } catch (e) {
                    console.error(`${LOG_PREFIX} Failed to refresh memo preview:`, e);
                    memoPreview.textContent = '(Error building memo)';
                }
            }
        });
    }
}