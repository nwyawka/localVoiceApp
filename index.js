const vosk = require('vosk');
const record = require('node-record-lpcm16');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { GlobalKeyboardListener } = require('node-global-key-listener');
const blessed = require('blessed');

// Global error handlers to catch all uncaught exceptions
process.on('uncaughtException', (err) => {
    const errorMsg = `\n=== UNCAUGHT EXCEPTION ===\nError: ${err.message}\nStack: ${err.stack}\n`;
    // Write to file since blessed fullscreen hides console output
    fs.appendFileSync('/tmp/voice-app-error.log', errorMsg);
    console.error(errorMsg);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    const errorMsg = `\n=== UNHANDLED REJECTION ===\nReason: ${reason}\nPromise: ${promise}\n`;
    // Write to file since blessed fullscreen hides console output
    fs.appendFileSync('/tmp/voice-app-error.log', errorMsg);
    console.error(errorMsg);
    process.exit(1);
});

// Path to the Vosk model (using large model for better accuracy)
const MODEL_PATH = path.join(__dirname, 'models', 'vosk-model-en-us-0.22');

// Global variable for tracking audio level
let currentAudioLevel = 0;
let cachedMicName = null; // Cache mic name during recording to avoid repeated shell calls

// Check if model exists
if (!fs.existsSync(MODEL_PATH)) {
    console.error('Model not found. Please download the Vosk model first.');
    process.exit(1);
}

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

// Calculate audio level as percentage (0-100)
function calculateAudioLevel(buffer) {
  if (!buffer || buffer.length === 0) return 0;

  // Calculate RMS (Root Mean Square)
  let sum = 0;
  // Loop through buffer in 2-byte increments (Int16 = 2 bytes)
  for (let i = 0; i < buffer.length; i += 2) {
    const normalized = buffer.readInt16LE(i) / 32768.0;
    sum += normalized * normalized;
  }
  const rms = Math.sqrt(sum / (buffer.length / 2));

  // Convert to percentage, amplify for visibility
  const level = Math.min(100, Math.floor(rms * 100 * 8));
  return level;
}

// Initialize Vosk model
console.log('Loading Vosk model...');
const model = new vosk.Model(MODEL_PATH);
console.log('Model loaded successfully!');

// Create blessed screen (full screen, but elements will be sized smaller)
const screen = blessed.screen({
    smartCSR: true,
    title: 'Voice-to-Text Monitor',
    fullUnicode: true
});

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

// Add elements to screen
screen.append(headerBox);
screen.append(infoLine);
screen.append(waveformBox);

// State management
let isRecording = false;
let recognizer = null;
let recorder = null;
let typedWords = []; // Queue of words that have been typed
let audioData = []; // Audio amplitude data for waveform
let lastPartialText = ''; // Track the last partial result to avoid duplicates
const maxDataPoints = 50; // Number of waveform points to display (adjusted for smaller window)
let audioLevelInterval = null; // Interval for updating audio level display

// Create keyboard listener
const keyboard = new GlobalKeyboardListener();

// Function to calculate audio amplitude for waveform
function calculateAmplitude(buffer) {
    let sum = 0;
    const view = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);

    for (let i = 0; i < view.length; i++) {
        sum += Math.abs(view[i]);
    }

    const average = sum / view.length;
    // Normalize to 0-1 range
    return average / 32768;
}

// Unicode block characters for waveform (from low to high)
const waveformChars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

// Function to update waveform display
function updateWaveform() {
    if (isRecording && audioData.length > 0) {
        // Convert amplitude data to block characters (8x multiplier for visibility)
        const waveform = audioData.map(amp => {
            const index = Math.min(Math.floor(amp * 8 * waveformChars.length), waveformChars.length - 1);
            return waveformChars[Math.max(0, index)];
        }).join('');

        waveformBox.setContent(`\n  ${waveform}`);
    } else {
        // Idle animation
        const time = Date.now() / 1000;
        const idleWave = Array(maxDataPoints).fill(0).map((_, i) => {
            const wave = Math.sin(i / 10 + time * 2) * 0.5 + 0.5;
            const index = Math.min(Math.floor(wave * 2), waveformChars.length - 1);
            return waveformChars[index];
        }).join('');

        waveformBox.setContent(`\n  ${idleWave}`);
    }
    screen.render();
}

// Update waveform animation (50ms for smoother updates)
setInterval(updateWaveform, 50);

// Function to update status indicator
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

// Function to update info line with mic and controls
function updateInfoLine() {
  const micName = cachedMicName || getDefaultMicrophone();
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

// Function to type text at cursor position
function typeTextAtCursor(text) {
    try {
        // Escape special characters for shell
        const escapedText = text.replace(/'/g, "'\\''");
        // Use xdotool to type the text
        execSync(`xdotool type --delay 12 '${escapedText}'`, { encoding: 'utf8' });
    } catch (err) {
        console.error('Error typing text:', err.message || err);
    }
}

// Function to type only new words (strict forward-only approach)
function typeNewWords(newText) {
    // Split the new text into words
    const newWords = newText.trim().split(/\s+/).filter(word => word.length > 0);

    // Get the count of words we've already typed
    const alreadyTypedCount = typedWords.length;

    // ONLY type words beyond what we've already typed - never go backwards
    if (newWords.length > alreadyTypedCount) {
        for (let i = alreadyTypedCount; i < newWords.length; i++) {
            const word = newWords[i];

            // Type the word followed by a space
            typeTextAtCursor(word + ' ');

            // Add to our queue of typed words
            typedWords.push(word);
        }
    }
}

// Function to start recording
function startRecording() {
    if (isRecording) {
        return;
    }

    isRecording = true;
    typedWords = []; // Reset word queue for new recording session
    audioData = []; // Reset audio data
    lastPartialText = ''; // Reset partial text tracker

    // Update status
    updateStatus('recording');

    // Cache microphone name once at start (avoid repeated shell calls during recording)
    cachedMicName = getDefaultMicrophone();

    // Start interval to update info line with audio level every 100ms
    audioLevelInterval = setInterval(() => {
        updateInfoLine();
    }, 100);

    // Create a new recognizer for this recording session
    recognizer = new vosk.Recognizer({ model: model, sampleRate: 16000 });
    recognizer.setMaxAlternatives(0);
    recognizer.setWords(true);

    // Start recording with node-record-lpcm16
    // Use rec-wrapper.sh to run rec as original user (preserves audio access when using sudo)
    const recCommand = fs.existsSync(path.join(__dirname, 'rec-wrapper.sh'))
        ? path.join(__dirname, 'rec-wrapper.sh')
        : 'rec';

    recorder = record.record({
        sampleRate: 16000,
        channels: 1,
        threshold: 0,
        silence: '2.0',
        recordProgram: recCommand, // Uses SoX via wrapper
    });

    const audioStream = recorder.stream();

    audioStream.on('data', (data) => {
        if (recognizer) {
            const endOfSpeech = recognizer.acceptWaveform(data);

            // Calculate audio amplitude for waveform visualization
            const amplitude = calculateAmplitude(data);
            audioData.push(amplitude);
            if (audioData.length > maxDataPoints) {
                audioData.shift();
            }

            // Update audio level for info line display
            currentAudioLevel = calculateAudioLevel(data);

            // Get partial result for real-time transcription
            try {
                const partialResult = recognizer.partialResult();
                const partial = typeof partialResult === 'string' ? JSON.parse(partialResult) : partialResult;

                if (partial.partial && partial.partial.trim().length > 0) {
                    const newText = partial.partial.trim();

                    // Count words in the new result
                    const newWordCount = newText.split(/\s+/).filter(w => w.length > 0).length;

                    // Only process if we have MORE words than before
                    if (newWordCount > typedWords.length) {
                        lastPartialText = newText;
                        // Type new words as they're recognized
                        typeNewWords(newText);
                    }
                }
            } catch (err) {
                // Silently ignore partial result errors
            }
        }
    });

    audioStream.on('error', (err) => {
        console.error('Audio stream error:', err.message || err);
        stopRecording();
    });

    recorder.start();
}

// Function to stop recording
function stopRecording() {
    if (!isRecording) {
        return;
    }

    // Update status to processing
    updateStatus('processing');

    // Stop the audio level update interval
    if (audioLevelInterval) {
        clearInterval(audioLevelInterval);
        audioLevelInterval = null;
    }
    currentAudioLevel = 0;
    cachedMicName = null; // Clear cached name
    updateInfoLine(); // Reset to 0%

    // Continue recording for 2 more seconds, then process
    setTimeout(() => {
        // Stop the recorder
        if (recorder) {
            recorder.stop();
            recorder = null;
        }

        // Get final result from recognizer
        if (recognizer) {
            const finalResult = recognizer.finalResult();
            recognizer.free();
            recognizer = null;

            // Parse and display the transcription
            try {
                // Check if result is already an object or a string
                const result = typeof finalResult === 'string' ? JSON.parse(finalResult) : finalResult;
                if (result.text && result.text.trim().length > 0) {
                    const transcribedText = result.text.trim();

                    // Use word-based queue to type only remaining words
                    const finalWords = transcribedText.split(/\s+/).filter(word => word.length > 0);

                    // Type any remaining words that weren't captured in partial results
                    for (let i = typedWords.length; i < finalWords.length; i++) {
                        const word = finalWords[i];
                        typeTextAtCursor(word + ' ');
                        typedWords.push(word);
                    }

                    // Set status back to idle
                    updateStatus('idle');
                } else {
                    // Set status back to idle
                    updateStatus('idle');
                }
            } catch (err) {
                // Set status back to idle on error
                console.error('Error processing final result:', err.message || err);
                updateStatus('idle');
            }
        }

        isRecording = false;
        audioData = []; // Clear audio data
    }, 2000); // 2 second delay
}

// Listen for keyboard shortcuts
keyboard.addListener((e, down) => {
    // Check for F9 key
    if (e.state === 'DOWN' && e.name === 'F9') {
        if (!isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    }
});

// Quit on Escape, q, or Control-C
screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    if (isRecording) {
        stopRecording();
    }
    if (model) {
        model.free();
    }
    return process.exit(0);
});

// Initial render
screen.render();

// Initialize info line
updateInfoLine();

// Keep the process running
process.stdin.resume();
