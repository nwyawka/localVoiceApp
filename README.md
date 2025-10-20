# Local Voice-to-Text Application

A lightweight Node.js application for local voice-to-text transcription with keyboard shortcut activation. Automatically types transcribed text at your cursor position in any application.

## Prerequisites

Install SoX (Sound eXchange) for audio recording and xdotool for text insertion:

```bash
sudo apt-get install sox libsox-fmt-all xdotool
```

Or run the setup script:

```bash
./setup.sh
```

## Installation

Dependencies are already installed. If needed, run:

```bash
npm install
```

## Usage

### Option 1: Install as Background Service (Recommended)

Install the app to run automatically as a background service:

```bash
./install-service.sh
```

The service will start automatically and run in the background. You can use F9 anytime!

**Service Management Commands:**
- Check status: `systemctl --user status voice-to-text`
- View logs: `journalctl --user -u voice-to-text -f`
- Restart: `systemctl --user restart voice-to-text`
- Stop: `systemctl --user stop voice-to-text`
- Uninstall: `./uninstall-service.sh`

### Option 2: Run Manually

Start the application in a terminal:

```bash
npm start
```

Keep the terminal open in the background.

### Using the App

1. Position your cursor in any text field (browser, text editor, etc.)
2. Press **F9** key to start recording (you'll see a notification)
3. Speak clearly into your microphone
4. **Watch the text appear in real-time as you speak!**
5. Press **F9** again when you're done speaking
6. The app continues recording for 2 more seconds to capture your complete sentence
7. A space is automatically added at the end for the next sentence

## Features

- **Real-time transcription**: Text appears as you speak - see words typed live!
- **Background service**: Runs automatically in the background, always ready
- **Auto-typing**: Transcribed text is automatically typed wherever your cursor is
- **Single key activation**: Just press F9 to start/stop
- **Smart recording**: Continues for 2 seconds after you stop to capture complete sentences
- **Visual notifications**: Shows recording status, processing, and results
- **Fully local/offline** transcription using Vosk (no cloud, no internet needed)
- **High accuracy**: Uses large Vosk model for excellent transcription quality
- **Global keyboard shortcut** (works even when terminal is not focused)
- **Streaming transcription**: Words appear in real-time as they're recognized
- **Works with any application** (browser, text editor, chat apps, etc.)
- **Auto-restart**: Service automatically restarts if it crashes
- **Auto-spacing**: Automatically adds a space after each transcription

## Troubleshooting

**Recording not working?**
- Ensure SoX is installed: `sox --version`
- Check microphone permissions
- Test microphone: `rec -d 3 test.wav`

**Keyboard shortcut not working?**
- The application needs to be running in the terminal
- On some Linux systems, you may need to run with sudo for global keyboard access: `sudo npm start`
- Make sure you're pressing the F9 key (function key, typically at the top of your keyboard)

**Text not being typed?**
- Ensure xdotool is installed: `which xdotool`
- Make sure you have cursor focus in a text field
- If xdotool fails, text will be copied to clipboard as fallback (requires xclip)

**Poor transcription quality?**
- Speak clearly and at a moderate pace
- Reduce background noise
- Ensure microphone is properly positioned
- For better quality, you can download a larger Vosk model

**Service not starting?**
- Check service status: `systemctl --user status voice-to-text`
- View service logs: `journalctl --user -u voice-to-text -f`
- Make sure all dependencies are installed (run `./setup.sh`)
- Try restarting: `systemctl --user restart voice-to-text`

## Visual Feedback

The app provides two types of visual feedback:

### System Tray Indicator
A persistent icon in your system tray shows the current status:
- **⚫ IDLE**: Ready and waiting (dim/gray)
- **🔴 REC**: Currently recording (red/bright)
- **⏳ PROC**: Processing transcription (processing icon)

The indicator stays visible at all times so you always know if you're recording!

### Desktop Notifications (Optional)
The app can also show popup notifications:
- **🎤 Recording**: When you press F9 to start
- **⏳ Processing**: When transcribing your audio
- **✅ Transcription Complete**: Shows transcribed text preview
- **❌ No Speech Detected**: If no speech was found

## Model Information

This app currently uses the **Vosk Large English Model** (~1.8GB) for excellent transcription accuracy. This provides near-commercial quality results but uses more memory (~2.8GB RAM).

To switch to a smaller/faster model, download from https://alphacephei.com/vosk/models and update the MODEL_PATH in index.js:
- **Small model** (~40MB): Faster but less accurate
- **Medium model** (~128MB): Good balance
- **Large model** (~1.8GB): Best accuracy (current)
