# Wandlight

Wandlight is a universal SillyTavern prompt preset for Harry Potter roleplay. It addresses the shortcoming of generic-setting presents with a direct and tailored approach. It ships with built-in togglable definitions for the Golden Trio — each with distinct voice, personality, and behavioural patterns enforced at prompt level.

## Getting Started

Follow these steps to set up Wandlight and start writing your story.

### Step 1: Setup

#### 1a. Import the Wandlight Preset

1. Download `Presets/Wandlight-1.0.json` from this repository.
2. In SillyTavern, open the **Presets** panel (found in the AI Response Configuration area).
3. Click **Import** and select the downloaded `Wandlight-X.X.json` file.
4. Make sure Wandlight is selected as your active preset before continuing.

The Wandlight preset contains all the system-level instructions that tell the AI *how* to write — prose style, narrative perspective, character autonomy, formatting rules, and more. It's the engine that drives the entire experience.

#### 1b. Choose a Compatible Model

Wandlight is model-agnostic, but results vary significantly depending on which model you use. For the best experience, we recommend:

| Model | Quality | Notes |
|---|---|---|
| **Claude Opus 4.7** | ★★★★★ | Most tested. Excellent prose, strong character voicing, best adherence to the prompt's literary instructions. Expensive as hell. |
| **GLM-5.1** | ★★★★☆ | Great results. Handles narrative mode well and produces vivid prose. Very affordable. |
| **DeepSeek-4** | ★★★☆☆ | Good. Creative, with strong writing capabilities, but sometimes loses details or strays from the plot. Incredibly cheap. |

#### 1c. Create a "Story" Character Card

This is the most tested method:

1. In SillyTavern, create a **new character card**.
2. Name it something general like **"Story"** (or "Narrator", "Hogwarts", "The World", etc. — whatever fits your setting).
3. Leave the character's description, personality, and scenario fields **empty**.

### Step 2: Set Your Opening Scene

The first message of your Story card is important — it establishes the prose style, tone, pacing, and narrative voice that the AI will follow for the entire story.

#### Option A: Use a Opener from This Repository

The `Openers/` folder contains pre-written opening scenes crafted in the prose style Wandlight is designed to produce. These are ready to use:

1. Browse the [Openers](Openers/) folder for a Opener that appeals to you.
2. Copy the full text of the Opener.
3. In your Story character card, paste it into the **First Message** field.

#### Option B: Write Your Own Opener

You can also write your own opening, but the prose style matters enormously.

**Or use a leading litary model to write your opener.**

Prompt: *Create a SillyTavern story opener in the prose style of Harry Potter: It's late January of their 6th year, a cold winter morning. Hermione is quietly studying in the library. Set the scene with detail and Hermione's state of mind. (3rd person limited)*

> Do not write your opener in casual, chat-like, or roleplay-heavy prose unless that's the style you want the entire story written in.

### Step 3: Begin!

Once your preset is loaded and your first message is set, you're ready to write.

# Wandlight Features

### Dynamic Canon

- **Date Check**: Characters know only what they could know by the date in the timestamp.
- **Context Override**: If the chat history contradicts canon, the chat history is the operative truth.

---

#### Fog of Hogwarts 
Characters act only on information they could realistically possess.

#### Quill Standard
Reduced Slop.

#### Fresh Ink Only 
Anti-Repeating.

#### Dynamic Pacing
Matches writing structure to scene energy.

#### Character Driver
Less deciding to act, more acting.

---

### Timestamp

Every response opens with date, time, location, and weather:

> *Sunday, Jan 26, 1997 | Time: 6:46 AM | Girl's Dormitory | Overcast - Light Snow*

This not only grounds the scene, but is useful for tracking pacing and key moments.

---

Enjoy!