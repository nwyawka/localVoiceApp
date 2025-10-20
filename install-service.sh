#!/bin/bash

echo "Installing Voice-to-Text as a background service..."
echo ""

# Create systemd user directory if it doesn't exist
mkdir -p ~/.config/systemd/user

# Copy service file to systemd user directory
cp voice-to-text.service ~/.config/systemd/user/

# Reload systemd
systemctl --user daemon-reload

# Enable service to start on boot
systemctl --user enable voice-to-text.service

# Start the service now
systemctl --user start voice-to-text.service

echo ""
echo "✅ Service installed and started!"
echo ""
echo "Service commands:"
echo "  Check status:  systemctl --user status voice-to-text"
echo "  Stop service:  systemctl --user stop voice-to-text"
echo "  Start service: systemctl --user start voice-to-text"
echo "  Restart:       systemctl --user restart voice-to-text"
echo "  View logs:     journalctl --user -u voice-to-text -f"
echo "  Disable:       systemctl --user disable voice-to-text"
echo ""
echo "The service is now running in the background!"
echo "Press F9 to start/stop voice recording from anywhere!"
