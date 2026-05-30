/**
 * state-manager.js — Wandlight Continuity
 * State CRUD, settings I/O, migration, and delta merging.
 * All reads reacquire from SillyTavern's context — nothing is cached.
 *
 * Imports: constants.js
 * Imported by: index.js, memo-builder.js, extractor.js, ui.js
 */

import { MODULE_KEY, DEFAULT_SETTINGS, getDefaultState, SCHEMA_VERSION, LOG_PREFIX } from './constants.js';

// ── Settings I/O ────────────────────────────────────────────────────────────────

/**
 * Reads extensionSettings.wandlight_continuity, deep-merges defaults for any
 * missing keys, and returns the live settings object. Always reacquires from
 * SillyTavern.getContext().
 * @returns {Object} WandlightSettings
 */
export function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();
    if (!extensionSettings[MODULE_KEY]) {
        extensionSettings[MODULE_KEY] = {};
    }
    const stored = extensionSettings[MODULE_KEY];
    // Deep-merge defaults into stored, preserving any existing keys
    const merged = { ...DEFAULT_SETTINGS, ...stored };
    // Write back merged defaults so the object is complete going forward
    extensionSettings[MODULE_KEY] = merged;
    return merged;
}

/**
 * Writes settings to extensionSettings.wandlight_continuity and persists
 * via saveSettingsDebounced().
 * @param {Object} settings - WandlightSettings to save
 */
export function saveSettings(settings) {
    const { extensionSettings, saveSettingsDebounced } = SillyTavern.getContext();
    extensionSettings[MODULE_KEY] = settings;
    if (typeof saveSettingsDebounced === 'function') {
        saveSettingsDebounced();
    }
}

// ── State I/O ───────────────────────────────────────────────────────────────────

/**
 * Reads chatMetadata.wandlight_continuity, migrates if needed, merges with
 * defaults, and returns the live state object. Always reacquires from
 * SillyTavern.getContext().
 * @returns {Object} WandlightState
 */
export function getState() {
    const { chatMetadata } = SillyTavern.getContext();
    if (!chatMetadata) {
        console.warn(`${LOG_PREFIX} chatMetadata not available, returning default state`);
        return getDefaultState();
    }
    let state = chatMetadata[MODULE_KEY];
    if (!state || typeof state !== 'object') {
        state = getDefaultState();
        chatMetadata[MODULE_KEY] = state;
        return state;
    }
    // Always run migration on read
    state = migrateState(state);
    // Ensure memoHistory is an array
    if (!Array.isArray(state.memoHistory)) {
        state.memoHistory = [];
    }
    // Ensure lastDelta is null or valid
    if (state.lastDelta === undefined) {
        state.lastDelta = null;
    }
    chatMetadata[MODULE_KEY] = state;
    return state;
}

/**
 * Writes state to chatMetadata.wandlight_continuity, pushes a compact memo
 * snapshot to memoHistory if the state changed, and persists via saveMetadata().
 * @param {Object} state - WandlightState to save
 */
export function saveState(state) {
    const { chatMetadata, saveMetadata } = SillyTavern.getContext();
    if (!chatMetadata) {
        console.warn(`${LOG_PREFIX} chatMetadata not available, cannot save state`);
        return;
    }
    // Ensure the state has a version
    if (!state._version) {
        state._version = SCHEMA_VERSION;
    }
    chatMetadata[MODULE_KEY] = state;
    if (typeof saveMetadata === 'function') {
        saveMetadata();
    }
}

/**
 * Saves state and also pushes a snapshot to memoHistory.
 * @param {Object} state - WandlightState
 * @param {number} maxSnapshots - Max memo snapshots to keep
 */
export function saveStateWithSnapshot(state, maxSnapshots) {
    const { chatMetadata, saveMetadata } = SillyTavern.getContext();
    if (!chatMetadata) return;
    if (!state._version) state._version = SCHEMA_VERSION;

    // Build compact memo snapshot for history
    // (Imported dynamically to avoid circular dependency — resolved at call time)
    if (typeof globalThis._wandlightBuildMemo === 'function') {
        const memo = globalThis._wandlightBuildMemo(state);
        if (memo) {
            if (!Array.isArray(state.memoHistory)) state.memoHistory = [];
            state.memoHistory.push(memo);
            // Trim history
            const max = maxSnapshots || DEFAULT_SETTINGS.maxSnapshots;
            if (state.memoHistory.length > max) {
                state.memoHistory = state.memoHistory.slice(-max);
            }
        }
    }

    chatMetadata[MODULE_KEY] = state;
    if (typeof saveMetadata === 'function') {
        saveMetadata();
    }
}

// ── State migration ─────────────────────────────────────────────────────────────

/**
 * Checks _version and applies migration steps to bring old state objects
 * forward to the current schema version.
 * @param {Object} state - Raw state from storage (may be any schema version)
 * @returns {Object} Migrated WandlightState
 */
export function migrateState(state) {
    const defaults = getDefaultState();
    if (!state || typeof state !== 'object') {
        return defaults;
    }

    // Version 0 (no _version) → Version 1
    if (!state._version || state._version < 1) {
        // Ensure canon block exists
        if (!state.canon) state.canon = { ...defaults.canon };
        else {
            state.canon.era = state.canon.era || '';
            state.canon.inUniverseDate = state.canon.inUniverseDate || '';
            state.canon.canonBoundary = state.canon.canonBoundary || '';
            if (!Array.isArray(state.canon.divergences)) state.canon.divergences = [];
        }

        // Ensure scene block exists
        if (!state.scene) state.scene = { ...defaults.scene };
        else {
            state.scene.location = state.scene.location || '';
            state.scene.timeOfDay = state.scene.timeOfDay || '';
            state.scene.weather = state.scene.weather || '';
            if (!Array.isArray(state.scene.presentCharacters)) state.scene.presentCharacters = [];
            if (!Array.isArray(state.scene.nearbyCharacters)) state.scene.nearbyCharacters = [];
            state.scene.currentActivity = state.scene.currentActivity || '';
        }

        // Ensure knowledge exists
        if (!state.knowledge || typeof state.knowledge !== 'object' || Array.isArray(state.knowledge)) {
            state.knowledge = {};
        }

        // Ensure arrays exist
        if (!Array.isArray(state.secrets)) state.secrets = [];
        if (!Array.isArray(state.relationships)) state.relationships = [];
        if (!Array.isArray(state.threads)) state.threads = [];
        if (!Array.isArray(state.continuityFlags)) state.continuityFlags = [];
        if (!Array.isArray(state.memoHistory)) state.memoHistory = [];
        if (state.lastDelta === undefined) state.lastDelta = null;

        state._version = 1;
    }

    // Future migration steps would go here:
    // if (state._version < 2) { ... state._version = 2; }

    return state;
}

// ── Delta application ───────────────────────────────────────────────────────────

/**
 * Deep-merges a WandlightDelta into the current WandlightState.
 * Returns a new state object — does not mutate the input.
 *
 * @param {Object} state - Current WandlightState
 * @param {Object} delta - WandlightDelta to apply
 * @returns {Object} New WandlightState
 */
export function applyDelta(state, delta) {
    if (!delta || !delta.changes) return state;

    // Shallow clone top level
    const next = {
        ...state,
        canon: { ...state.canon, divergences: [...(state.canon.divergences || [])] },
        scene: { ...state.scene, presentCharacters: [...(state.scene.presentCharacters || [])], nearbyCharacters: [...(state.scene.nearbyCharacters || [])] },
        knowledge: { ...state.knowledge },
        secrets: [...(state.secrets || [])],
        relationships: [...(state.relationships || [])],
        threads: [...(state.threads || [])],
        continuityFlags: [...(state.continuityFlags || [])],
        memoHistory: [...(state.memoHistory || [])],
        lastDelta: delta,
    };

    const changes = delta.changes;

    // Canon block — shallow merge
    if (changes.canon) {
        if (changes.canon.era !== undefined) next.canon.era = changes.canon.era;
        if (changes.canon.inUniverseDate !== undefined) next.canon.inUniverseDate = changes.canon.inUniverseDate;
        if (changes.canon.canonBoundary !== undefined) next.canon.canonBoundary = changes.canon.canonBoundary;
        if (Array.isArray(changes.canon.divergences)) {
            next.canon.divergences = changes.canon.divergences;
        }
    }

    // Scene block — shallow merge
    if (changes.scene) {
        if (changes.scene.location !== undefined) next.scene.location = changes.scene.location;
        if (changes.scene.timeOfDay !== undefined) next.scene.timeOfDay = changes.scene.timeOfDay;
        if (changes.scene.weather !== undefined) next.scene.weather = changes.scene.weather;
        if (Array.isArray(changes.scene.presentCharacters)) {
            next.scene.presentCharacters = changes.scene.presentCharacters;
        }
        if (Array.isArray(changes.scene.nearbyCharacters)) {
            next.scene.nearbyCharacters = changes.scene.nearbyCharacters;
        }
        if (changes.scene.currentActivity !== undefined) next.scene.currentActivity = changes.scene.currentActivity;
    }

    // Knowledge — character-keyed, merge arrays per character
    if (changes.knowledge) {
        for (const [char, facts] of Object.entries(changes.knowledge)) {
            if (!Array.isArray(facts)) continue;
            const existing = next.knowledge[char] || [];
            const merged = [...existing];
            for (const fact of facts) {
                if (!merged.includes(fact)) merged.push(fact);
            }
            next.knowledge[char] = merged;
        }
    }

    // Secrets — add/update/remove pattern
    if (changes.secrets) {
        if (Array.isArray(changes.secrets.added)) {
            next.secrets.push(...changes.secrets.added);
        }
        if (Array.isArray(changes.secrets.updated)) {
            for (const upd of changes.secrets.updated) {
                const idx = upd.index;
                if (idx >= 0 && idx < next.secrets.length) {
                    next.secrets[idx] = { ...next.secrets[idx], ...upd.changes };
                }
            }
        }
        if (Array.isArray(changes.secrets.removed)) {
            // Remove from highest to lowest index to avoid shifting
            const sorted = [...changes.secrets.removed].sort((a, b) => b - a);
            for (const idx of sorted) {
                if (idx >= 0 && idx < next.secrets.length) {
                    next.secrets.splice(idx, 1);
                }
            }
        }
    }

    // Relationships — add/update/remove pattern
    if (changes.relationships) {
        if (Array.isArray(changes.relationships.added)) {
            next.relationships.push(...changes.relationships.added);
        }
        if (Array.isArray(changes.relationships.updated)) {
            for (const upd of changes.relationships.updated) {
                const idx = upd.index;
                if (idx >= 0 && idx < next.relationships.length) {
                    next.relationships[idx] = { ...next.relationships[idx], ...upd.changes };
                }
            }
        }
        if (Array.isArray(changes.relationships.removed)) {
            const sorted = [...changes.relationships.removed].sort((a, b) => b - a);
            for (const idx of sorted) {
                if (idx >= 0 && idx < next.relationships.length) {
                    next.relationships.splice(idx, 1);
                }
            }
        }
    }

    // Threads — add/update pattern (no removal — threads resolve, not delete)
    if (changes.threads) {
        if (Array.isArray(changes.threads.added)) {
            next.threads.push(...changes.threads.added);
        }
        if (Array.isArray(changes.threads.updated)) {
            for (const upd of changes.threads.updated) {
                const idx = upd.index;
                if (idx >= 0 && idx < next.threads.length) {
                    next.threads[idx] = { ...next.threads[idx], ...upd.changes };
                }
            }
        }
    }

    // Continuity flags — add/resolve pattern
    if (changes.continuityFlags) {
        if (Array.isArray(changes.continuityFlags.added)) {
            next.continuityFlags.push(...changes.continuityFlags.added);
        }
        if (Array.isArray(changes.continuityFlags.resolved)) {
            next.continuityFlags = next.continuityFlags.filter(
                (_, i) => !changes.continuityFlags.resolved.includes(i)
            );
        }
    }

    return next;
}

// ── Merge (user edits via JSON textarea) ────────────────────────────────────────

/**
 * Shallow-merge a partial state object into the full state. Used for direct
 * user edits via the JSON textarea in settings.
 * @param {Object} state - Current WandlightState
 * @param {Object} partial - Partial WandlightState from user
 * @returns {Object} Merged WandlightState
 */
export function mergeState(state, partial) {
    if (!partial || typeof partial !== 'object') return state;
    return { ...state, ...partial, _version: state._version || SCHEMA_VERSION };
}

// ── Undo ────────────────────────────────────────────────────────────────────────

/**
 * Removes the last entry from memoHistory and reverts to the previous snapshot.
 * Returns the reverted state, or unchanged state if no history exists.
 * @param {Object} state - Current WandlightState
 * @returns {Object} Reverted WandlightState
 */
export function undoLastChange(state) {
    if (!Array.isArray(state.memoHistory) || state.memoHistory.length === 0) {
        return state;
    }
    const next = { ...state };
    next.memoHistory = [...state.memoHistory];
    next.memoHistory.pop();
    next.lastDelta = null;
    return next;
}

// ── Export / Import ─────────────────────────────────────────────────────────────

/**
 * Serializes state to a pretty-printed JSON string.
 * @param {Object} state - WandlightState
 * @returns {string} JSON string
 */
export function exportState(state) {
    try {
        return JSON.stringify(state, null, 2);
    } catch (e) {
        console.error(`${LOG_PREFIX} Failed to export state:`, e);
        return '{}';
    }
}

/**
 * Parses a JSON string, validates required fields, fills defaults for
 * missing fields, and returns a WandlightState.
 * @param {string} json - JSON string
 * @returns {Object|null} WandlightState or null on parse failure
 */
export function importState(json) {
    try {
        const parsed = JSON.parse(json);
        if (!parsed || typeof parsed !== 'object') return null;
        // Merge with defaults to fill missing fields
        const defaults = getDefaultState();
        const merged = {
            ...defaults,
            ...parsed,
            canon: { ...defaults.canon, ...(parsed.canon || {}) },
            scene: { ...defaults.scene, ...(parsed.scene || {}) },
            knowledge: parsed.knowledge && typeof parsed.knowledge === 'object' && !Array.isArray(parsed.knowledge)
                ? parsed.knowledge : {},
            secrets: Array.isArray(parsed.secrets) ? parsed.secrets : [],
            relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
            threads: Array.isArray(parsed.threads) ? parsed.threads : [],
            continuityFlags: Array.isArray(parsed.continuityFlags) ? parsed.continuityFlags : [],
            memoHistory: Array.isArray(parsed.memoHistory) ? parsed.memoHistory : [],
            lastDelta: parsed.lastDelta || null,
            _version: SCHEMA_VERSION,
        };
        // Re-migrate to ensure current schema
        return migrateState(merged);
    } catch (e) {
        console.error(`${LOG_PREFIX} Failed to import state:`, e);
        return null;
    }
}

// ── Export the default state factory for convenience ────────────────────────────
export { getDefaultState };