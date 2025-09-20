#!/usr/bin/env bash
set -euo pipefail

if ! systemctl --version >/dev/null 2>&1; then echo "systemd not found"; exit 1; fi

REPO_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
UNIT_DIR="$HOME/.config/systemd/user"
UNIT_FILE="$UNIT_DIR/releasewatch.service"

mkdir -p "$UNIT_DIR"
cat > "$UNIT_FILE" <<EOF
[Unit]
Description=Local Auto Release Watcher

[Service]
Type=simple
ExecStart=/usr/bin/env python3 ${REPO_DIR}/scripts/local_watch_auto_release.py --interval 5
WorkingDirectory=${REPO_DIR}
Restart=always
RestartSec=3
EnvironmentFile=%h/.tp_admin.env

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now releasewatch.service
echo "systemd user service installed and started: $UNIT_FILE"
