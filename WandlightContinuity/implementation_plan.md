# Implementation Plan

[Overview]
Create a Harry Potter / Hogwarts narrative-continuity extension that provides structured state tracking for the Wandlight SillyTavern preset, acting as middleware between chat messages and the LLM to maintain reliable canon continuity across roleplay sessions.

This extension is narrative-continuity middleware for Wandlight, not a game mechanics system. Wandlight handles prose, style, and canon roleplay; this extension is the source of truth for scene state, canon boundary, character knowledge, secrets, relationships, and continuity. It injects a compact state memo into every outgoing prompt and optionally extracts state changes from assistant responses using a second LLM pass. The extension follows SillyTavern extension conventions, using `extensionSettings` for global configuration and `chatMetadata` for per-chat continuity state. All state is persisted through SillyTavern's built-in save mechanisms (`saveSettingsDebounced()` and `saveMetadata()`). The architecture is modeled on the FatbodyDnDFramework reference patterns—persistent state object, second-pass state extraction, rolling state memo injected into prompts, snapshot history, delta log, manual correction/rollback—but adapted for narrative continuity rather than D&D mechanics.

[Types]
State schema defines the shape of per-chat continuity state stored in `chatMetadata.wandlight_continuity`, memo format for prompt injection, and delta format for state extraction.

### Per-Chat State Object (`chatMetadata.wandlight_continuity`)

```typescript
interface WandlightState {
  canon: {
    era: string;                    // e.g. "Half-Blood Prince", "Post-War"
    inUniverseDate: string;         // e.g. "September 1, 1996", "Late January 1997"
    canonBoundary: string;          // e.g. "Through Chapter 14 of HBP", "Post-canon, ignoring Epilogue"
    divergences: Array<{
      description: string;          // What diverged from canon
      sinceDate: string;            // When the divergence occurred in-universe
    }>;
  };
  scene: {
    location: string;               // e.g. "Gryffindor Common Room", "Diagon Alley"
    timeOfDay: string;              // e.g. "Morning", "Late Evening"
    weather: string;                // e.g. "Overcast, cold"
    presentCharacters: string[];    // Characters currently in the scene
    nearbyCharacters: string[];     // Characters nearby but not directly present
    currentActivity: string;        // What is currently happening
  };
  knowledge: {
    [character: string]: string[];  // Character name -> list of known facts
  };
  secrets: Array<{
    fact: string;                   // The secret information
    trueState: string;              // The actual truth
    whoKnows: string[];             // Characters who know the truth
    whoSuspects: string[];          // Characters who suspect something
    publicVersion: string;          // What most characters believe
  }>;
  relationships: Array<{
    pair: string;                   // e.g. "Harry↔Hermione", "Dumbledore→Snape"
    notes: string;                  // Current relationship state
    tension: "low" | "medium" | "high" | "critical";
    trust: "low" | "medium" | "high" | "absolute";
  }>;
  threads: Array<{
    description: string;            // Plot thread description
    status: "active" | "dormant" | "resolved";
    unresolvedConsequences: string[]; // Outstanding consequences
  }>;
  continuityFlags: Array<{
    type: "contradiction" | "uncertainty" | "warning";
    description: string;
    severity: "low" | "medium" | "high";
    timestamp: number;
  }>;
  memoHistory: string[];           // Recent compact memo snapshots (max N)
  lastDelta: WandlightDelta | null; // Most recent proposed state update
  _version: number;                 // Schema version for migration
}
```

### Delta Format (returned by extraction pass)

```typescript
interface WandlightDelta {
  timestamp: number;
  summary: string;                  // One-line description of what changed
  changes: {
    canon?: Partial<WandlightState["canon"]>;
    scene?: Partial<WandlightState["scene"]>;
    knowledge?: { [character: string]: string[] };  // Merged, not replaced
    secrets?: {
      added?: WandlightState["secrets"];
      updated?: Array<{ index: number; changes: Partial<WandlightState["secrets"][0]> }>;
      removed?: number[];
    };
    relationships?: {
      added?: WandlightState["relationships"];
      updated?: Array<{ index: number; changes: Partial<WandlightState["relationships"][0]> }>;
      removed?: number[];
    };
    threads?: {
      added?: WandlightState["threads"];
      updated?: Array<{ index: number; changes: Partial<WandlightState["threads"][0]> }>;
    };
    continuityFlags?: {
      added?: WandlightState["continuityFlags"];
      resolved?: number[];
    };
  };
  rawResponse?: string;             // Original LLM response for debugging
}
```

### Compact Memo Format (injected into prompt)

```
[WANDLIGHT CONTINUITY STATE]
Canon Era: {canon.era}
Date / Time: {canon.inUniverseDate}, {scene.timeOfDay}
Location: {scene.location}
Present Characters: {scene.presentCharacters.join(", ")}
Current Scene: {scene.currentActivity}
Character Knowledge Constraints:
- {char}: {facts}
Secrets Not Public: {non-public secret facts}
Relationship Tensions: {tense pairs with notes}
Active Threads: {active thread descriptions}
Continuity Warnings: {unresolved flags}
[/WANDLIGHT CONTINUITY STATE]
```

Each section is only included if it has content. Character knowledge is condensed to show only present characters. Secrets only show facts whose `whoKnows` array is not "everyone". Relationships only show pairs with tension "high" or "critical". Threads only show "active" status. The memo targets under 500 tokens.

### Extension Settings (stored in `extensionSettings.wandlight_continuity`)

```typescript
interface WandlightSettings {
  enabled: boolean;                 // Master enable/disable
  injectMemo: boolean;             // Inject memo into prompts
  autoExtract: boolean;            // Run extraction after assistant responses
  autoApplyDelta: boolean;         // Auto-apply deltas (vs manual approval)
  extractionInterval: number;      // Run extraction every N generations (1 = every)
  maxSnapshots: number;            // Max memo snapshots in history (default 20)
  debugMode: boolean;              // Verbose console logging
}
```

[Files]
All new files are created under the `WandlightContinuity/` directory at the project root. No existing files are modified. No files are deleted or moved.

### New Files

| File | Purpose |
|------|---------|
| `WandlightContinuity/manifest.json` | Extension manifest: declares module key, hooks, settings template, entrypoint |
| `WandlightContinuity/index.js` | Entrypoint: wires event listeners (`GENERATION_ENDED`, `CHAT_CHANGED`), loads settings, registers `generate_interceptor`, mounts settings UI |
| `WandlightContinuity/constants.js` | Module key (`wandlight_continuity`), default state object, default settings, extraction prompt template, logging prefix |
| `WandlightContinuity/state-manager.js` | State CRUD: `getState()`, `saveState()`, `getDefaultState()`, `applyDelta()`, `mergeState()`, `undoLastChange()`, `exportState()`, `importState()`, `migrateState()`, `getSettings()`, `saveSettings()` |
| `WandlightContinuity/memo-builder.js` | `buildMemo(state)`: constructs the compact prompt-injection memo from the state object, condensing and truncating where necessary |
| `WandlightContinuity/extractor.js` | `runExtraction()`: reads latest messages + current state, calls `generateQuietPrompt`/`generateRaw`, validates and returns a delta. Includes `_extractionRunning` guard |
| `WandlightContinuity/prompt-injector.js` | `installInterceptor()`: registers `globalThis.wandlightContinuityInterceptor` function, reads state, builds memo, prepends to last user message in chat array |
| `WandlightContinuity/ui.js` | `renderSettingsUI()`: renders the settings drawer panel from the `#wandlight_continuity_settings` template. Button handlers for: Run Extraction Now, Apply Last Delta, Reject Last Delta, Undo Last State Change, Reset Chat State, Copy Memo, Export State JSON, Import State JSON |
| `WandlightContinuity/settings.html` | HTML template for the extension settings panel with toggles, number inputs, state JSON textarea, memo preview, delta preview, action buttons |
| `WandlightContinuity/style.css` | Minimal styling for the settings panel: layout grid, button styles, textarea sizing, error/warning classes |

### Configuration File Notes

- `manifest.json` uses `"key": "wandlight_continuity"` and declares `"generate_interceptor"` hook
- No changes to `Presets/Wandlight-1.3.json` — this extension is independent
- No changes to `README.md` — can be updated in a future pass

[Functions]
All new functions. No existing functions are modified or removed since this is a greenfield extension.

### state-manager.js

| Function | Signature | Purpose |
|----------|-----------|---------|
| `getSettings()` | `() => WandlightSettings` | Reads `extensionSettings.wandlight_continuity`, merges with defaults, returns settings object. Always reacquires from `SillyTavern.getContext()` |
| `saveSettings(settings)` | `(WandlightSettings) => void` | Writes to `extensionSettings.wandlight_continuity` and calls `saveSettingsDebounced()` |
| `getState()` | `() => WandlightState` | Reads `chatMetadata.wandlight_continuity`, merges with defaults (including migration), returns state. Always reacquires. |
| `saveState(state)` | `(WandlightState) => void` | Writes to `chatMetadata.wandlight_continuity`, calls `saveMetadata()`, pushes memo to `memoHistory` if changed |
| `getDefaultState()` | `() => WandlightState` | Returns a fresh default state object with all fields initialized |
| `applyDelta(state, delta)` | `(WandlightState, WandlightDelta) => WandlightState` | Deep-merges delta into state. Arrays are concatenated (not replaced) for knowledge. Indexed arrays (secrets, relationships, threads) use add/update/remove pattern. Returns new state object (does not mutate input) |
| `mergeState(state, partial)` | `(WandlightState, Partial<WandlightState>) => WandlightState` | Shallow merge for direct user edits via JSON textarea |
| `undoLastChange(state)` | `(WandlightState) => WandlightState` | Removes the last entry from `memoHistory` and reverts to the previous snapshot if available. Returns reverted state or unchanged state |
| `exportState(state)` | `(WandlightState) => string` | Returns `JSON.stringify(state, null, 2)` |
| `importState(json)` | `(string) => WandlightState` | Parses JSON, validates required fields, fills defaults for missing fields, returns state |
| `migrateState(state)` | `(any) => WandlightState` | Checks `_version`, applies migration steps (add missing fields, rename deprecated keys), returns migrated state |

### memo-builder.js

| Function | Signature | Purpose |
|----------|-----------|---------|
| `buildMemo(state)` | `(WandlightState) => string` | Constructs the `[WANDLIGHT CONTINUITY STATE]...[/WANDLIGHT CONTINUITY STATE]` block. Condenses knowledge to present characters only. Filters secrets to non-public. Filters relationships to medium+ tension. Filters threads to active only. Truncates long lists at reasonable limits. |

### extractor.js

| Function | Signature | Purpose |
|----------|-----------|---------|
| `runExtraction()` | `() => Promise<WandlightDelta \| null>` | Main extraction orchestrator. Checks `_extractionRunning` guard. Reads latest user + assistant messages from chat. Reads current state. Builds extraction prompt. Calls `generateQuietPrompt()`. Parses JSON response, validates against delta schema. Returns delta or null on failure. |
| `buildExtractionPrompt(messages, state)` | `(string, WandlightState) => string` | Constructs the system prompt instructing the LLM to extract a delta change in JSON format |
| `parseDeltaResponse(text)` | `(string) => WandlightDelta \| null` | Extracts JSON from markdown code fences, parses, validates structure, returns delta or null |
| `validateDelta(delta)` | `(WandlightDelta) => boolean` | Validates delta has required fields, changes are well-formed, no unexpected keys |

### prompt-injector.js

| Function | Signature | Purpose |
|----------|-----------|---------|
| `installInterceptor()` | `() => void` | Registers `globalThis.wandlightContinuityInterceptor`. Checks settings.enabled and settings.injectMemo. Finds last user message in chat array. Builds memo from state. Prepends memo to message content. |
| `wandlightContinuityInterceptor(chat, contextSize, abort, type)` | `(any[], number, any, string) => Promise<void>` | The interceptor function itself. Called by ST on each generation. |

### ui.js

| Function | Signature | Purpose |
|----------|-----------|---------|
| `renderSettingsUI()` | `() => void` | Reads settings and state, renders the `#wandlight_continuity_settings` template, binds event handlers |
| `bindSettingsHandlers()` | `() => void` | Attaches change/click handlers to settings inputs, textareas, and buttons |
| `refreshMemoPreview()` | `() => void` | Rebuilds the memo preview in the settings panel |
| `refreshDeltaPreview()` | `() => void` | Updates the delta preview in the settings panel |

### index.js

| Function | Signature | Purpose |
|----------|-----------|---------|
| `loadSettings()` | `() => void` | Reads settings from `extensionSettings`, applies defaults, saves if missing |
| `onGenerationEnded()` | `() => Promise<void>` | Handles `GENERATION_ENDED` event. Calls `runExtraction()` if `autoExtract` is enabled and interval matches. Applies delta if `autoApplyDelta`. |
| `onChatChanged()` | `() => void` | Handles `CHAT_CHANGED` event. Re-renders settings UI with current chat state. |
| `registerEvents()` | `() => void` | Subscribes to ST event bus for `GENERATION_ENDED` and `CHAT_CHANGED` |

[Classes]
No classes. The extension uses plain functions and objects. SillyTavern extensions follow a procedural pattern.

[Dependencies]
No external npm packages or build steps. The extension uses only SillyTavern built-in APIs and vanilla JavaScript.

### SillyTavern API Dependencies

| API | Usage | Availability |
|-----|-------|--------------|
| `SillyTavern.getContext()` | Access `chat`, `chatMetadata`, `extensionSettings`, `name1`, `name2`, `eventSource`, `saveSettingsDebounced`, `saveMetadata`, `generateQuietPrompt`, `generateRaw`, `registerFunctionTool`, `unregisterFunctionTool` | ST 1.12+ |
| `SillyTavern.getContext().chat` | Read messages for extraction, find last user message for injection | Always |
| `SillyTavern.getContext().chatMetadata` | Read/write per-chat continuity state | ST 1.12+ |
| `SillyTavern.getContext().extensionSettings` | Read/write global extension settings | Always |
| `SillyTavern.getContext().saveSettingsDebounced()` | Persist extension settings | Always |
| `SillyTavern.getContext().saveMetadata()` | Persist chat metadata (continuity state) | Always |
| `SillyTavern.getContext().generateQuietPrompt()` | Run extraction LLM pass silently | ST 1.11+ (fallback: `generateRaw`) |
| `SillyTavern.getContext().generateRaw()` | Fallback for extraction LLM pass | Always |
| `SillyTavern.getContext().eventSource` | Subscribe to `GENERATION_ENDED`, `CHAT_CHANGED` events | Always |
| `SillyTavern.getContext().t` | Translation function (optional, use raw strings as fallback) | Varies |
| `manifest.json` `generate_interceptor` hook | Inject state memo into prompts | ST 1.12+ |

[Testing]
Manual testing via a checklist. No automated test framework for MVP since SillyTavern extensions run in the ST browser environment and don't have a standard test harness.

### Manual Test Checklist

#### Setup
- [ ] Copy/symlink `WandlightContinuity/` into `SillyTavern/public/scripts/extensions/third-party/WandlightContinuity/`
- [ ] Restart SillyTavern
- [ ] Verify extension appears in Extensions panel
- [ ] Verify settings panel renders with all toggles, inputs, and buttons

#### Settings Persistence
- [ ] Toggle "Enabled" off, reload ST, verify it stays off
- [ ] Change "Max Snapshots" to 10, reload ST, verify it stays 10
- [ ] Toggle all settings, reload ST, verify all persist

#### State Management
- [ ] Click "Reset Chat State" — verify state resets to defaults
- [ ] Edit state JSON textarea, click away — verify state updates and memo preview refreshes
- [ ] Click "Export State JSON" — verify valid JSON is copied
- [ ] Click "Import State JSON" with valid JSON — verify state updates
- [ ] Click "Import State JSON" with invalid JSON — verify error toast, state unchanged

#### Memo Injection
- [ ] Enable "Enabled" and "Inject Memo"
- [ ] Set scene state: location="Gryffindor Common Room", presentCharacters=["Harry", "Hermione"]
- [ ] Send a chat message
- [ ] Verify the outgoing prompt contains `[WANDLIGHT CONTINUITY STATE]` block with correct values
- [ ] Disable "Inject Memo" — verify next message does NOT contain the block

#### State Extraction
- [ ] Enable "Enabled", "Auto Extract", "Auto Apply Delta"
- [ ] Have a roleplay scene with a clear change (character leaves, time advances)
- [ ] After assistant response, verify `lastDelta` in settings panel shows the extracted change
- [ ] Verify state object is updated with the change
- [ ] Verify memo preview reflects the change
- [ ] Disable "Auto Apply Delta" — after extraction, verify delta is shown but NOT applied
- [ ] Click "Apply Last Delta" — verify state updates
- [ ] Click "Reject Last Delta" — verify delta clears, state unchanged
- [ ] Click "Run Extraction Now" — verify extraction runs on demand
- [ ] Click "Undo Last State Change" — verify state reverts

#### Edge Cases
- [ ] Empty chat: extraction should not error
- [ ] Malformed state JSON from user edit: should show error, not corrupt state
- [ ] Very long scene with many characters: memo should not exceed reasonable length
- [ ] Rapid generation (swipe, regen): extraction guard should prevent duplicate runs
- [ ] Switching between chats: each chat should have independent state
- [ ] Chat with no `chatMetadata`: extension should create default state gracefully

### Validation Strategy
- All state mutations log with `[Wandlight Continuity]` prefix when `debugMode` is enabled
- Failed extractions log the raw LLM response for debugging
- Invalid JSON imports show a toast error and reject the import
- State migration runs on every `getState()` call, ensuring old chat files work with new schema versions

[Implementation Order]
Files are created and developed in dependency order to ensure each step can be tested incrementally.

1. **`WandlightContinuity/constants.js`** — Module key, default state object, default settings, extraction prompt template, logging prefix. No dependencies.

2. **`WandlightContinuity/manifest.json`** — Extension manifest declaring key, entrypoint, hooks, settings template path. Depends on constants (for key name consistency).

3. **`WandlightContinuity/state-manager.js`** — State CRUD operations, settings I/O, state migration. Depends on constants (for defaults, module key). Testable independently by calling functions with mock context.

4. **`WandlightContinuity/memo-builder.js`** — Memo construction from state object. Depends on constants (for state schema reference). Testable with static state objects.

5. **`WandlightContinuity/prompt-injector.js`** — Interceptor registration and injection logic. Depends on state-manager (to read state), constants (for key). Testable by generating with injectMemo enabled.

6. **`WandlightContinuity/index.js`** — Event wiring, entrypoint. Depends on state-manager, prompt-injector, memo-builder. This is the integration point. Testable by loading the extension in ST.

7. **`WandlightContinuity/settings.html`** — HTML template for settings panel. No JS dependencies (dumb template). Testable by loading the extension and viewing the settings panel.

8. **`WandlightContinuity/style.css`** — Minimal styling. No dependencies. Testable visually.

9. **`WandlightContinuity/ui.js`** — Settings panel rendering and button handlers. Depends on state-manager, memo-builder, extractor, settings.html. Testable by interacting with the settings panel.

10. **`WandlightContinuity/extractor.js`** — LLM extraction pass. Depends on state-manager, constants. Most complex component — requires active API connection to test. Built last because it depends on state and UI being functional.