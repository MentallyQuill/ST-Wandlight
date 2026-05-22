# Wandlight

Wandlight is a universal SillyTavern prompt preset for Harry Potter roleplay. It addresses the shortcoming of generic-setting presents with a direct and tailored approach. It ships with built-in togglable definitions for the Golden Trio — each with distinct voice, personality, and behavioural patterns enforced at prompt level.

### Dynamic Canon

Two rules govern all characters regardless of which identities are active:

- **Date Check**: Characters know only what they could realistically know by the date in the timestamp. No hindsight, no offscreen knowledge.
- **Context Override**: If the chat history contradicts canon, the chat history is the operative truth.

---

## World Fidelity

### Fog of Hogwarts - Characters act only on information they could realistically possess.

### Quill and Parchment Standard - Reduced Slop

### Fresh Ink Only - Anti-Repeating

### Unpredictable Chapters - Matches writing structure to scene energy.

### Committed Action - Less deciding to act, more acting.

---

## Character Driver

The behavioural engine that prevents characters from becoming passive surfaces.

- **Agency**: Characters are Drivers, not Passengers. Circling conversations are broken by initiative.
- **Priority Override**: Characters redirect when conversation drifts past relevance.
- **Emotional Inertia**: Growth is gradual.
- **Temporal Anchoring**: Real-time pacing. No fast travel. Walk the corridors. Let the journey accumulate.
- **Vocabulary Guard**: Classic British Fantasy register that curbs models' technical and tactical language.

---

## Timestamp

Every response opens with date, time, location, and weather:

> *Sunday, Jan 26, 1997 | Time: 6:46 AM | Girl's Dormitory | Overcast - Light Snow*

This not only grounds the scene, but is useful for tracking pacing and key moments.

---

## Injection Architecture

| Depth | Position | Content |
|-------|----------|---------|
| 4 | 0 (system) | Main System, World Info, Description, Personality, Scenario, Chat History, Examples |
| 3 | 0 (system) | World Fidelity, Human Truths |
| 1 | 1 (system/user) | Timestamp, Character Identities, Formatting, Character Driver |

Depth 4 establishes the world. Depth 3 enforces the rules. Depth 1 ensures character identity and behaviour are the last things the model processes.

---

## Installation

1. Download `Wandlight-1.0.json` from the `Presets` folder.
2. In SillyTavern, open Settings > Presets. Click Import and select the file.
3. Enable the prompt blocks you need. At minimum: Main System, Character Identities (or your replacement), World Fidelity, Human Truths, Character Driver, Formatting, and Timestamp.

Character Identities can be toggled off. Replace them with your own persona via character card or World Info. The writing rules apply regardless.

---

## From Hermione to Wandlight

This preset began as Hermione 1.0 — a single-character prompt for writing Hermione Granger. It grew through twenty-one iterations, most of which were prompted by reading output that was wrong in some specific, nameable way and writing a rule to fix it.

Wandlight 1.0 is the universal version: character definitions expanded to include Harry and Ron, writing rules made character-agnostic, timestamp system extracted, injection architecture reorganised. The principles haven't changed. Bad prose is still bad prose. Hovering is still hovering. And "a breath she didn't know she was holding" remains prohibited.