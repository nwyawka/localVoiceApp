#!/bin/bash

echo "Uninstalling Voice-to-Text service..."
echo ""

# Stop the service
systemctl --user stop voice-to-text.service

# Disable the service
systemctl --user disable voice-to-text.service

# Remove service file
rm -f ~/.config/systemd/user/voice-to-text.service

# Reload systemd
systemctl --user daemon-reload

echo ""
echo "✅ Service uninstalled!"
echo ""
echo "You can still run the app manually with: npm start"
