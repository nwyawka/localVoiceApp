const vosk = require('vosk');
const record = require('node-record-lpcm16');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { GlobalKeyboardListener } = require('node-global-key-listener');

// Path to the Vosk model (using large model for better accuracy)
const MODEL_PATH = path.join(__dirname, 'models', 'vosk-model-en-us-0.22');

// Check if model exists
if (!fs.existsSync(MODEL_PATH)) {
    console.error('Model not found. Please download the Vosk model first.');
    process.exit(1);
}

// Initialize Vosk model
console.log('Loading Vosk model...');
const model = new vosk.Model(MODEL_PATH);
console.log('Model loaded successfully!');

// State management
let isRecording = false;
let recognizer = null;
let recorder = null;
let lastTypedText = ''; // Track what we've already typed in real-time
let indicatorProcess = null; // Process for visual indicator

// Create keyboard listener
const keyboard = new GlobalKeyboardListener();

// Status indicator file
const STATUS_FILE = path.join(__dirname, '.recording_status');

// Function to update visual indicator
function updateIndicator(status) {
    // Write status to file
    fs.writeFileSync(STATUS_FILE, status, 'utf8');
}

// Function to start visual indicator
function startVisualIndicator() {
    // Create a small always-on-top indicator using yad
    // The indicator will be a notification icon that shows recording status
    const indicatorScript = `
#!/bin/bash
while true; do
    if [ -f "${STATUS_FILE}" ]; then
        status=$(cat "${STATUS_FILE}")
        if [ "$status" = "recording" ]; then
            echo "🔴 REC"
        elif [ "$status" = "processing" ]; then
            echo "⏳ PROC"
        else
            echo "⚫ IDLE"
        fi
    else
        echo "⚫ IDLE"
    fi
    sleep 0.5
done | yad --notification --listen --no-middle --command="" --text="⚫ Voice-to-Text"
    `.trim();

    // Write and execute the indicator script
    const scriptPath = path.join(__dirname, '.indicator.sh');
    fs.writeFileSync(scriptPath, indicatorScript, 'utf8');
    fs.chmodSync(scriptPath, '0755');

    // Start the indicator process
    indicatorProcess = spawn('bash', [scriptPath], {
        detached: false,
        stdio: 'ignore',
        env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' }
    });

    console.log('Visual indicator started');
}

// Initialize status file
updateIndicator('idle');

// Function to show desktop notification
function showNotification(title, message, urgency = 'normal') {
    try {
        execSync(`notify-send -u ${urgency} -t 2000 "${title}" "${message}"`, { encoding: 'utf8' });
    } catch (err) {
        // Silently fail if notifications don't work
        console.log(`[Notification] ${title}: ${message}`);
    }
}

// Function to type text at cursor position
function typeTextAtCursor(text) {
    try {
        // Escape special characters for shell
        const escapedText = text.replace(/'/g, "'\\''");
        // Use xdotool to type the text
        execSync(`xdotool type --delay 12 '${escapedText}'`, { encoding: 'utf8' });
        console.log('✅ Text inserted at cursor position\n');
    } catch (err) {
        console.error('Error typing text:', err.message);
        console.log('Fallback - text copied to clipboard (if xclip available)');
        try {
            execSync(`echo '${text}' | xclip -selection clipboard`, { encoding: 'utf8' });
            console.log('📋 Text copied to clipboard\n');
        } catch (clipErr) {
            console.log('Text output:');
            console.log(text);
        }
    }
}

// Function to type only new words (for real-time transcription)
function typeNewWords(newText) {
    // If new text starts with what we've already typed, only type the difference
    if (newText.startsWith(lastTypedText)) {
        const newPortion = newText.substring(lastTypedText.length);
        if (newPortion.length > 0) {
            typeTextAtCursor(newPortion);
            lastTypedText = newText;
        }
    } else {
        // Text changed (correction happened), type the whole new text
        // Note: This might cause duplication but Vosk is generally consistent with partial results
        console.log('[Warning] Partial result changed, typing new version');
        typeTextAtCursor(newText);
        lastTypedText = newText;
    }
}

// Function to start recording
function startRecording() {
    if (isRecording) {
        console.log('Already recording...');
        return;
    }

    isRecording = true;
    lastTypedText = ''; // Reset for new recording session
    console.log('\n🎤 Recording started... (Press F9 again to stop)');

    // Update visual indicator
    updateIndicator('recording');

    // Show notification
    showNotification('🎤 Recording', 'Listening... Press F9 to stop', 'normal');

    // Create a new recognizer for this recording session
    recognizer = new vosk.Recognizer({ model: model, sampleRate: 16000 });
    recognizer.setMaxAlternatives(0);
    recognizer.setWords(true);

    // Start recording with node-record-lpcm16
    recorder = record.record({
        sampleRate: 16000,
        channels: 1,
        threshold: 0,
        silence: '2.0',
        recordProgram: 'rec', // Uses SoX
    });

    const audioStream = recorder.stream();

    audioStream.on('data', (data) => {
        if (recognizer) {
            const endOfSpeech = recognizer.acceptWaveform(data);

            // Get partial result for real-time transcription
            try {
                const partialResult = recognizer.partialResult();
                const partial = typeof partialResult === 'string' ? JSON.parse(partialResult) : partialResult;

                if (partial.partial && partial.partial.trim().length > 0) {
                    const newText = partial.partial.trim();
                    // Type new words as they're recognized
                    typeNewWords(newText);
                }
            } catch (err) {
                // Silently ignore partial result errors
                console.log('[Debug] Partial result error:', err.message);
            }
        }
    });

    audioStream.on('error', (err) => {
        console.error('Recording error:', err);
        stopRecording();
    });

    recorder.start();
}

// Function to stop recording
function stopRecording() {
    if (!isRecording) {
        console.log('Not currently recording...');
        return;
    }

    console.log('🛑 Finishing recording... (2 more seconds)\n');

    // Update indicator to processing
    updateIndicator('processing');

    // Show notification that we're continuing to record for 2 more seconds
    showNotification('⏸️ Finishing up...', 'Recording for 2 more seconds', 'normal');

    // Continue recording for 2 more seconds, then process
    setTimeout(() => {
        console.log('🛑 Recording complete. Processing...\n');

        // Show processing notification
        showNotification('⏳ Processing', 'Transcribing audio...', 'normal');

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
                    console.log('📝 Final Transcription:', transcribedText);

                    // Show success notification
                    showNotification('✅ Transcription Complete', transcribedText.substring(0, 50) + (transcribedText.length > 50 ? '...' : ''), 'normal');

                    // Type only any remaining words that weren't in partial results
                    if (transcribedText.length > lastTypedText.length) {
                        const remainingText = transcribedText.substring(lastTypedText.length);
                        if (remainingText.trim().length > 0) {
                            console.log('[Debug] Typing remaining text:', remainingText);
                            typeTextAtCursor(remainingText);
                        }
                    }

                    // Add a space after the transcription for next sentence
                    typeTextAtCursor(' ');

                    // Set indicator back to idle
                    updateIndicator('idle');
                } else {
                    console.log('❌ No speech detected or transcription failed.\n');
                    showNotification('❌ No Speech Detected', 'Please try again', 'critical');

                    // Set indicator back to idle
                    updateIndicator('idle');
                }
            } catch (err) {
                console.error('Error parsing result:', err);
                console.error('Raw result:', finalResult);

                // Set indicator back to idle on error
                updateIndicator('idle');
            }
        }

        isRecording = false;
    }, 2000); // 2 second delay
}

// Listen for keyboard shortcuts
console.log('\n✅ Voice-to-text application ready!');
console.log('Press F9 key to start/stop recording');
console.log('Text will be typed at your cursor position');
console.log('Visual indicator will show in system tray');
console.log('Press Ctrl+C to exit\n');

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

// Start visual indicator
startVisualIndicator();

// Handle cleanup on exit
process.on('SIGINT', () => {
    console.log('\n\nCleaning up...');
    if (isRecording) {
        stopRecording();
    }
    if (model) {
        model.free();
    }
    if (indicatorProcess) {
        indicatorProcess.kill();
    }
    // Clean up status file
    if (fs.existsSync(STATUS_FILE)) {
        fs.unlinkSync(STATUS_FILE);
    }
    process.exit(0);
});

// Keep the process running
process.stdin.resume();
