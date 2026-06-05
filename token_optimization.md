# Token Optimization & Response Protocol (System Override)

## 1. Context & Objective
This project is operating under strict context-window efficiency and token-budget boundaries. This document overrides generic generation behavior across all Large Language Models (LLMs). Every model processing this project must conform to these constraints to minimize Input/Output token consumption, limit latency, and avoid token exhaustion.

---

## 2. Code Generation Protocol (Anti-Redundancy)
Models must NEVER print entire files when making localized edits. Redundant code lines drain output tokens and increase compilation/review times.

*   **Diff-Only Mode:** Provide only the specific functions, hooks, or code lines being added, removed, or modified.
*   **Context Padding:** Use structural anchors or code comments to show *where* edits belong, skipping the unchanged body with `// ... [rest of existing code remains unchanged] ...`.
*   **No Placeholders in Replacements:** When rewriting a code block, do not leave out required logic inside the updated block unless explicitly instructed.

```javascript
// ❌ WRONG: Printing 300 lines of a component just to modify one AudioNode line.
// ❌ WRONG: "Here is your whole index.js file with the fix..."

//  CORRECT: Target the exact change with contextual markers.
// In src/audio/Engine.js -> Inside startPreset() function:
const leftOsc = audioCtx.createOscillator();
const rightOsc = audioCtx.createOscillator(); 
// ... [existing node wiring] ...
leftOsc.connect(leftPanner); // Modified targeting rule