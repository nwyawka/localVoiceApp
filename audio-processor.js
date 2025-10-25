const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('./config');

/**
 * Audio Preprocessor
 * Applies noise reduction, normalization, and filtering to improve recognition accuracy
 */
class AudioProcessor {
    constructor(options = {}) {
        this.config = {
            ...config.audioPreprocessing,
            ...options,
        };
    }

    /**
     * Preprocess audio file using SoX
     * @param {string} inputFile - Input WAV file path
     * @param {string} outputFile - Output WAV file path (optional)
     * @returns {string} - Path to processed file
     */
    preprocessFile(inputFile, outputFile = null) {
        if (!outputFile) {
            const timestamp = Date.now();
            outputFile = `/tmp/processed_${timestamp}.wav`;
        }

        const soxFilters = [];

        // High-pass filter (remove low-frequency noise like rumble)
        if (this.config.highPassFilter) {
            soxFilters.push(`highpass ${this.config.highPassFilter}`);
        }

        // Low-pass filter (remove high-frequency noise like hiss)
        if (this.config.lowPassFilter) {
            soxFilters.push(`lowpass ${this.config.lowPassFilter}`);
        }

        // Noise reduction (requires sox with noisered)
        if (this.config.noiseReduction) {
            soxFilters.push('noisered');
        }

        // Volume normalization
        if (this.config.volumeNormalization) {
            soxFilters.push('norm');
        }

        // Build SoX command
        const filterChain = soxFilters.join(' ');
        const command = `sox "${inputFile}" "${outputFile}" ${filterChain}`;

        try {
            execSync(command, { stdio: 'pipe' });
            return outputFile;
        } catch (error) {
            console.error('Audio preprocessing failed:', error.message);
            // Return original file if preprocessing fails
            return inputFile;
        }
    }

    /**
     * Preprocess audio buffer in real-time
     * @param {Buffer} audioBuffer - Raw audio buffer
     * @returns {Buffer} - Processed buffer
     */
    preprocessBuffer(audioBuffer) {
        // For real-time processing, we'll apply simple noise gate and normalization
        return this._normalizeBuffer(audioBuffer);
    }

    /**
     * Normalize audio buffer volume
     * @param {Buffer} buffer - Audio buffer (16-bit PCM)
     * @returns {Buffer} - Normalized buffer
     * @private
     */
    _normalizeBuffer(buffer) {
        if (!this.config.volumeNormalization) {
            return buffer;
        }

        // Find maximum amplitude
        let maxAmplitude = 0;
        for (let i = 0; i < buffer.length; i += 2) {
            const sample = Math.abs(buffer.readInt16LE(i));
            if (sample > maxAmplitude) {
                maxAmplitude = sample;
            }
        }

        // Calculate normalization factor (target 80% of maximum to avoid clipping)
        const targetAmplitude = 32767 * 0.8; // 16-bit maximum * 0.8
        const normFactor = maxAmplitude > 0 ? targetAmplitude / maxAmplitude : 1;

        // Apply normalization if needed
        if (normFactor > 1.1 || normFactor < 0.9) {
            const normalized = Buffer.alloc(buffer.length);
            for (let i = 0; i < buffer.length; i += 2) {
                const sample = buffer.readInt16LE(i);
                const normalizedSample = Math.max(-32768, Math.min(32767, Math.round(sample * normFactor)));
                normalized.writeInt16LE(normalizedSample, i);
            }
            return normalized;
        }

        return buffer;
    }

    /**
     * Apply noise gate to buffer
     * @param {Buffer} buffer - Audio buffer
     * @param {number} threshold - Noise gate threshold (0-1)
     * @returns {Buffer} - Filtered buffer
     * @private
     */
    _applyNoiseGate(buffer, threshold = 0.02) {
        const gateValue = Math.floor(32768 * threshold);
        const gated = Buffer.alloc(buffer.length);

        for (let i = 0; i < buffer.length; i += 2) {
            const sample = buffer.readInt16LE(i);
            const absValue = Math.abs(sample);

            if (absValue < gateValue) {
                // Below threshold - silence
                gated.writeInt16LE(0, i);
            } else {
                // Above threshold - pass through
                gated.writeInt16LE(sample, i);
            }
        }

        return gated;
    }
}

module.exports = AudioProcessor;
