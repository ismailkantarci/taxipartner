#!/usr/bin/env bash
set -euo pipefail

if [[ "$OSTYPE" != darwin* ]]; then echo "This script is for macOS only."; exit 1; fi

REPO_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
LA_DIR="$HOME/Library/LaunchAgents"
PLIST_ID="com.taxipartner.releasewatch"
PLIST="$LA_DIR/${PLIST_ID}.plist"

mkdir -p "$LA_DIR"
cat > "$PLIST" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>__PLIST_ID__</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>__REPO_DIR__/scripts/local_watch.sh</string>
    <string>start</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>INTERVAL</key><string>5</string>
  </dict>
  <key>WorkingDirectory</key><string>__REPO_DIR__</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>__REPO_DIR__/.local_watch.log</string>
  <key>StandardErrorPath</key><string>__REPO_DIR__/.local_watch.log</string>
</dict>
</plist>
PLIST

sed -i '' -e "s|__PLIST_ID__|$PLIST_ID|g" -e "s|__REPO_DIR__|$REPO_DIR|g" "$PLIST"

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
launchctl start "$PLIST_ID" 2>/dev/null || true
echo "LaunchAgent installed and started: $PLIST"

