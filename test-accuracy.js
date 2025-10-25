const vosk = require('vosk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Gettysburg Address Transcription Test ===\n');

// Paths
const MODEL_PATH = path.join(__dirname, 'models', 'vosk-model-en-us-0.22');
const MP3_FILE = '/home/mattuh/Desktop/DataWerkes/localVoiceApp/gettysburg_address_64kb.mp3';
const EXPECTED_TEXT_FILE = '/home/mattuh/Desktop/DataWerkes/localVoiceApp/Four score and seven years.txt';
const WAV_FILE = '/tmp/gettysburg_test.wav';

// Step 1: Convert MP3 to WAV (16kHz, mono, 16-bit PCM)
console.log('Step 1: Converting MP3 to WAV format...');
try {
    execSync(`ffmpeg -i "${MP3_FILE}" -ar 16000 -ac 1 -f wav "${WAV_FILE}" -y 2>/dev/null`);
    console.log('✓ Conversion complete\n');
} catch (err) {
    console.error('✗ ffmpeg not found, trying sox...');
    try {
        execSync(`sox "${MP3_FILE}" -r 16000 -c 1 "${WAV_FILE}"`);
        console.log('✓ Conversion complete with sox\n');
    } catch (err2) {
        console.error('✗ Error: Please install ffmpeg or sox to convert MP3 to WAV');
        process.exit(1);
    }
}

// Step 2: Load expected text
console.log('Step 2: Loading expected text...');
const expectedText = fs.readFileSync(EXPECTED_TEXT_FILE, 'utf-8')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const expectedWords = expectedText.split(/\s+/);
console.log(`✓ Expected: ${expectedWords.length} words\n`);

// Step 3: Initialize Vosk
console.log('Step 3: Loading Vosk model...');
const model = new vosk.Model(MODEL_PATH);
const recognizer = new vosk.Recognizer({ model: model, sampleRate: 16000 });
recognizer.setWords(true);
console.log('✓ Model loaded\n');

// Step 4: Process audio file with deduplication
console.log('Step 4: Transcribing audio with deduplication...');
const wavBuffer = fs.readFileSync(WAV_FILE);
const chunkSize = 8000;
let typedWords = []; // Track words we've already processed

for (let i = 0; i < wavBuffer.length; i += chunkSize) {
    const chunk = wavBuffer.slice(i, Math.min(i + chunkSize, wavBuffer.length));
    const endOfSpeech = recognizer.acceptWaveform(chunk);

    if (endOfSpeech) {
        const result = recognizer.result();
        const resultObj = typeof result === 'string' ? JSON.parse(result) : result;
        if (resultObj.text) {
            const newWords = resultObj.text.trim().split(/\s+/).filter(w => w.length > 0);
            // Add only new words beyond what we have
            for (let j = typedWords.length; j < newWords.length; j++) {
                const word = newWords[j];
                // Skip consecutive duplicates
                if (typedWords.length > 0 && word === typedWords[typedWords.length - 1]) {
                    continue;
                }
                typedWords.push(word);
            }
        }
    }
}

// Get final result
const finalResult = recognizer.finalResult();
const finalObj = typeof finalResult === 'string' ? JSON.parse(finalResult) : finalResult;
if (finalObj.text) {
    const finalWords = finalObj.text.trim().split(/\s+/).filter(w => w.length > 0);
    for (let j = typedWords.length; j < finalWords.length; j++) {
        const word = finalWords[j];
        // Skip consecutive duplicates
        if (typedWords.length > 0 && word === typedWords[typedWords.length - 1]) {
            continue;
        }
        typedWords.push(word);
    }
}

const transcribedText = typedWords.join(' ').toLowerCase();
const transcribedWords = typedWords.map(w => w.toLowerCase());
console.log(`✓ Transcribed: ${transcribedWords.length} words\n`);

// Step 5: Calculate accuracy metrics
console.log('Step 5: Calculating accuracy metrics...\n');

// Word Error Rate (WER) calculation using Levenshtein distance
function calculateWER(reference, hypothesis) {
    const refWords = reference;
    const hypWords = hypothesis;

    const m = refWords.length;
    const n = hypWords.length;

    // Create matrix for dynamic programming
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    // Initialize
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // Fill matrix
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (refWords[i - 1] === hypWords[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,      // deletion
                    dp[i][j - 1] + 1,      // insertion
                    dp[i - 1][j - 1] + 1   // substitution
                );
            }
        }
    }

    return dp[m][n];
}

const levenshteinDistance = calculateWER(expectedWords, transcribedWords);
const wer = (levenshteinDistance / expectedWords.length * 100).toFixed(2);
const accuracy = (100 - wer).toFixed(2);

// Calculate exact match percentage
let exactMatches = 0;
const minLength = Math.min(expectedWords.length, transcribedWords.length);
for (let i = 0; i < minLength; i++) {
    if (expectedWords[i] === transcribedWords[i]) {
        exactMatches++;
    }
}
const exactMatchPercent = (exactMatches / expectedWords.length * 100).toFixed(2);

console.log('=== RESULTS ===');
console.log(`Expected words:     ${expectedWords.length}`);
console.log(`Transcribed words:  ${transcribedWords.length}`);
console.log(`Exact matches:      ${exactMatches} (${exactMatchPercent}%)`);
console.log(`Edit distance:      ${levenshteinDistance}`);
console.log(`Word Error Rate:    ${wer}%`);
console.log(`Accuracy:           ${accuracy}%`);
console.log('');

// Show first differences
console.log('=== SAMPLE COMPARISON (First 50 words) ===');
console.log('Expected:    ', expectedWords.slice(0, 50).join(' '));
console.log('Transcribed: ', transcribedWords.slice(0, 50).join(' '));
console.log('');

// Identify common errors
console.log('=== WORD-BY-WORD DIFFERENCES (First 20 mismatches) ===');
let errorCount = 0;
for (let i = 0; i < minLength && errorCount < 20; i++) {
    if (expectedWords[i] !== transcribedWords[i]) {
        console.log(`Position ${i}: "${expectedWords[i]}" → "${transcribedWords[i]}"`);
        errorCount++;
    }
}

// Save full transcription
fs.writeFileSync('/tmp/gettysburg_transcribed.txt', transcribedText);
console.log('\n✓ Full transcription saved to /tmp/gettysburg_transcribed.txt');

// Cleanup
model.free();
console.log('\n=== Test Complete ===');
