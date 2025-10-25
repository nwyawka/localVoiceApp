const config = require('./config');

/**
 * Post-Processing Module
 * Applies corrections, capitalization, and formatting to transcribed text
 */
class PostProcessor {
    constructor(options = {}) {
        this.config = {
            ...config.postProcessing,
            ...options,
        };
    }

    /**
     * Process transcribed text with all enabled corrections
     * @param {string} text - Raw transcribed text
     * @param {object} metadata - Additional context (confidence, etc.)
     * @returns {string} - Processed text
     */
    process(text, metadata = {}) {
        let processed = text;

        // Apply custom corrections
        if (this.config.errorCorrections) {
            processed = this._applyCorrections(processed);
        }

        // Apply auto-capitalization
        if (this.config.autoCapitalize) {
            processed = this._capitalizeText(processed);
        }

        return processed;
    }

    /**
     * Apply common error corrections
     * @param {string} text - Input text
     * @returns {string} - Corrected text
     * @private
     */
    _applyCorrections(text) {
        let corrected = text;

        // Apply custom corrections from config
        for (const [wrong, right] of Object.entries(this.config.corrections)) {
            const regex = new RegExp(wrong, 'gi');
            corrected = corrected.replace(regex, right);
        }

        // Common homophones (context-independent fixes)
        const homophones = {
            'their going': 'they\'re going',
            'your going': 'you\'re going',
            'its a': 'it\'s a',
            'its been': 'it\'s been',
        };

        for (const [wrong, right] of Object.entries(homophones)) {
            const regex = new RegExp(wrong, 'gi');
            corrected = corrected.replace(regex, right);
        }

        return corrected;
    }

    /**
     * Capitalize sentences and proper nouns
     * @param {string} text - Input text
     * @returns {string} - Capitalized text
     * @private
     */
    _capitalizeText(text) {
        if (!text) return text;

        // Capitalize first letter
        let capitalized = text.charAt(0).toUpperCase() + text.slice(1);

        // Capitalize after sentence-ending punctuation
        capitalized = capitalized.replace(/([.!?]\s+)([a-z])/g, (match, punctuation, letter) => {
            return punctuation + letter.toUpperCase();
        });

        // Capitalize 'I' pronoun
        capitalized = capitalized.replace(/\bi\b/g, 'I');

        // Capitalize common proper nouns (expandable list)
        const properNouns = [
            'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
            'january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december',
        ];

        for (const noun of properNouns) {
            const regex = new RegExp(`\\b${noun}\\b`, 'gi');
            capitalized = capitalized.replace(regex, (match) => {
                return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
            });
        }

        return capitalized;
    }

    /**
     * Filter words by confidence threshold
     * @param {Array} words - Array of word objects with {text, confidence}
     * @param {number} threshold - Minimum confidence (0.0 - 1.0)
     * @returns {Array} - Filtered words
     */
    filterByConfidence(words, threshold = null) {
        const minConfidence = threshold !== null ? threshold : config.recognition.minConfidence;

        return words.filter(word => {
            // If word doesn't have confidence, include it
            if (word.conf === undefined) return true;

            // Filter by confidence
            return word.conf >= minConfidence;
        });
    }

    /**
     * Remove consecutive duplicate words
     * @param {string} text - Input text
     * @returns {string} - Text without consecutive duplicates
     */
    removeDuplicates(text) {
        const words = text.split(' ');
        const filtered = [];

        for (let i = 0; i < words.length; i++) {
            // Skip if same as previous word
            if (i > 0 && words[i] === words[i - 1]) {
                continue;
            }
            filtered.push(words[i]);
        }

        return filtered.join(' ');
    }

    /**
     * Add punctuation based on pauses and context
     * Note: This is a simple heuristic. For better results, use Vosk punctuation model
     * @param {string} text - Input text
     * @param {Array} segments - Timing segments from recognizer
     * @returns {string} - Text with punctuation
     */
    addPunctuation(text, segments = []) {
        // This is a placeholder for basic punctuation
        // The Vosk punctuation model does this much better

        let punctuated = text;

        // Add period at end if missing
        if (punctuated && !punctuated.match(/[.!?]$/)) {
            punctuated += '.';
        }

        return punctuated;
    }

    /**
     * Format numbers and special characters
     * @param {string} text - Input text
     * @returns {string} - Formatted text
     */
    formatSpecialCharacters(text) {
        let formatted = text;

        // Convert spoken numbers to digits (optional)
        const spokenNumbers = {
            'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
            'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
        };

        // Only convert isolated numbers (not in phrases like "one person")
        for (const [spoken, digit] of Object.entries(spokenNumbers)) {
            const regex = new RegExp(`\\b${spoken}\\b(?!\\s+(person|thing|time))`, 'gi');
            // Uncomment to enable number conversion:
            // formatted = formatted.replace(regex, digit);
        }

        return formatted;
    }
}

module.exports = PostProcessor;
