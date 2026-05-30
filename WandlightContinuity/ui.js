/**
 * ui.js — Wandlight Continuity
 * Renders the settings panel and state viewer UI.
 *
 * Exports: renderSettingsPanel, renderStatePanel
 * Imported by: index.js
 */

import { buildMemo } from './memo-builder.js';
import { getState } from './state-manager.js';

/**
 * Renders the settings panel HTML into the container.
 * Since settings.html is auto-loaded by ST's extension loader,
 * this function populates dynamic values, wires range displays,
 * and initializes the memo preview.
 *
 * @param {HTMLElement} container - The settings panel div
 */
export function renderSettingsPanel(container) {
    if (!container) return;

    // Wire range-input live value displays
    wireRangeDisplay('wandlight_extraction_interval', 'wandlight_extraction_interval_value');
    wireRangeDisplay('wandlight_max_snapshots', 'wandlight_max_snapshots_value');

    // Refresh memo preview on button
    const refreshMemoBtn = container.querySelector('#wandlight_refresh_memo');
    if (refreshMemoBtn) {
        refreshMemoBtn.addEventListener('click', () => {
            refreshMemoPreview();
        });
    }

    // State viewer: double-click to edit raw JSON
    const stateDisplay = container.querySelector('#wandlight_state_display');
    const stateEditor = container.querySelector('#wandlight_state_json');
    if (stateDisplay && stateEditor) {
        stateDisplay.addEventListener('dblclick', () => {
            const state = getState();
            stateEditor.value = JSON.stringify(state, null, 2);
            stateDisplay.style.display = 'none';
            stateEditor.style.display = 'block';
            stateEditor.focus();
        });
    }

    // Save edited state
    const saveStateBtn = container.querySelector('#wandlight_save_state');
    if (saveStateBtn && stateEditor && stateDisplay) {
        saveStateBtn.addEventListener('click', () => {
            try {
                const parsed = JSON.parse(stateEditor.value);
                // Validate it looks like a WandlightState
                if (!parsed || typeof parsed !== 'object') {
                    if (typeof toastr !== 'undefined') toastr.error('Invalid state JSON');
                    return;
                }
                const { saveState } = require('./state-manager.js');
                saveState(parsed);
                if (typeof toastr !== 'undefined') toastr.success('State saved');
                stateEditor.style.display = 'none';
                stateDisplay.style.display = 'block';
                if (typeof globalThis._wandlightRefreshUI === 'function') {
                    globalThis._wandlightRefreshUI();
                }
            } catch (e) {
                if (typeof toastr !== 'undefined') toastr.error('Invalid JSON: ' + e.message);
            }
        });
    }

    // Refresh state button
    const refreshStateBtn = container.querySelector('#wandlight_refresh_state');
    if (refreshStateBtn) {
        refreshStateBtn.addEventListener('click', () => {
            if (typeof globalThis._wandlightRefreshUI === 'function') {
                globalThis._wandlightRefreshUI();
            }
        });
    }

    // Initial memo refresh
    setTimeout(() => refreshMemoPreview(), 50);
}

/**
 * Refreshes the memo preview area from current state.
 */
function refreshMemoPreview() {
    const preview = document.getElementById('wandlight_memo_preview');
    if (!preview) return;

    try {
        const state = getState();
        if (!state) {
            preview.textContent = '(No continuity state loaded)';
            return;
        }
        const memo = buildMemo(state);
        if (!memo || !memo.trim()) {
            preview.textContent = '(Memo is empty — populate continuity state via extraction or manual editing)';
        } else {
            preview.textContent = memo;
        }
    } catch (e) {
        preview.textContent = '(Error building memo: ' + e.message + ')';
    }
}

/**
 * Renders the state viewer panel content.
 * Shows a formatted summary of each state section with edit capability.
 *
 * @param {HTMLElement} container - The state display div
 * @param {Object} state - Current WandlightState
 */
export function renderStatePanel(container, state) {
    if (!container || !state) return;

    const sections = [];

    // Section renderer helper
    function addSection(title, data, icon) {
        if (!data) return;
        const lines = [];
        if (typeof data === 'string') {
            lines.push(data);
        } else if (Array.isArray(data)) {
            if (data.length === 0) {
                lines.push('<span style="opacity:0.5;">(empty)</span>');
            } else {
                data.forEach((item, i) => {
                    if (typeof item === 'string') {
                        lines.push(`<span style="opacity:0.7;">${i + 1}.</span> ${escapeHtml(item)}`);
                    } else if (item && typeof item === 'object') {
                        // Handle objects (relationships, threads)
                        const label = item.name || item.id || item.topic || `Item ${i + 1}`;
                        const detail = item.content || item.detail || item.status || item.state || '';
                        const detailStr = detail ? ` → <span style="opacity:0.7;">${escapeHtml(String(detail))}</span>` : '';
                        lines.push(`<span style="opacity:0.7;">${i + 1}.</span> <strong>${escapeHtml(String(label))}</strong>${detailStr}`);
                    }
                });
            }
        } else if (data && typeof data === 'object') {
            Object.entries(data).forEach(([k, v]) => {
                if (v === null || v === undefined || v === '') return;
                lines.push(`<strong>${escapeHtml(k)}:</strong> <span style="opacity:0.8;">${escapeHtml(typeof v === 'object' ? JSON.stringify(v) : String(v))}</span>`);
            });
        }

        if (lines.length > 0) {
            sections.push([
                `<div class="wandlight-state-section" style="margin-bottom:8px;">`,
                `<div style="font-weight:bold;opacity:0.9;margin-bottom:2px;">${icon ? icon + ' ' : ''}${escapeHtml(title)}</div>`,
                ...lines.map(l => `<div style="padding-left:12px;font-size:0.95em;">${l}</div>`),
                `</div>`,
            ].join(''));
        }
    }

    addSection('Canon Facts', state.canon, '📖');
    addSection('Scene', state.scene, '🎬');
    addSection('Knowledge', state.knowledge, '🧠');
    addSection('Secrets', state.secrets, '🔒');
    addSection('Relationships', state.relationships, '👥');
    addSection('Threads', state.threads, '🧵');
    addSection('Continuity Flags', state.continuityFlags, '🏴');

    if (state.stateHistory && state.stateHistory.length > 0) {
        sections.push([
            `<div class="wandlight-state-section" style="margin-bottom:8px;">`,
            `<div style="font-weight:bold;opacity:0.9;margin-bottom:2px;">📋 History</div>`,
            `<div style="padding-left:12px;font-size:0.95em;opacity:0.7;">`,
            `${state.stateHistory.length} snapshot(s) available for undo`,
            `</div>`,
            `</div>`,
        ].join(''));
    }

    // Version and metadata footer
    sections.push([
        `<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.1);font-size:0.75em;opacity:0.5;">`,
        `Schema version: ${escapeHtml(String(state.schemaVersion || '1'))}`,
        state.lastModified ? ` | Modified: ${escapeHtml(String(state.lastModified))}` : '',
        `</div>`,
    ].join(''));

    container.innerHTML = sections.length > 0
        ? sections.join('')
        : '<em>No continuity state data available</em>';
}

/**
 * Wires a range input to display its live value next to it.
 * @param {string} inputId - ID of the range input
 * @param {string} displayId - ID of the value display span
 */
function wireRangeDisplay(inputId, displayId) {
    const input = document.getElementById(inputId);
    const display = document.getElementById(displayId);
    if (!input || !display) return;

    const updateDisplay = () => {
        display.textContent = input.value;
    };
    input.addEventListener('input', updateDisplay);
    updateDisplay();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '&#039;');
}