#!/bin/bash
# Launcher script for Voice-to-Text App
# Opens a compact terminal window sized exactly for the app

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Capture user's audio environment before sudo
PULSE_SERVER_VAR="${PULSE_SERVER:-unix:/run/user/$UID/pulse/native}"
XDG_RUNTIME_DIR_VAR="${XDG_RUNTIME_DIR:-/run/user/$UID}"

# Launch gnome-terminal with specific geometry (60 columns x 8 rows)
# Note: sudo required for global keyboard listener (F9 key capture)
# Explicitly preserve audio environment for PulseAudio access
gnome-terminal --geometry=60x8 --title="Voice-to-Text" --hide-menubar -- bash -c "cd '$APP_DIR' && sudo -E PULSE_SERVER='$PULSE_SERVER_VAR' XDG_RUNTIME_DIR='$XDG_RUNTIME_DIR_VAR' npm start; exec bash"
