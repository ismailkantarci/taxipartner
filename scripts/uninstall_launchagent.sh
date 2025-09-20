#!/usr/bin/env bash
set -euo pipefail

PLIST_ID="com.taxipartner.releasewatch"
PLIST="$HOME/Library/LaunchAgents/${PLIST_ID}.plist"

launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
echo "LaunchAgent removed: $PLIST"

