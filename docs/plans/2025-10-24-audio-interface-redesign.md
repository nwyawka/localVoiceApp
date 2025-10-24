# Audio Interface Redesign

**Date:** October 24, 2025
**Status:** Approved for Implementation
**Approach:** Minimal Box Refactor

## Overview

Redesign the voice-to-text ncurses interface to match a professional audio application aesthetic, featuring a clean horizontal layout with cyan waveform visualization and yellow/green informational text.

## Requirements

### Visual Design
- Maintain 60×8 terminal window dimensions
- Implement horizontal information layout (left: mic info, center: waveform, right: controls)
- Use cyan waveform with yellow/green text labels
- Clean, minimal border aesthetic matching reference audio interface

### Information Display
- **Left Side:** Microphone source name and audio level percentage
- **Top Center:** Recording status (IDLE/REC/PROC) with appropriate indicators
- **Right Side:** Hotkey reminder (F9: Start/Stop)
- **Center:** Full-width waveform visualization

### Functional Requirements
- Preserve all existing voice-to-text functionality
- Real-time waveform updates (50ms refresh)
- Dynamic microphone level detection
- Smooth status transitions

## Design Approach: Minimal Box Refactor

**Rationale:** Quick implementation with minimal code changes while achieving the desired aesthetic. Keeps the existing blessed structure and vosk integration intact.

**Trade-offs:**
- ✅ Fast implementation
- ✅ Low risk to existing functionality
- ✅ Easy to test and validate
- ⚠️ May not be pixel-perfect match to reference
- ⚠️ Some blessed box structure remains

## Layout Structure

### Window Breakdown (60 columns × 8 rows)

```
┌──────────────────────────────────────────────────────────┐
│                      ⚫ IDLE                              │ Row 0-2: Header
│                                                          │   (Status)
│                                                          │
├──────────────────────────────────────────────────────────┤
│ Mic: Default (85%)              F9: Start/Stop          │ Row 3: Info Line
├──────────────────────────────────────────────────────────┤
│ ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂│ Row 4-7:
│ ▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁│   Waveform
│ ▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂│   (Cyan)
│ ▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃│
└──────────────────────────────────────────────────────────┘
```

### Component Layout

**Header Section (Rows 0-2):**
- Single centered status indicator
- Minimal or no border
- Dynamic content based on state:
  - `⚫ IDLE` (white/gray)
  - `🔴 REC` (red)
  - `⏳ PROC` (yellow)

**Info Line (Row 3):**
- Left-aligned: `Mic: [Device Name] ([Level]%)`
  - Label in yellow, values in green
  - Example: `Mic: Default (85%)`
- Right-aligned: `F9: Start/Stop`
  - Label in yellow, action in green

**Waveform Section (Rows 4-7):**
- Full-width visualization
- Cyan Unicode blocks: ▁▂▃▄▅▆▇█
- 50ms animation updates
- Same algorithm as current implementation

## Color Scheme

| Element | Color | Blessed Tag |
|---------|-------|-------------|
| Status IDLE | White/Gray | `{white-fg}` |
| Status REC | Red | `{red-fg}` |
| Status PROC | Yellow | `{yellow-fg}` |
| Info Labels | Yellow | `{yellow-fg}` |
| Info Values | Green | `{green-fg}` |
| Waveform | Cyan | `{cyan-fg}` |
| Background | Default | (terminal default) |

## Technical Implementation

### Code Structure Changes

**Remove:**
- Current `statusBox` (left side)
- Current `controlsBox` (left side)

**Add:**
- `headerBox` - Centered status (rows 0-2)
- `infoLine` - Text element for left/right info (row 3)
- `waveformBox` - Full-width waveform (rows 4-7)

### Microphone Detection

**Method:** Use PulseAudio/ALSA commands to detect default input device

```bash
pactl list sources | grep -A 10 "State: RUNNING" | grep "Description:"
# or
arecord -l | grep "card"
```

**Parsing:**
- Extract device name (e.g., "Built-in Audio Analog Stereo")
- Truncate if too long for display width
- Fallback to "Default" if detection fails

### Audio Level Calculation

**During recording:**
- Read audio buffer data
- Calculate RMS (Root Mean Square) amplitude
- Convert to percentage (0-100%)
- Update info line display every 100ms

**Formula:**
```javascript
const rms = Math.sqrt(buffer.reduce((sum, val) => sum + val * val, 0) / buffer.length);
const level = Math.min(100, Math.floor((rms / 32768) * 100));
```

### Layout Positioning

```javascript
const headerBox = blessed.box({
  top: 0,
  left: 'center',
  width: '100%',
  height: 3,
  content: '{center}⚫ IDLE{/center}',
  tags: true
});

const infoLine = blessed.text({
  top: 3,
  left: 0,
  width: '100%',
  height: 1,
  content: '{yellow-fg}Mic:{/yellow-fg} {green-fg}Default (0%){/green-fg}',
  tags: true
});

const waveformBox = blessed.box({
  top: 4,
  left: 0,
  width: '100%',
  height: 4,
  content: '',
  tags: true,
  style: {
    fg: 'cyan'
  }
});
```

### Real-time Updates

**Status updates:**
```javascript
function updateStatus(state) {
  const statusMap = {
    idle: '{white-fg}⚫ IDLE{/white-fg}',
    recording: '{red-fg}🔴 REC{/red-fg}',
    processing: '{yellow-fg}⏳ PROC{/yellow-fg}'
  };
  headerBox.setContent(`{center}${statusMap[state]}{/center}`);
  screen.render();
}
```

**Info line updates:**
```javascript
function updateInfoLine(micName, level) {
  const leftInfo = `{yellow-fg}Mic:{/yellow-fg} {green-fg}${micName} (${level}%){/green-fg}`;
  const rightInfo = `{yellow-fg}F9:{/yellow-fg} {green-fg}Start/Stop{/green-fg}`;
  const padding = ' '.repeat(60 - stripTags(leftInfo).length - stripTags(rightInfo).length);
  infoLine.setContent(leftInfo + padding + rightInfo);
  screen.render();
}
```

**Waveform updates:**
- Keep existing 50ms animation timer
- Same Unicode block generation algorithm
- Apply cyan color to entire waveform content

## Unchanged Components

**Core functionality preserved:**
- Vosk speech recognition engine
- Audio recording with SoX (node-record-lpcm16)
- F9 keyboard listener (node-global-key-listener)
- Text typing with xdotool
- 2-second recording buffer
- Word-by-word transcription
- Systemd service integration

## Testing Plan

1. **Visual validation:** Compare running app to reference image
2. **Microphone detection:** Verify correct device name appears
3. **Audio level display:** Confirm percentage updates during recording
4. **Status transitions:** Test IDLE → REC → PROC → IDLE flow
5. **Waveform animation:** Verify cyan color and smooth animation
6. **Recording functionality:** Ensure all voice-to-text features work
7. **Window dimensions:** Confirm 60×8 layout in terminal

## Success Criteria

- ✅ Interface matches reference image aesthetic
- ✅ Microphone name displays correctly
- ✅ Audio level shows real-time percentage
- ✅ Status indicator updates properly
- ✅ F9 controls visible and clear
- ✅ Waveform displays in cyan
- ✅ All voice-to-text functionality preserved
- ✅ No performance degradation
- ✅ 60×8 window size maintained

## Future Enhancements

- Display transcribed word count on info line
- Add confidence percentage indicator
- Support for custom color themes
- Configurable window dimensions
- Multiple microphone source selection

## References

- Original design: `CLAUDE.md` - ncurses terminal app section
- Blessed documentation: https://github.com/chjj/blessed
- Reference image: Provided audio interface screenshot
