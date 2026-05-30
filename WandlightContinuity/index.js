/**
 * index.js — Wandlight Continuity
 * Extension entrypoint. Wires events, installs the generate_interceptor,
 * and registers the settings panel on jQuery document ready.
 *
 * Imports: constants.js, state-manager.js, prompt-injector.js, extractor.js
 * Imported by: manifest.json (as "js": "index.js")
 */

import { LOG_PREFIX } from './constants.js';
import { getSettings, getState, saveState } from './state-manager.js';
import { installInterceptor } from './prompt-injector.js';
import { onExtractionTriggered, resetExtractionCounter } from './extractor.js';
import { wireMemoPreviewButton } from './ui.js';

(function () {
    const dependencies = [
        { name: 'SillyTavern.getContext', test: () => typeof SillyTavern?.getContext === 'function' },
        { name: 'jQuery', test: () => typeof jQuery === 'function' },
    ];

    const missing = dependencies.filter(d => !d.test());
    if (missing.length > 0) {
        console.error(`${LOG_PREFIX} Required API(s) unavailable: ${missing.map(d => d.name).join(', ')}. Aborting.`);
        return;
    }

    console.log(`${LOG_PREFIX} Wandlight Continuity initialised (v1.0.0)`);
    const settings = getSettings();
    if (settings.debugMode) {
        console.log(`${LOG_PREFIX} Debug mode enabled`);
    }

    // ── Install generate_interceptor ─────────────────────────────────────────
    installInterceptor();

    // ── On jQuery document ready, register the settings panel ───────────────
    $(document).ready(function () {
        console.log(`${LOG_PREFIX} Document ready — registering settings panel`);

        // ST's extension framework expects the settings panel to be rendered
        // via the extension's standard settings mechanism. The settings.html
        // content is loaded automatically by ST when the extension settings
        // are opened. We wire up UI handlers after the settings panel is
        // likely to be in the DOM (polling approach for robustness).

        // Attempt to wire up UI immediately, and also on a short delay
        setTimeout(wireSettingsPanel, 100);
    });

    // ── Event: GENERATION_ENDED ─────────────────────────────────────────────
    // Trigger extraction after each assistant generation completes.
    SillyTavern.getContext().eventSource.on('GENERATION_ENDED', async function () {
        const settings = getSettings();
        if (!settings.enabled || !settings.autoExtract) return;

        if (settings.debugMode) {
            console.log(`${LOG_PREFIX} GENERATION_ENDED — triggering extraction`);
        }

        try {
            await onExtractionTriggered();
        } catch (e) {
            console.error(`${LOG_PREFIX} Extraction handler error:`, e);
        }
    });

    // ── Event: CHAT_CHANGED ─────────────────────────────────────────────────
    // Reset extraction counter and refresh UI when switching chats.
    SillyTavern.getContext().eventSource.on('CHAT_CHANGED', function () {
        if (getSettings().debugMode) {
            console.log(`${LOG_PREFIX} CHAT_CHANGED — resetting extraction counter`);
        }
        resetExtractionCounter();

        // Ensure new chat's state is initialized
        const state = getState();
        saveState(state);

        // Refresh UI for new chat
        if (typeof globalThis._wandlightRefreshUI === 'function') {
            globalThis._wandlightRefreshUI();
        }
    });

    // ── Slash commands ──────────────────────────────────────────────────────
    // Register /wandlight slash command for manual extraction and status
    SillyTavern.getContext().registerSlashCommand('wandlight', async function (args) {
        const cmd = (args || '').trim().toLowerCase();
        const settings = getSettings();

        switch (cmd) {
            case 'extract':
            case 'run':
                // Manually trigger extraction
                if (settings.debugMode) {
                    console.log(`${LOG_PREFIX} Manual extraction triggered via /wandlight`);
                }
                await onExtractionTriggered();
                break;

            case 'status':
            case 'state':
                // Print current state to console
                const state = getState();
                console.log(`${LOG_PREFIX} Current continuity state:`, state);
                break;

            case 'export':
                // Export state as JSON string
                const exportState = getState();
                try {
                    const json = JSON.stringify(exportState, null, 2);
                    console.log(`${LOG_PREFIX} Exported state:`, json);
                    // Copy to clipboard if available
                    if (navigator?.clipboard?.writeText) {
                        await navigator.clipboard.writeText(json);
                        console.log(`${LOG_PREFIX} State copied to clipboard`);
                    }
                } catch (e) {
                    console.error(`${LOG_PREFIX} Export failed:`, e);
                }
                break;

            case 'toggle':
                // Toggle enabled state
                const s = getSettings();
                s.enabled = !s.enabled;
                SillyTavern.getContext().extensionSettings.wandlight_continuity = s;
                if (typeof SillyTavern.getContext().saveSettingsDebounced === 'function') {
                    SillyTavern.getContext().saveSettingsDebounced();
                }
                console.log(`${LOG_PREFIX} Wandlight Continuity ${s.enabled ? 'ENABLED' : 'DISABLED'}`);
                break;

            case 'debug':
                // Toggle debug mode
                const ss = getSettings();
                ss.debugMode = !ss.debugMode;
                SillyTavern.getContext().extensionSettings.wandlight_continuity = ss;
                if (typeof SillyTavern.getContext().saveSettingsDebounced === 'function') {
                    SillyTavern.getContext().saveSettingsDebounced();
                }
                console.log(`${LOG_PREFIX} Debug mode ${ss.debugMode ? 'ON' : 'OFF'}`);
                break;

            default:
                console.log(`${LOG_PREFIX} Available commands:`);
                console.log('  /wandlight extract  — Manually run state extraction');
                console.log('  /wandlight status   — Print current state to console');
                console.log('  /wandlight export   — Export state as JSON (copies to clipboard)');
                console.log('  /wandlight toggle   — Enable/disable the extension');
                console.log('  /wandlight debug    — Toggle debug mode');
                break;
        }
    });

    console.log(`${LOG_PREFIX} Events wired, slash command /wandlight registered`);

    // ── Settings panel wiring (polling approach) ────────────────────────────
    /**
     * Wires up event handlers on the settings panel DOM elements.
     * Called after document ready and on a delay to account for ST's
     * dynamic panel rendering.
     */
    function wireSettingsPanel() {
        // Check if the settings panel exists in the DOM
        const panel = document.getElementById('wandlight_continuity_settings');
        if (!panel) {
            // Panel hasn't been rendered yet — try again later
            if (getSettings().debugMode) {
                console.log(`${LOG_PREFIX} Settings panel not yet in DOM, deferring wiring`);
            }
            setTimeout(wireSettingsPanel, 500);
            return;
        }

        if (getSettings().debugMode) {
            console.log(`${LOG_PREFIX} Wiring settings panel handlers`);
        }

        // Enable/disable checkbox
        const enabledCheckbox = document.getElementById('wandlight_enabled');
        if (enabledCheckbox) {
            enabledCheckbox.checked = getSettings().enabled;
            enabledCheckbox.addEventListener('change', function () {
                const s = getSettings();
                s.enabled = this.checked;
                saveSettingsToStore(s);
                if (s.debugMode) {
                    console.log(`${LOG_PREFIX} Enabled: ${s.enabled}`);
                }
            });
        }

        // Inject Memo checkbox
        const injectMemoCheckbox = document.getElementById('wandlight_inject_memo');
        if (injectMemoCheckbox) {
            injectMemoCheckbox.checked = getSettings().injectMemo;
            injectMemoCheckbox.addEventListener('change', function () {
                const s = getSettings();
                s.injectMemo = this.checked;
                saveSettingsToStore(s);
            });
        }

        // Auto Extract checkbox
        const autoExtractCheckbox = document.getElementById('wandlight_auto_extract');
        if (autoExtractCheckbox) {
            autoExtractCheckbox.checked = getSettings().autoExtract;
            autoExtractCheckbox.addEventListener('change', function () {
                const s = getSettings();
                s.autoExtract = this.checked;
                saveSettingsToStore(s);
            });
        }

        // Auto Apply Delta checkbox
        const autoApplyCheckbox = document.getElementById('wandlight_auto_apply');
        if (autoApplyCheckbox) {
            autoApplyCheckbox.checked = getSettings().autoApplyDelta;
            autoApplyCheckbox.addEventListener('change', function () {
                const s = getSettings();
                s.autoApplyDelta = this.checked;
                saveSettingsToStore(s);
            });
        }

        // Extraction Interval slider/number
        const intervalInput = document.getElementById('wandlight_extraction_interval');
        const intervalValue = document.getElementById('wandlight_extraction_interval_value');
        if (intervalInput && intervalValue) {
            const currentInterval = getSettings().extractionInterval || 1;
            intervalInput.value = currentInterval;
            intervalValue.textContent = currentInterval;
            intervalInput.addEventListener('input', function () {
                const val = parseInt(this.value, 10) || 1;
                intervalValue.textContent = val;
                const s = getSettings();
                s.extractionInterval = val;
                saveSettingsToStoreDebounced(s);
            });
        }

        // Max Snapshots slider/number
        const snapshotsInput = document.getElementById('wandlight_max_snapshots');
        const snapshotsValue = document.getElementById('wandlight_max_snapshots_value');
        if (snapshotsInput && snapshotsValue) {
            const currentSnapshots = getSettings().maxSnapshots || 20;
            snapshotsInput.value = currentSnapshots;
            snapshotsValue.textContent = currentSnapshots;
            snapshotsInput.addEventListener('input', function () {
                const val = parseInt(this.value, 10) || 20;
                snapshotsValue.textContent = val;
                const s = getSettings();
                s.maxSnapshots = val;
                saveSettingsToStoreDebounced(s);
            });
        }

        // Debug Mode checkbox
        const debugCheckbox = document.getElementById('wandlight_debug_mode');
        if (debugCheckbox) {
            debugCheckbox.checked = getSettings().debugMode || false;
            debugCheckbox.addEventListener('change', function () {
                const s = getSettings();
                s.debugMode = this.checked;
                saveSettingsToStore(s);
            });
        }

        // State JSON textarea
        const stateJsonTextarea = document.getElementById('wandlight_state_json');
        const refreshStateBtn = document.getElementById('wandlight_refresh_state');
        const saveStateBtn = document.getElementById('wandlight_save_state');
        const importStateBtn = document.getElementById('wandlight_import_state');
        const exportStateBtn = document.getElementById('wandlight_export_state');

        // Refresh button — reload JSON from live state
        if (refreshStateBtn && stateJsonTextarea) {
            refreshStateBtn.addEventListener('click', function () {
                const state = getState();
                stateJsonTextarea.value = JSON.stringify(state, null, 2);
            });
        }

        // Save button — parse JSON and merge into state
        if (saveStateBtn && stateJsonTextarea) {
            saveStateBtn.addEventListener('click', function () {
                try {
                    const parsed = JSON.parse(stateJsonTextarea.value);
                    if (parsed && typeof parsed === 'object') {
                        const current = getState();
                        // Deep merge the parsed into current
                        const merged = { ...current, ...parsed };
                        saveState(merged);
                        if (typeof globalThis._wandlightRefreshUI === 'function') {
                            globalThis._wandlightRefreshUI();
                        }
                        if (getSettings().debugMode) {
                            console.log(`${LOG_PREFIX} State manually saved from settings panel`);
                        }
                    }
                } catch (e) {
                    console.error(`${LOG_PREFIX} Invalid JSON in state editor:`, e);
                    alert('Invalid JSON. Check console for details.');
                }
            });
        }

        // Import button — file import
        if (importStateBtn && stateJsonTextarea) {
            importStateBtn.addEventListener('click', function () {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.addEventListener('change', function () {
                    const file = this.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = function () {
                        try {
                            const parsed = JSON.parse(reader.result);
                            if (parsed && typeof parsed === 'object') {
                                const current = getState();
                                const merged = { ...current, ...parsed };
                                saveState(merged);
                                stateJsonTextarea.value = JSON.stringify(merged, null, 2);
                                if (typeof globalThis._wandlightRefreshUI === 'function') {
                                    globalThis._wandlightRefreshUI();
                                }
                            }
                        } catch (e) {
                            console.error(`${LOG_PREFIX} Import failed:`, e);
                            alert('Failed to import state. Check console for details.');
                        }
                    };
                    reader.readAsText(file);
                });
                input.click();
            });
        }

        // Export button — download state as JSON file
        if (exportStateBtn) {
            exportStateBtn.addEventListener('click', function () {
                const state = getState();
                const json = JSON.stringify(state, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'wandlight_state_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
                a.click();
                URL.revokeObjectURL(url);
            });
        }

        // Initialize state textarea with current state
        if (stateJsonTextarea && !stateJsonTextarea.value) {
            const state = getState();
            stateJsonTextarea.value = JSON.stringify(state, null, 2);
        }

        // ── Wire the memo preview refresh button ────────────────────────────
        wireMemoPreviewButton();
    }

    /**
     * Saves settings to extension store and persists immediately.
     * @param {Object} s - Settings object
     */
    function saveSettingsToStore(s) {
        SillyTavern.getContext().extensionSettings.wandlight_continuity = s;
        if (typeof SillyTavern.getContext().saveSettingsDebounced === 'function') {
            SillyTavern.getContext().saveSettingsDebounced();
        }
    }

    /** Debounce timer for settings saving. */
    let _saveTimeout = null;

    /**
     * Debounced settings save — for slider inputs.
     * @param {Object} s - Settings object
     */
    function saveSettingsToStoreDebounced(s) {
        SillyTavern.getContext().extensionSettings.wandlight_continuity = s;
        if (_saveTimeout) clearTimeout(_saveTimeout);
        _saveTimeout = setTimeout(() => {
            if (typeof SillyTavern.getContext().saveSettingsDebounced === 'function') {
                SillyTavern.getContext().saveSettingsDebounced();
            }
        }, 300);
    }
})();