#!/bin/bash

set -e  # Exit on error

echo "================================================"
echo "Local Voice-to-Text Application Setup"
echo "================================================"
echo ""

# Check if running on Ubuntu/Debian
if ! command -v apt-get &> /dev/null; then
    echo "❌ This script requires Ubuntu or Debian-based Linux"
    exit 1
fi

echo "Checking system dependencies..."
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    echo "✅ Node.js is installed ($(node --version))"
else
    echo "📦 Installing Node.js..."
    sudo apt-get update
    sudo apt-get install -y nodejs npm
    echo "✅ Node.js installed"
fi

echo ""

# Check if SoX is installed
if command -v sox &> /dev/null && command -v rec &> /dev/null; then
    echo "✅ SoX is already installed"
else
    echo "📦 Installing SoX (audio recording)..."
    sudo apt-get install -y sox libsox-fmt-all
    echo "✅ SoX installed"
fi

echo ""

# Check if xdotool is installed
if command -v xdotool &> /dev/null; then
    echo "✅ xdotool is already installed"
else
    echo "📦 Installing xdotool (text typing)..."
    sudo apt-get install -y xdotool
    echo "✅ xdotool installed"
fi

echo ""

# Check if yad is installed
if command -v yad &> /dev/null; then
    echo "✅ yad is already installed"
else
    echo "📦 Installing yad (system tray indicator)..."
    sudo apt-get install -y yad
    echo "✅ yad installed"
fi

echo ""

# Install npm dependencies
if [ -f "package.json" ]; then
    echo "📦 Installing Node.js packages..."
    npm install
    echo "✅ Node.js packages installed"
else
    echo "❌ package.json not found. Are you in the right directory?"
    exit 1
fi

echo ""

# Check if Vosk model exists
if [ -d "models/vosk-model-en-us-0.22" ]; then
    echo "✅ Vosk large model already downloaded"
elif [ -d "models/vosk-model-small-en-us-0.15" ]; then
    echo "✅ Vosk small model already downloaded"
else
    echo "📥 Vosk model not found. Choose a model to download:"
    echo ""
    echo "1) Large model (~1.8GB) - Best accuracy, slower download"
    echo "2) Small model (~40MB) - Faster download, less accurate"
    echo "3) Skip model download (download manually later)"
    echo ""
    read -p "Enter choice [1-3]: " model_choice

    mkdir -p models
    cd models

    case $model_choice in
        1)
            echo "📥 Downloading large Vosk model (1.8GB)..."
            echo "This may take several minutes..."
            wget https://alphacephei.com/vosk/models/vosk-model-en-us-0.22.zip
            echo "📦 Extracting..."
            unzip -q vosk-model-en-us-0.22.zip
            rm vosk-model-en-us-0.22.zip
            echo "✅ Large model installed"
            ;;
        2)
            echo "📥 Downloading small Vosk model (40MB)..."
            wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
            echo "📦 Extracting..."
            unzip -q vosk-model-small-en-us-0.15.zip
            rm vosk-model-small-en-us-0.15.zip
            echo "✅ Small model installed"
            echo "⚠️  Note: You'll need to update MODEL_PATH in index.js to use this model"
            ;;
        3)
            echo "⏭️  Skipping model download"
            echo "Download manually from: https://alphacephei.com/vosk/models"
            ;;
        *)
            echo "Invalid choice. Skipping model download."
            ;;
    esac

    cd ..
fi

echo ""
echo "================================================"
echo "✅ Setup Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Test the application:"
echo "   npm start"
echo ""
echo "2. Install as background service (optional):"
echo "   ./install-service.sh"
echo ""
echo "Usage:"
echo "  • Press F9 to start/stop recording"
echo "  • Text appears in real-time at your cursor"
echo "  • System tray shows recording status"
echo ""
