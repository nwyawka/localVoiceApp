const vosk = require('vosk');
const record = require('node-record-lpcm16');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { GlobalKeyboardListener } = require('node-global-key-listener');
const blessed = require('blessed');

// Import accuracy improvement modules
const config = require('./config');
const AudioProcessor = require('./audio-processor');
const PostProcessor = require('./post-processor');

// Global error handlers
process.on('uncaughtException', (err) => {
    const errorMsg = `\n=== UNCAUGHT EXCEPTION ===\nError: ${err.message}\nStack: ${err.stack}\n`;
    fs.appendFileSync('/tmp/voice-app-error.log', errorMsg);
    console.error(errorMsg);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    const errorMsg = `\n=== UNHANDLED REJECTION ===\nReason: ${reason}\nPromise: ${promise}\n`;
    fs.appendFileSync('/tmp/voice-app-error.log', errorMsg);
    console.error(errorMsg);
    process.exit(1);
});

// Initialize modules
const audioProcessor = new AudioProcessor();
const postProcessor = new PostProcessor();

// Paths
const MODEL_PATH = path.join(__dirname, config.models.vosk);

// Global variables
let currentAudioLevel = 0;
let cachedMicName = null;

// Check if model exists
if (!fs.existsSync(MODEL_PATH)) {
    console.error('Model not found. Please download the Vosk model first.');
    process.exit(1);
}

// Detect default microphone
function getDefaultMicrophone() {
  try {
    const { execSync } = require('child_process');

    try {
      const output = execSync('pactl list sources | grep -A 10 "State: RUNNING" | grep "Description:" | head -1', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      const match = output.match(/Description:\s*(.+)/);
      if (match) {
        const name = match[1].trim();
        return name.length > 35 ? name.substring(0, 32) + '...' : name;
      }
    } catch (e) {
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
    // Detection failed
  }

  return 'Default';
}

// Calculate audio level
function calculateAudioLevel(buffer) {
  if (!buffer || buffer.length === 0) return 0;

  let sum = 0;
  for (let i = 0; i < buffer.length; i += 2) {
    const normalized = buffer.readInt16LE(i) / 32768.0;
    sum += normalized * normalized;
  }
  const rms = Math.sqrt(sum / (buffer.length / 2));
  const level = Math.min(100, Math.floor(rms * 100 * 8));
  return level;
}

// Initialize Vosk model
console.log('Loading Vosk model...');
const model = new vosk.Model(MODEL_PATH);
console.log('Model loaded successfully!');

// Create blessed screen
const screen = blessed.screen({
    smartCSR: true,
    title: 'Voice-to-Text Monitor',
    fullUnicode: true
});

// UI Elements
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

screen.append(headerBox);
screen.append(infoLine);
screen.append(waveformBox);

// State management
let isRecording = false;
let recorder = null;
let audioBuffers = []; // Store all audio buffers
let audioData = []; // Waveform visualization
const maxDataPoints = 50;
let audioLevelInterval = null;

// Create keyboard listener
const keyboard = new GlobalKeyboardListener();

// Calculate amplitude
function calculateAmplitude(buffer) {
    let sum = 0;
    const view = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);

    for (let i = 0; i < view.length; i++) {
        sum += Math.abs(view[i]);
    }

    const average = sum / view.length;
    return average / 32768;
}

// Unicode waveform characters
const waveformChars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

// Update waveform display
function updateWaveform() {
    if (isRecording && audioData.length > 0) {
        const waveform = audioData.map(amp => {
            const index = Math.min(Math.floor(amp * 8 * waveformChars.length), waveformChars.length - 1);
            return waveformChars[Math.max(0, index)];
        }).join('');

        waveformBox.setContent(`\n  ${waveform}`);
    } else {
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

setInterval(updateWaveform, 50);

// Update status
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

// Update info line
function updateInfoLine() {
  const micName = cachedMicName || getDefaultMicrophone();
  const level = currentAudioLevel;

  const leftInfo = `{yellow-fg}Mic:{/yellow-fg} {green-fg}${micName} (${level}%){/green-fg}`;
  const rightInfo = `{yellow-fg}F9:{/yellow-fg} {green-fg}Start/Stop{/green-fg}`;

  const leftPlain = leftInfo.replace(/\{[^}]+\}/g, '');
  const rightPlain = rightInfo.replace(/\{[^}]+\}/g, '');
  const padding = ' '.repeat(Math.max(1, 60 - leftPlain.length - rightPlain.length));

  infoLine.setContent(leftInfo + padding + rightInfo);
  screen.render();
}

// Type text at cursor
function typeTextAtCursor(text) {
    try {
        const escapedText = text.replace(/'/g, "'\\''");
        execSync(`xdotool type --delay 12 '${escapedText}'`, { encoding: 'utf8' });
    } catch (err) {
        console.error('Error typing text:', err.message || err);
    }
}

// Start recording
function startRecording() {
    if (isRecording) {
        return;
    }

    isRecording = true;
    audioBuffers = []; // Clear buffer array
    audioData = [];

    updateStatus('recording');
    cachedMicName = getDefaultMicrophone();

    audioLevelInterval = setInterval(() => {
        updateInfoLine();
    }, 100);

    // Start recording
    const recCommand = fs.existsSync(path.join(__dirname, 'rec-wrapper.sh'))
        ? path.join(__dirname, 'rec-wrapper.sh')
        : 'rec';

    recorder = record.record({
        sampleRate: 16000,
        channels: 1,
        threshold: 0,
        silence: '2.0',
        recordProgram: recCommand,
    });

    const audioStream = recorder.stream();

    audioStream.on('data', (data) => {
        // Store all audio data
        audioBuffers.push(Buffer.from(data));

        // Update visualization
        const amplitude = calculateAmplitude(data);
        audioData.push(amplitude);
        if (audioData.length > maxDataPoints) {
            audioData.shift();
        }

        currentAudioLevel = calculateAudioLevel(data);
    });

    audioStream.on('error', (err) => {
        console.error('Audio stream error:', err.message || err);
        stopRecording();
    });

    recorder.start();
}

// Stop recording and process
function stopRecording() {
    if (!isRecording) {
        return;
    }

    updateStatus('processing');

    if (audioLevelInterval) {
        clearInterval(audioLevelInterval);
        audioLevelInterval = null;
    }
    currentAudioLevel = 0;
    cachedMicName = null;
    updateInfoLine();

    // Continue recording for 2 more seconds
    setTimeout(() => {
        // Stop recorder
        if (recorder) {
            recorder.stop();
            recorder = null;
        }

        // Process all recorded audio
        processRecording();

        isRecording = false;
        audioData = [];
    }, 2000);
}

// Process complete recording
function processRecording() {
    try {
        // Combine all audio buffers
        const completeAudio = Buffer.concat(audioBuffers);

        // Save to temporary file
        const tempFile = `/tmp/recording_${Date.now()}.wav`;
        const tempProcessed = `/tmp/recording_processed_${Date.now()}.wav`;

        // Create WAV header
        const wavHeader = createWavHeader(completeAudio.length);
        fs.writeFileSync(tempFile, Buffer.concat([wavHeader, completeAudio]));

        // Apply audio preprocessing
        const processedFile = audioProcessor.preprocessFile(tempFile, tempProcessed);

        // Read processed audio
        const processedData = fs.readFileSync(processedFile);
        const audioOnly = processedData.slice(44); // Skip WAV header

        // Create recognizer
        const recognizer = new vosk.Recognizer({ model: model, sampleRate: 16000 });
        recognizer.setWords(true);

        // Process audio in chunks
        const chunkSize = 4000;
        for (let offset = 0; offset < audioOnly.length; offset += chunkSize) {
            const chunk = audioOnly.slice(offset, offset + chunkSize);
            recognizer.acceptWaveform(chunk);
        }

        // Get final result
        const finalResult = recognizer.finalResult();
        recognizer.free();

        // Parse result
        const result = typeof finalResult === 'string' ? JSON.parse(finalResult) : finalResult;

        if (result.text && result.text.trim().length > 0) {
            let transcribedText = result.text.trim();
            const wordResults = result.result || [];

            // Apply confidence filtering
            if (wordResults.length > 0) {
                const filteredWords = postProcessor.filterByConfidence(wordResults, config.recognition.minConfidence);
                transcribedText = filteredWords.map(w => w.word).join(' ');
            }

            // Remove duplicates
            transcribedText = postProcessor.removeDuplicates(transcribedText);

            // Apply post-processing (capitalization, corrections)
            transcribedText = postProcessor.process(transcribedText);

            // Type the complete result
            if (transcribedText.length > 0) {
                typeTextAtCursor(transcribedText + ' ');
            }
        }

        // Cleanup temp files
        try {
            fs.unlinkSync(tempFile);
            if (processedFile !== tempFile) {
                fs.unlinkSync(processedFile);
            }
        } catch (e) {
            // Ignore cleanup errors
        }

        updateStatus('idle');

    } catch (error) {
        console.error('Processing error:', error.message || error);
        updateStatus('idle');
    }
}

// Create WAV header
function createWavHeader(dataLength) {
    const buffer = Buffer.alloc(44);

    // "RIFF"
    buffer.write('RIFF', 0);
    // File size - 8
    buffer.writeUInt32LE(36 + dataLength, 4);
    // "WAVE"
    buffer.write('WAVE', 8);
    // "fmt "
    buffer.write('fmt ', 12);
    // Format chunk size
    buffer.writeUInt32LE(16, 16);
    // Audio format (1 = PCM)
    buffer.writeUInt16LE(1, 20);
    // Channels
    buffer.writeUInt16LE(1, 22);
    // Sample rate
    buffer.writeUInt32LE(16000, 24);
    // Byte rate
    buffer.writeUInt32LE(16000 * 2, 28);
    // Block align
    buffer.writeUInt16LE(2, 32);
    // Bits per sample
    buffer.writeUInt16LE(16, 34);
    // "data"
    buffer.write('data', 36);
    // Data size
    buffer.writeUInt32LE(dataLength, 40);

    return buffer;
}

// Listen for keyboard shortcuts
keyboard.addListener((e, down) => {
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
updateInfoLine();

// Keep process running
process.stdin.resume();
