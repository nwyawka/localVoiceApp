#!/bin/bash
# Wrapper to run rec as the original user (not root) when app runs with sudo
# This preserves audio device access while allowing keyboard capture

if [ -n "$SUDO_USER" ]; then
    # Running with sudo - execute rec as the original user
    # Preserve audio environment variables for PulseAudio access
    SUDO_UID_VAR=$(id -u "$SUDO_USER")
    sudo -u "$SUDO_USER" \
        XDG_RUNTIME_DIR="/run/user/$SUDO_UID_VAR" \
        PULSE_SERVER="unix:/run/user/$SUDO_UID_VAR/pulse/native" \
        rec "$@"
else
    # Not running with sudo - just run rec normally
    rec "$@"
fi
