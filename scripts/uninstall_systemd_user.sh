#!/usr/bin/env bash
set -euo pipefail

if ! systemctl --version >/dev/null 2>&1; then echo "systemd not found"; exit 0; fi

systemctl --user disable --now releasewatch.service 2>/dev/null || true
rm -f "$HOME/.config/systemd/user/releasewatch.service"
systemctl --user daemon-reload
echo "systemd user service removed"

