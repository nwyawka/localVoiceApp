// Configuration for voice-to-text app
module.exports = {
    // Speech Recognition Settings
    recognition: {
        // Minimum confidence threshold (0.0 - 1.0)
        // Words below this threshold will be skipped
        minConfidence: 0.7,

        // Sample rate for audio recording
        sampleRate: 16000,

        // Recording buffer time after stop (ms)
        bufferTime: 2000,
    },

    // Audio Preprocessing Settings
    audioPreprocessing: {
        // Enable noise reduction (requires noise profile - disabled for now)
        noiseReduction: false,

        // Enable volume normalization
        volumeNormalization: true,

        // High-pass filter frequency (Hz) - removes low-frequency noise
        highPassFilter: 80,

        // Low-pass filter frequency (Hz) - removes high-frequency noise
        lowPassFilter: 3000,
    },

    // UI Settings
    ui: {
        // Waveform update interval (ms)
        waveformUpdateInterval: 50,

        // Audio level update interval (ms)
        audioLevelUpdateInterval: 100,

        // Maximum waveform data points
        maxWaveformPoints: 50,
    },

    // Model Paths
    models: {
        // Main speech recognition model
        vosk: 'models/vosk-model-en-us-0.22',

        // Punctuation model (optional)
        punctuation: 'models/vosk-recasepunc-en-0.22',

        // Whisper model path (if using Whisper)
        whisper: 'models/whisper-base.en',
    },

    // Engine Selection
    engine: {
        // Options: 'vosk', 'whisper'
        type: 'vosk',

        // Whisper-specific settings
        whisper: {
            model: 'base.en', // tiny.en, base.en, small.en, medium.en, large
            language: 'en',
        },
    },

    // Post-processing
    postProcessing: {
        // Enable auto-capitalization
        autoCapitalize: true,

        // Enable common error corrections
        errorCorrections: true,

        // Custom corrections map
        corrections: {
            'at that': 'that that',
            'for from': 'from',
        },
    },
};
