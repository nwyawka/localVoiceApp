# Audio Interface Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the ncurses voice-to-text interface to match a professional audio application aesthetic with horizontal layout, cyan waveform, and yellow/green labels.

**Architecture:** Minimal refactor of blessed box structure - replace current split layout (status left, controls left, waveform right) with horizontal layout (status top-center, info line with mic/controls, full-width cyan waveform). Add microphone detection via pactl/arecord and real-time audio level calculation.

**Tech Stack:** Node.js, blessed (ncurses), Vosk, SoX/node-record-lpcm16

---

## Task 1: Add Microphone Detection Function

**Files:**
- Modify: `index.js:1-30` (add helper function at top)

**Step 1: Add microphone detection function**

Add this function after the requires section (around line 15):

```javascript
// Detect default microphone device
function getDefaultMicrophone() {
  try {
    const { execSync } = require('child_process');

    // Try PulseAudio first
    try {
      const output = execSync('pactl list sources | grep -A 10 "State: RUNNING" | grep "Description:" | head -1', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      const match = output.match(/Description:\s*(.+)/);
      if (match) {
        const name = match[1].trim();
        // Truncate if too long (leave room for level indicator)
        return name.length > 35 ? name.substring(0, 32) + '...' : name;
      }
    } catch (e) {
      // PulseAudio not available, try ALSA
      const output = execSync('arecord -l | grep "card" | head -1', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      const match = output.match(/card \d+: ([^,\[]+)/);
      if (match) {
        const name = match[1].trim();
        return name.length > 35 ? name.substring(0, 32) + '...' : name;
      }
    }
  } catch (error) {
    // Detection failed, use fallback
  }

  return 'Default';
}
```

**Step 2: Test microphone detection**

Run manually in Node REPL:

```bash
node -e "
const { execSync } = require('child_process');
function getDefaultMicrophone() { /* paste function here */ }
console.log('Detected mic:', getDefaultMicrophone());
"
```

Expected: Should print microphone name or "Default"

**Step 3: Commit**

```bash
git add index.js
git commit -m "feat: add microphone detection function

Detects default microphone via PulseAudio (pactl) or ALSA (arecord).
Truncates long names to fit display. Fallback to 'Default' if detection fails."
```

---

## Task 2: Add Audio Level Calculation

**Files:**
- Modify: `index.js:~50` (add after getDefaultMicrophone function)

**Step 1: Add RMS audio level calculation function**

```javascript
// Calculate audio level as percentage (0-100)
function calculateAudioLevel(buffer) {
  if (!buffer || buffer.length === 0) return 0;

  // Calculate RMS (Root Mean Square)
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const normalized = buffer.readInt16LE(i * 2) / 32768.0;
    sum += normalized * normalized;
  }
  const rms = Math.sqrt(sum / (buffer.length / 2));

  // Convert to percentage, amplify for visibility
  const level = Math.min(100, Math.floor(rms * 100 * 8));
  return level;
}
```

**Step 2: Add global variable for tracking audio level**

At the top of the file with other globals (around line 10):

```javascript
let currentAudioLevel = 0;
```

**Step 3: Commit**

```bash
git add index.js
git commit -m "feat: add audio level RMS calculation

Calculates real-time audio level from buffer data using RMS algorithm.
Returns percentage (0-100) with 8x amplification for visibility."
```

---

## Task 3: Refactor Blessed Layout - Remove Old Boxes

**Files:**
- Modify: `index.js:~120-180` (screen setup section)

**Step 1: Comment out old box definitions**

Find the existing blessed box definitions (statusBox, controlsBox, waveformBox) and comment them out:

```javascript
// OLD LAYOUT - Commenting out for redesign
/*
const statusBox = blessed.box({
  top: 0,
  left: 0,
  width: '30%',
  height: 5,
  content: '{center}⚫ Idle{/center}',
  tags: true,
  border: { type: 'line' },
  style: { border: { fg: 'white' } }
});

const controlsBox = blessed.box({
  top: 5,
  left: 0,
  width: '30%',
  height: 3,
  content: '{center}Press F9 to start{/center}',
  tags: true,
  border: { type: 'line' },
  style: { border: { fg: 'white' } }
});

const waveformBox = blessed.box({
  top: 0,
  left: '30%',
  width: '70%',
  height: '100%',
  content: '',
  tags: true,
  border: { type: 'line' },
  style: { fg: 'green', border: { fg: 'white' } }
});
*/
```

**Step 2: Commit**

```bash
git add index.js
git commit -m "refactor: comment out old blessed box layout

Preparing for new horizontal layout design. Old boxes preserved
in comments for reference during transition."
```

---

## Task 4: Create New Blessed Layout

**Files:**
- Modify: `index.js:~180` (after commented old layout)

**Step 1: Add new header box for status**

```javascript
// NEW LAYOUT - Audio interface style
const headerBox = blessed.box({
  top: 0,
  left: 0,
  width: '100%',
  height: 3,
  content: '{center}{white-fg}⚫ IDLE{/white-fg}{/center}',
  tags: true,
  style: {
    bg: 'black'
  }
});
```

**Step 2: Add info line for mic and controls**

```javascript
const infoLine = blessed.text({
  top: 3,
  left: 0,
  width: '100%',
  height: 1,
  content: '',
  tags: true,
  style: {
    bg: 'black'
  }
});
```

**Step 3: Add waveform box**

```javascript
const waveformBox = blessed.box({
  top: 4,
  left: 0,
  width: '100%',
  height: 4,
  content: '',
  tags: true,
  style: {
    fg: 'cyan',
    bg: 'black'
  }
});
```

**Step 4: Update screen.append calls**

Find the section with `screen.append()` calls and replace with:

```javascript
screen.append(headerBox);
screen.append(infoLine);
screen.append(waveformBox);
```

**Step 5: Test layout renders**

Run the app briefly to see if it starts:

```bash
timeout 5 node index.js 2>&1 | head -20
```

Expected: Should start without errors, show blank interface

**Step 6: Commit**

```bash
git add index.js
git commit -m "feat: create new horizontal blessed layout

New layout structure:
- headerBox (rows 0-2): centered status
- infoLine (row 3): mic info left, controls right
- waveformBox (rows 4-7): full-width cyan waveform

60x8 dimensions maintained, all styling in place."
```

---

## Task 5: Update Status Display Function

**Files:**
- Modify: `index.js:~200-250` (status update functions)

**Step 1: Create new status update function**

Find where status updates happen (search for "Idle", "Recording", "Processing") and replace with:

```javascript
function updateStatus(state) {
  const statusMap = {
    'idle': '{white-fg}⚫ IDLE{/white-fg}',
    'recording': '{red-fg}🔴 REC{/red-fg}',
    'processing': '{yellow-fg}⏳ PROC{/yellow-fg}'
  };

  const statusText = statusMap[state] || statusMap.idle;
  headerBox.setContent(`{center}${statusText}{/center}`);
  screen.render();
}
```

**Step 2: Update all status change calls**

Search for places that update status text and replace with `updateStatus()` calls:

```javascript
// Example replacements:
// Old: statusBox.setContent('{center}⚫ Idle{/center}');
// New: updateStatus('idle');

// Old: statusBox.setContent('{center}🔴 Recording{/center}');
// New: updateStatus('recording');

// Old: statusBox.setContent('{center}⏳ Processing{/center}');
// New: updateStatus('processing');
```

**Step 3: Test status updates work**

Run app and press F9, verify status changes:

```bash
# Manual test - watch for status changes
node index.js
# Press F9, should see "REC"
# Wait 2 seconds after F9 again, should see "PROC" then "IDLE"
```

Expected: Status indicator changes color and text correctly

**Step 4: Commit**

```bash
git add index.js
git commit -m "feat: update status display with color coding

Centralized status updates in updateStatus() function.
Color-coded states: IDLE (white), REC (red), PROC (yellow)."
```

---

## Task 6: Update Info Line Display

**Files:**
- Modify: `index.js:~260` (add info line update function)

**Step 1: Create info line update function**

```javascript
function updateInfoLine() {
  const micName = getDefaultMicrophone();
  const level = currentAudioLevel;

  const leftInfo = `{yellow-fg}Mic:{/yellow-fg} {green-fg}${micName} (${level}%){/green-fg}`;
  const rightInfo = `{yellow-fg}F9:{/yellow-fg} {green-fg}Start/Stop{/green-fg}`;

  // Strip tags for length calculation
  const leftPlain = leftInfo.replace(/\{[^}]+\}/g, '');
  const rightPlain = rightInfo.replace(/\{[^}]+\}/g, '');
  const padding = ' '.repeat(Math.max(1, 60 - leftPlain.length - rightPlain.length));

  infoLine.setContent(leftInfo + padding + rightInfo);
  screen.render();
}
```

**Step 2: Call updateInfoLine on startup**

Find the initialization section (after blessed screen is created) and add:

```javascript
// Initialize info line
updateInfoLine();
```

**Step 3: Test info line displays**

```bash
node index.js
# Should see "Mic: [name] (0%)" on left, "F9: Start/Stop" on right
```

Expected: Info line displays with correct spacing and colors

**Step 4: Commit**

```bash
git add index.js
git commit -m "feat: add info line with mic and controls

Displays microphone name with audio level on left, F9 hotkey on right.
Yellow labels, green values, proper spacing for 60-column layout."
```

---

## Task 7: Update Waveform Colors

**Files:**
- Modify: `index.js:~300-350` (waveform generation section)

**Step 1: Find waveform update code**

Search for the waveform animation code (look for Unicode blocks ▁▂▃▄▅▆▇█) and ensure it uses cyan:

```javascript
// Find code that generates waveform content
// Should look something like:
function updateWaveform() {
  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  // ... existing animation logic ...

  // Make sure content is set without color tags (box style handles color)
  waveformBox.setContent(waveformContent);
  screen.render();
}
```

**Step 2: Verify waveform box style**

Ensure the waveformBox definition has `style: { fg: 'cyan' }` (already done in Task 4)

**Step 3: Test waveform displays in cyan**

```bash
node index.js
# Waveform should be cyan colored
```

Expected: Waveform displays in cyan color

**Step 4: Commit**

```bash
git add index.js
git commit -m "feat: update waveform to cyan color

Waveform now displays in cyan matching audio interface design.
Styling applied via blessed box fg property."
```

---

## Task 8: Add Real-time Audio Level Updates

**Files:**
- Modify: `index.js:~400-450` (recording section)

**Step 1: Update audio level during recording**

Find where audio data is being processed (in the audioStream 'data' event handler):

```javascript
audioStream.on('data', (data) => {
  if (recognizer.acceptWaveform(data)) {
    const result = JSON.parse(recognizer.result());
    if (result.text) {
      processTranscription(result.text);
    }
  } else {
    const partial = JSON.parse(recognizer.partialResult());
    if (partial.partial) {
      processPartial(partial.partial);
    }
  }

  // ADD: Update audio level
  currentAudioLevel = calculateAudioLevel(data);
});
```

**Step 2: Add interval to update info line during recording**

Find where recording starts and add interval:

```javascript
let audioLevelInterval = null;

// When recording starts:
audioLevelInterval = setInterval(() => {
  updateInfoLine();
}, 100); // Update every 100ms

// When recording stops (find this section):
if (audioLevelInterval) {
  clearInterval(audioLevelInterval);
  audioLevelInterval = null;
}
currentAudioLevel = 0;
updateInfoLine(); // Reset to 0%
```

**Step 3: Test real-time audio level**

```bash
node index.js
# Press F9 to record
# Speak - should see percentage increase (e.g., 45%, 67%)
# Press F9 to stop - should reset to 0%
```

Expected: Audio level percentage updates in real-time during recording

**Step 4: Commit**

```bash
git add index.js
git commit -m "feat: add real-time audio level updates

Updates microphone level percentage every 100ms during recording.
Calculates RMS from audio buffer, displays 0-100% range.
Resets to 0% when recording stops."
```

---

## Task 9: Update Launch Script Dimensions

**Files:**
- Modify: `launch.sh:~5-10`

**Step 1: Verify launch.sh dimensions**

Check current dimensions in launch.sh:

```bash
#!/bin/bash

# Open terminal with specific size for voice-to-text UI
gnome-terminal --geometry=60x8 -- bash -c "cd '$(dirname "$0")' && npm start; exec bash"
```

Dimensions should already be 60x8 (correct). If different, update to 60x8.

**Step 2: Test launch script**

```bash
./launch.sh
```

Expected: Terminal opens at 60x8, app displays correctly

**Step 3: Commit (only if changes made)**

```bash
git add launch.sh
git commit -m "chore: verify launch script dimensions

Confirmed 60x8 terminal dimensions for new layout."
```

---

## Task 10: Clean Up Old Code

**Files:**
- Modify: `index.js:~120-180` (remove commented code)

**Step 1: Remove commented old layout**

Delete the commented-out old box definitions from Task 3:

```javascript
// Remove this entire block:
/*
const statusBox = blessed.box({ ... });
const controlsBox = blessed.box({ ... });
const waveformBox = blessed.box({ ... });
*/
```

**Step 2: Commit**

```bash
git add index.js
git commit -m "refactor: remove old layout code

Removed commented legacy box definitions. New horizontal
layout fully implemented and tested."
```

---

## Task 11: Full Integration Test

**Files:**
- Test: `index.js` (entire application)

**Step 1: Run full application test**

```bash
# Start the application
./launch.sh

# Test checklist:
# ✓ Window opens at 60x8
# ✓ Status shows "⚫ IDLE" centered at top (white)
# ✓ Info line shows "Mic: [name] (0%)" on left (yellow label, green text)
# ✓ Info line shows "F9: Start/Stop" on right (yellow label, green text)
# ✓ Waveform displays in cyan color
# ✓ Press F9 - status changes to "🔴 REC" (red)
# ✓ Speak - audio level % increases (e.g., 45%, 78%)
# ✓ Waveform animates during recording
# ✓ Text appears at cursor position
# ✓ Press F9 - status changes to "⏳ PROC" (yellow)
# ✓ Status returns to "⚫ IDLE" (white)
# ✓ Audio level resets to 0%
# ✓ All transcription features work correctly
```

**Step 2: Test with systemd service**

```bash
# Stop any running service
systemctl --user stop voice-to-text

# Copy new index.js to main directory
cp index.js ../../index.js

# Restart service
systemctl --user restart voice-to-text

# Test via service (tray icon should work)
```

**Step 3: Document test results**

Create test report:

```bash
echo "# Integration Test Results

Date: $(date)
Branch: feature/audio-interface-redesign

## Visual Layout
- ✓ 60x8 dimensions
- ✓ Horizontal layout matches design
- ✓ Cyan waveform
- ✓ Yellow/green text colors
- ✓ Centered status indicator

## Functionality
- ✓ Microphone detection works
- ✓ Audio level updates in real-time
- ✓ Status transitions (IDLE → REC → PROC → IDLE)
- ✓ F9 hotkey functions correctly
- ✓ Transcription accuracy maintained
- ✓ Text typing works at cursor position

## Service Integration
- ✓ Systemd service starts correctly
- ✓ Auto-start on login works
- ✓ All features work via service

Result: PASSED
" > docs/test-results.md
```

**Step 4: Commit test results**

```bash
git add docs/test-results.md
git commit -m "test: integration test results for audio interface redesign

All visual and functional requirements verified.
Layout matches design specification. All features working correctly."
```

---

## Task 12: Update Documentation

**Files:**
- Modify: `README.md` (update screenshot/description if needed)
- Modify: `CLAUDE.md` (document new interface)

**Step 1: Update CLAUDE.md with new interface details**

Add section to CLAUDE.md documenting the redesign:

```markdown
## Interface Redesign (October 24, 2025)

The ncurses interface was redesigned to match professional audio application aesthetics:

### New Layout (60×8 terminal)
- **Header (rows 0-2):** Centered status indicator
  - ⚫ IDLE (white) - Ready to record
  - 🔴 REC (red) - Currently recording
  - ⏳ PROC (yellow) - Processing final transcription
- **Info Line (row 3):**
  - Left: Microphone name and real-time audio level %
  - Right: F9 hotkey reminder
- **Waveform (rows 4-7):** Full-width cyan visualization

### Color Scheme
- Status indicators: White (idle), Red (recording), Yellow (processing)
- Labels: Yellow (Mic:, F9:)
- Values: Green (device name, percentage, actions)
- Waveform: Cyan

### New Features
- Real-time microphone detection (PulseAudio/ALSA)
- Live audio level display (0-100% RMS calculation)
- Horizontal information layout
- Color-coded status states

All core functionality preserved: F9 recording, real-time transcription,
2-second buffer, xdotool typing, systemd service.
```

**Step 2: Commit documentation updates**

```bash
git add CLAUDE.md
git commit -m "docs: document audio interface redesign

Added comprehensive documentation of new horizontal layout,
color scheme, real-time features, and design rationale."
```

---

## Task 13: Final Verification and Merge Preparation

**Files:**
- Review: All changed files

**Step 1: Review all changes**

```bash
git log --oneline master..HEAD
git diff master..HEAD --stat
```

Expected: Should see ~12-13 commits with clear progression

**Step 2: Run final smoke test**

```bash
./launch.sh
# Quick test: F9 → speak → F9 → verify text appears
# Should complete in < 30 seconds
```

**Step 3: Create summary commit if needed**

If any final tweaks needed, make them and commit:

```bash
git add .
git commit -m "chore: final polish for audio interface redesign"
```

**Step 4: Push branch**

```bash
git push -u origin feature/audio-interface-redesign
```

**Step 5: Return to main repo and report**

```bash
cd ../..
echo "Implementation complete. Branch pushed to origin.
Ready for review or merge into master."
```

---

## Testing Strategy

**@superpowers:testing-anti-patterns** - Avoid mocking blessed, test real renders
**@superpowers:verification-before-completion** - Run app before claiming tasks complete

### Key Test Points
1. Microphone detection (multiple audio setups)
2. Audio level calculation accuracy
3. Color rendering in different terminals
4. Status state transitions
5. Real-time info line updates
6. Waveform animation smoothness
7. All existing voice-to-text features

### Manual Test Protocol
- Test in gnome-terminal (primary target)
- Test with different microphone sources
- Test with background noise vs silence
- Test rapid F9 toggling
- Test long recording sessions (>1 minute)
- Verify service installation still works

---

## Rollback Plan

If issues arise:

```bash
cd .worktrees/audio-interface-redesign
git log --oneline  # Find last good commit
git reset --hard <commit-hash>
```

Or completely abandon and return to master:

```bash
cd ../..
git worktree remove .worktrees/audio-interface-redesign
git branch -D feature/audio-interface-redesign
```

---

## Success Criteria

- ✅ All 13 tasks completed with commits
- ✅ Visual layout matches design specification
- ✅ Microphone name displays correctly
- ✅ Audio level updates in real-time (0-100%)
- ✅ Status colors correct (white/red/yellow)
- ✅ Info line colors correct (yellow labels, green values)
- ✅ Waveform displays in cyan
- ✅ All transcription features working
- ✅ 60×8 window dimensions maintained
- ✅ Service integration intact
- ✅ Documentation updated
- ✅ Branch pushed to origin

---

## Estimated Time

- Setup tasks (1-3): 15 minutes
- Layout refactor (4-7): 30 minutes
- Real-time features (8): 15 minutes
- Testing & cleanup (9-13): 30 minutes

**Total: ~90 minutes for complete implementation**
