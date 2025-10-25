#!/bin/bash
# Wrapper to run rec as the original user (not root) when app runs with sudo
# This preserves audio device access while allowing keyboard capture

if [ -n "$SUDO_USER" ]; then
    # Running with sudo - execute rec as the original user
    sudo -u "$SUDO_USER" rec "$@"
else
    # Not running with sudo - just run rec normally
    rec "$@"
fi
