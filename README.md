<div align="center"><img src="Images/wandlight-banner.jpg" width="800"></div>

# Wandlight

A featherweight preset for SillyTavern HP roleplay & fanfiction.

## Getting Started

### 1. Import the Preset

Download `Presets/Wandlight-1.1.json` and import it via SillyTavern's **Presets** panel. Select Wandlight as your active preset.

> By default, Wandlight's reasoning effort is set to Low, for quick responses. If you're using a reasoning model, experiment with higher reasoning during more complex moments, or multi-character scenes.


### 2. Pick a Model

Wandlight is model-agnostic, though prose quality varies:

| Model | Quality | Notes |
|---|---|---|
| **Claude Opus 4.6/7** | ★★★★★ | Most tested. Best prose and character voicing. Expensive as Galleons. |
| **GLM-5.1** | ★★★★☆ | Vivid prose, handles narrative mode well. Very affordable. |
| **DeepSeek-4** | ★★★☆☆ | Creative but can stray. Incredibly cheap. |

### 3. Create a Story Card

Make a new character card — call it "Story," "Narrator," or "Hogwarts." Leave description, personality, and scenario **empty**.

> *Compatible with Character Cards, but designed for lightweight use without.*

### 4. Set Your Opening Scene

Pick an opener from `Openers/` and paste it into the card's **First Message** field, or write your own. If writing your own:

> *Create a SillyTavern story opener in the prose style of Harry Potter: [scene description] (3rd person limited)*

The opener's prose style sets the tone for everything that follows.

<div align="center"><img src="Images/divider.jpg" width="800"></div>

## Features

### Toggleable Modules

<div align="center"><img src="Images/toggle-modules.jpg" width="600"></div>

Enable or disable modules in SillyTavern's Prompt Manager. Only one Length module should be active at a time.

| Module | Default | What It Does |
|---|---|---|
| **Timestamp** | ON | Opens each response with date, time, location, and weather. |
| **Journey Integrity** | OFF | Real-time pacing. No fast-travelling through the castle. |
| **Realism Mode** | OFF | Social friction. Skepticism, self-interest, guardedness. Vulnerability costs something. |
| **Length: Flexible** | ON | Matches length to scene energy — quiet moments are brief, dramatic ones expand. |
| **Length: Short** | OFF | 3–5 paragraphs. |
| **Length: Medium** | OFF | 5–10 paragraphs. |
| **Length: Long** | OFF | 12+ paragraphs. Chapter-length. |
| **Golden Trio** | ON | Definitions for Harry, Ron, Hermione. |
| **Supporting Cast** | OFF | Definitions for Snape, Draco, Neville, Luna, Ginny, Fred & George, McGonagall, Lupin. |
| **Villains** | OFF | Definitions for Voldemort, Bellatrix, Umbridge, Lucius Malfoy, Pettigrew. |

### Prose Enforcement

All anti-slop rules — banned constructions, banned clichés, Fresh Ink Only, Voice Isolation, Repetition Kill — concentrated in a single post-history prompt at injection depth 0, where the model pays the most attention. Stronger adherence, no extra tokens.

### Variable-Based Formatting

Length modules set a `{{setvar}}` variable that the Formatting prompt reads via `{{getvar}}`. Changing length is a single toggle, not a prompt edit.

<div align="center"><img src="Images/divider.jpg" width="800"></div>

### Character Sets

Three toggleable identity modules. Enable what the scene calls for. Each character gets voice, physical tells, and behavioral patterns — the Trio in detail, everyone else in confident strokes.

<div align="center"><img src="Images/charset-trio.jpg" width="600"></div>

**Golden Trio** (ON by default) — Hermione, Harry, Ron. Canon core.

<div align="center"><img src="Images/charset-supporting.jpg" width="600"></div>

**Supporting Cast** (OFF) — Snape, Draco, Neville, Luna, Ginny, Fred & George, McGonagall, Lupin. Toggle on when they appear.

<div align="center"><img src="Images/charset-villains.jpg" width="600"></div>

**Villains** (OFF) — Voldemort, Bellatrix, Umbridge, Lucius Malfoy, Pettigrew. For when the story darkens.

<div align="center"><img src="Images/divider.jpg" width="800"></div>

### The Scrivener's Ward

<div align="center"><img src="Images/scriveners-antislop.jpg" width="600"></div>

A curated ~200-entry logit bias targeting universal AI slop, HP/fantasy clichés, and lazy magical descriptors, with gentle positive bias toward dialogue punctuation. Select **"Scrivener's Ward"** from the Logit Bias dropdown in AI Response Configuration.

### Dynamic Canon

<div align="center"><img src="Images/dynamic-canon.jpg" width="600"></div>

Characters know only what they could know by the date in the timestamp. When the chat history contradicts canon, the chat history is operative truth.

### Fog of Hogwarts

No omniscience. Gossip mutates. Misreadings are natural. If it happened off-page and wasn't communicated, it can't be referenced.

### Quill Standard

Bans hollow atmosphere, epanorthosis, unnamed feelings, sentient architecture, convenient pathetic fallacy, and the usual suspects. Something fills the silence — describe *that*.

### Fresh Ink Only

Every response begins with new content. No restating, paraphrasing, or summarizing the previous turn.

### Unpredictable Chapters

No defaulting to the expected outcome. If the reader can predict it, so can a good writer — take the other path more often than not.

### Committed Action

Characters decide and act. No hovering at decision points or narrating uncertainty through inaction. Once a character begins, they follow through to its natural consequence.

### Character Driver

Less deciding to act, more acting. Characters pursue their own goals in real time. The scene state must shift in every response.

---

Enjoy!