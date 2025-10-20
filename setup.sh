#!/bin/bash

echo "Setting up Local Voice-to-Text Application..."
echo ""

# Check if SoX is installed
if command -v sox &> /dev/null && command -v rec &> /dev/null; then
    echo "✅ SoX is already installed"
    sox --version
else
    echo "📦 Installing SoX..."
    sudo apt-get update
    sudo apt-get install -y sox libsox-fmt-all

    if command -v sox &> /dev/null; then
        echo "✅ SoX installed successfully"
        sox --version
    else
        echo "❌ Failed to install SoX"
        echo "Please install manually: sudo apt-get install sox libsox-fmt-all"
        exit 1
    fi
fi

echo ""

# Check if xdotool is installed
if command -v xdotool &> /dev/null; then
    echo "✅ xdotool is already installed"
    xdotool --version
else
    echo "📦 Installing xdotool..."
    sudo apt-get install -y xdotool

    if command -v xdotool &> /dev/null; then
        echo "✅ xdotool installed successfully"
        xdotool --version
    else
        echo "❌ Failed to install xdotool"
        echo "Please install manually: sudo apt-get install xdotool"
        exit 1
    fi
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the application, run:"
echo "  npm start"
echo ""
echo "Press F9 key to start/stop recording"
echo "Text will be automatically typed at your cursor position!"
