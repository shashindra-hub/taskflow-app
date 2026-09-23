#!/usr/bin/env bash
# Schedules the morning put screener with launchd: weekdays at 9:00 AM in this
# Mac's local timezone. If the Mac is asleep at 9:00, launchd runs it on wake.
#
#   scripts/install-screener.sh +15551234567 [SYMBOLS]   install / update
#   scripts/install-screener.sh --uninstall              remove
#
# The phone number is written only to ~/Library/LaunchAgents (never the repo).
set -euo pipefail

LABEL="com.taskflow.morning-screener"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/taskflow-screener.log"
DOMAIN="gui/$(id -u)"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Removed $LABEL."
  exit 0
fi

PHONE="${1:?Usage: $0 <phone, e.g. +15551234567> [SYMBOLS]}"
SYMBOLS="${2:-MRVL,INTC,TSLA,SPCX,NVDA,SOXL,HOOD}"
NODE="$(command -v node)"
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/server/bin/morning-screener.js"

WEEKDAYS=""
for day in 1 2 3 4 5; do
  WEEKDAYS+="    <dict><key>Weekday</key><integer>$day</integer><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
"
done

mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$SCRIPT</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>SCREENER_PHONE</key><string>$PHONE</string>
    <key>SCREENER_SYMBOLS</key><string>$SYMBOLS</string>
  </dict>
  <key>StartCalendarInterval</key>
  <array>
$WEEKDAYS  </array>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF
chmod 600 "$PLIST"

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST"

echo "Installed $LABEL: weekdays 9:00 AM ($(date +%Z)), symbols $SYMBOLS"
echo "Log: $LOG"
echo "Run now: launchctl kickstart $DOMAIN/$LABEL"
