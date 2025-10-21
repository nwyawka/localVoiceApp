#!/bin/bash
# Launcher script for Voice-to-Text App
# Opens a compact terminal window sized exactly for the app

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Launch gnome-terminal with specific geometry (60 columns x 8 rows)
gnome-terminal --geometry=60x8 --title="Voice-to-Text" --hide-menubar -- bash -c "cd '$APP_DIR' && npm start; exec bash"
