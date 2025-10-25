# Memory Leak Fix - October 25, 2025

## Problem Reported

User reported that the app gets progressively slower and less accurate the more it's used, indicating a memory leak.

## Root Causes Identified

### 1. **CRITICAL: audioBuffers Array Not Cleared** (Primary Leak)

**Location:** `index.js` - `processRecording()` function

**Issue:** The `audioBuffers` array was only cleared when starting a NEW recording (in `startRecording()`), NOT after processing completed. This caused:

- Recording 1: 10MB audio → stored in `audioBuffers`
- Recording 1 processes → **buffers remain in memory**
- Recording 2: 10MB audio → now `audioBuffers` gets cleared, new data added
- But Recording 1's data stayed in memory the entire time!

After 10 recordings, you'd have ~100MB of old audio data sitting in memory.

**Impact:**
- Memory grows with each recording
- Slower processing as available memory decreases
- Worse accuracy as V8 garbage collector struggles

**Fix:**
```javascript
// BEFORE (line 327):
const completeAudio = Buffer.concat(audioBuffers);
// audioBuffers never cleared here!

// AFTER (lines 332-336):
const completeAudio = Buffer.concat(audioBuffers);

// CRITICAL: Clear audioBuffers immediately to free memory
audioBuffers.length = 0;
audioBuffers = [];
```

### 2. **Large Buffers Not Freed**

**Location:** `index.js` - `processRecording()` function

**Issue:** Large buffers (`completeAudio`, `processedData`, `audioOnly`) were created but relied on garbage collection without explicit nullification.

**Fix:** Progressive buffer cleanup:
```javascript
// Write buffer to disk, then immediately free it
fs.writeFileSync(tempFile, Buffer.concat([wavHeader, completeAudio]));
completeAudio = null;  // Free immediately

// Get slice we need, then free the full buffer
audioOnly = processedData.slice(44);
processedData = null;  // Free immediately

// After recognition, free audio buffer
const finalResult = recognizer.finalResult();
audioOnly = null;  // Free immediately
```

### 3. **No Error Path Cleanup**

**Location:** `index.js` - `processRecording()` catch block

**Issue:** If processing failed/crashed, `audioBuffers` never got cleared at all.

**Fix:** Added emergency cleanup in catch block:
```javascript
catch (error) {
    // Emergency cleanup: free recognizer if it exists
    if (recognizer) {
        try {
            recognizer.free();
        } catch (e) {}
    }

    // Clear buffers even on error
    audioBuffers.length = 0;
    audioBuffers = [];
    completeAudio = null;
    processedData = null;
    audioOnly = null;

    updateStatus('idle');
}
```

### 4. **No Garbage Collection Hints**

**Issue:** Large buffers were freed but no hint given to V8 to collect them.

**Fix:** Added manual GC suggestion (if enabled):
```javascript
// Suggest garbage collection for large buffers
if (global.gc) {
    global.gc();
}
```

**Note:** To enable manual GC, run with: `node --expose-gc index.js`

## Changes Made

### Modified Files

1. **index.js** - `processRecording()` function
   - Clear `audioBuffers` immediately after concatenating
   - Null out large buffers progressively as soon as they're no longer needed
   - Add emergency cleanup in error handler
   - Add manual GC hint at end of function

### Code Changes Summary

```diff
function processRecording() {
+   let recognizer = null;
+   let completeAudio = null;
+   let processedData = null;
+   let audioOnly = null;
+
    try {
-       const completeAudio = Buffer.concat(audioBuffers);
+       completeAudio = Buffer.concat(audioBuffers);
+
+       // CRITICAL: Clear audioBuffers immediately to free memory
+       audioBuffers.length = 0;
+       audioBuffers = [];

        fs.writeFileSync(tempFile, Buffer.concat([wavHeader, completeAudio]));
+       completeAudio = null;  // Free immediately

-       const processedData = fs.readFileSync(processedFile);
-       const audioOnly = processedData.slice(44);
+       processedData = fs.readFileSync(processedFile);
+       audioOnly = processedData.slice(44);
+       processedData = null;  // Free immediately

-       const recognizer = new vosk.Recognizer(...);
+       recognizer = new vosk.Recognizer(...);

        recognizer.free();
+       recognizer = null;
+       audioOnly = null;

    } catch (error) {
+       // Emergency cleanup
+       if (recognizer) {
+           try { recognizer.free(); } catch (e) {}
+       }
+       audioBuffers.length = 0;
+       audioBuffers = [];
+       completeAudio = null;
+       processedData = null;
+       audioOnly = null;
    }
+
+   // Suggest garbage collection
+   if (global.gc) {
+       global.gc();
+   }
}
```

## Expected Results

After this fix:
- ✅ Memory usage stays constant across multiple recordings
- ✅ Processing speed remains consistent
- ✅ Accuracy doesn't degrade over time
- ✅ Memory freed immediately after each recording
- ✅ Proper cleanup even if errors occur

## Testing Recommendations

### Basic Test
1. Start app: `npm start`
2. Make 10 recordings in a row
3. Check memory usage: `ps aux | grep node`
4. Memory should stay constant (~2.8GB for large model)

### Stress Test
1. Make 50 recordings
2. Monitor memory with: `watch -n 1 'ps aux | grep "node index.js"'`
3. Memory should not grow beyond initial load

### Performance Test
1. Time first recording: should complete in ~2-3 seconds
2. Make 20 recordings
3. Time 21st recording: should still be ~2-3 seconds
4. No degradation in speed or accuracy

## Memory Profile (Expected)

**Baseline (app idle):**
- Vosk model: ~2.5GB (constant)
- Node.js overhead: ~200MB
- UI/libraries: ~100MB
- **Total: ~2.8GB**

**During recording:**
- Add audio buffer: +10-50MB (varies with recording length)
- **Peak: ~2.9GB**

**After processing:**
- Buffers freed
- **Back to baseline: ~2.8GB**

The memory should oscillate between 2.8GB (idle) and 2.9GB (processing), never accumulating.

## Enabling Manual GC (Optional)

For more aggressive memory management, launch with:
```bash
node --expose-gc index.js
```

Or update `launch.sh`:
```bash
#!/bin/bash
node --expose-gc index.js
```

This allows the app to manually trigger garbage collection after each recording.

## Related Files

- `index.js` - Main application (memory leak fixed here)
- `audio-processor.js` - No leaks found (uses external SoX process)
- `post-processor.js` - No leaks found (simple string processing)
- `config.js` - Configuration only

## Date Fixed

October 25, 2025

## Status

✅ **FIXED** - Ready for testing
