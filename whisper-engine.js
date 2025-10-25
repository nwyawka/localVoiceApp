const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Whisper Speech Recognition Engine
 * Provides integration with OpenAI's Whisper model for high-accuracy transcription
 */
class WhisperEngine {
    constructor(options = {}) {
        this.modelName = options.model || 'base.en';
        this.language = options.language || 'en';
        this.device = options.device || 'cpu'; // 'cpu' or 'cuda'
        this.whisperCommand = options.whisperCommand || 'whisper';
    }

    /**
     * Check if Whisper is installed
     * @returns {Promise<boolean>}
     */
    async isInstalled() {
        try {
            await execAsync(`${this.whisperCommand} --help`);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Install Whisper (requires Python and pip)
     * @returns {Promise<void>}
     */
    async install() {
        console.log('Installing Whisper...');
        try {
            // Install Whisper via pip
            await execAsync('pip3 install -U openai-whisper');
            console.log('✓ Whisper installed successfully');

            // Install ffmpeg if not present
            try {
                await execAsync('ffmpeg -version');
            } catch (e) {
                console.log('Installing ffmpeg...');
                await execAsync('sudo apt-get install -y ffmpeg');
                console.log('✓ ffmpeg installed');
            }
        } catch (error) {
            throw new Error(`Failed to install Whisper: ${error.message}`);
        }
    }

    /**
     * Transcribe audio file
     * @param {string} audioFile - Path to audio file (WAV, MP3, etc.)
     * @param {object} options - Transcription options
     * @returns {Promise<object>} - Transcription result with text and metadata
     */
    async transcribeFile(audioFile, options = {}) {
        const model = options.model || this.modelName;
        const language = options.language || this.language;
        const device = options.device || this.device;

        // Output directory for Whisper results
        const outputDir = options.outputDir || '/tmp';

        // Build Whisper command
        const command = [
            this.whisperCommand,
            `"${audioFile}"`,
            `--model ${model}`,
            `--language ${language}`,
            `--device ${device}`,
            `--output_dir "${outputDir}"`,
            '--output_format json',
            '--fp16 False', // Disable FP16 for CPU
        ].join(' ');

        try {
            const { stdout, stderr } = await execAsync(command, {
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            });

            // Read JSON output
            const baseName = path.basename(audioFile, path.extname(audioFile));
            const jsonFile = path.join(outputDir, `${baseName}.json`);

            if (fs.existsSync(jsonFile)) {
                const result = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));

                return {
                    text: result.text.trim(),
                    segments: result.segments || [],
                    language: result.language || language,
                    duration: result.duration || 0,
                };
            }

            throw new Error('Whisper output file not found');
        } catch (error) {
            throw new Error(`Whisper transcription failed: ${error.message}`);
        }
    }

    /**
     * Transcribe audio in real-time (streaming)
     * Note: Whisper doesn't natively support streaming, so this uses chunking
     * @param {function} audioChunkCallback - Callback that provides audio chunks
     * @param {function} transcriptionCallback - Callback that receives transcription
     */
    async transcribeStream(audioChunkCallback, transcriptionCallback) {
        // Whisper doesn't support true streaming
        // We'll collect chunks and process in batches
        const chunks = [];
        let processing = false;

        const processChunks = async () => {
            if (chunks.length === 0 || processing) return;

            processing = true;
            const tempFile = `/tmp/whisper_chunk_${Date.now()}.wav`;

            try {
                // Combine chunks into temp file
                const audioBuffer = Buffer.concat(chunks);
                fs.writeFileSync(tempFile, audioBuffer);

                // Transcribe
                const result = await this.transcribeFile(tempFile);
                transcriptionCallback(result);

                // Clear processed chunks
                chunks.length = 0;

                // Cleanup
                fs.unlinkSync(tempFile);
            } catch (error) {
                console.error('Stream transcription error:', error);
            } finally {
                processing = false;
            }
        };

        // Set interval to process chunks every 2 seconds
        const interval = setInterval(processChunks, 2000);

        // Return cleanup function
        return () => {
            clearInterval(interval);
            chunks.length = 0;
        };
    }

    /**
     * Get available Whisper models
     * @returns {Array<string>}
     */
    getAvailableModels() {
        return [
            'tiny.en',    // ~1GB RAM, fastest, lowest accuracy
            'base.en',    // ~1GB RAM, fast, good accuracy
            'small.en',   // ~2GB RAM, medium speed, better accuracy
            'medium.en',  // ~5GB RAM, slower, high accuracy
            'large',      // ~10GB RAM, slowest, highest accuracy
        ];
    }

    /**
     * Download specific Whisper model
     * @param {string} modelName - Model to download
     * @returns {Promise<void>}
     */
    async downloadModel(modelName) {
        console.log(`Downloading Whisper model: ${modelName}...`);

        // Whisper auto-downloads on first use, so we just run a quick transcription
        const silentFile = '/tmp/silence.wav';

        // Create 1-second silence file
        const { execSync } = require('child_process');
        execSync(`sox -n -r 16000 -c 1 "${silentFile}" trim 0.0 1.0`);

        try {
            await this.transcribeFile(silentFile, { model: modelName });
            console.log(`✓ Model ${modelName} ready`);
        } catch (error) {
            console.error(`Failed to download model: ${error.message}`);
        } finally {
            if (fs.existsSync(silentFile)) {
                fs.unlinkSync(silentFile);
            }
        }
    }
}

module.exports = WhisperEngine;
