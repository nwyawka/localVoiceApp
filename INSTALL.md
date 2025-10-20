# Installation Guide

## Quick Install (Ubuntu 20.04+)

```bash
# Clone or download the repository
git clone https://github.com/YOUR_USERNAME/localVoiceApp.git
cd localVoiceApp

# Run the automated installer
./setup.sh

# Install as a service
./install-service.sh
```

## System Requirements

- Ubuntu 20.04 or later (or any Debian-based Linux)
- ~3GB free disk space (for Vosk model)
- Microphone
- Speakers (optional, for testing)

## Manual Installation

### 1. Install System Dependencies

```bash
sudo apt-get update
sudo apt-get install -y nodejs npm sox libsox-fmt-all xdotool yad
```

### 2. Install Node.js Dependencies

```bash
npm install
```

### 3. Download Vosk Model

Choose your model based on accuracy vs size:

**Small Model (~40MB) - Fast but less accurate:**
```bash
cd models
wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip vosk-model-small-en-us-0.15.zip
rm vosk-model-small-en-us-0.15.zip
```

**Large Model (~1.8GB) - Best accuracy (Recommended):**
```bash
cd models
wget https://alphacephei.com/vosk/models/vosk-model-en-us-0.22.zip
unzip vosk-model-en-us-0.22.zip
rm vosk-model-en-us-0.22.zip
```

Then update `MODEL_PATH` in `index.js` to match your chosen model.

### 4. Test the Application

```bash
npm start
```

Press F9 to test recording!

### 5. Install as Service (Optional)

```bash
./install-service.sh
```

## Troubleshooting

See README.md for troubleshooting steps.

## Uninstall

```bash
# If installed as service
./uninstall-service.sh

# Remove files
cd ..
rm -rf localVoiceApp
```
