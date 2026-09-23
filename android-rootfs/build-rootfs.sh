#!/bin/bash
# Builds the Universal OS Android-edition Linux tree: Debian 13 (arm64) + XFCE
# in the Universal design, plus the VNC/noVNC bridge the app's viewer uses.
# Runs as root inside a debian:trixie arm64 container; writes a .tar.gz to $1.
set -euxo pipefail

OUT="${1:-/out}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
BRAND="$SRC/system_files/usr/share/universal/branding"
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y --no-install-recommends \
    xfce4 xfce4-terminal xfce4-whiskermenu-plugin thunar mousepad ristretto \
    greybird-gtk-theme papirus-icon-theme adwaita-icon-theme \
    fonts-noto-core fonts-noto-mono fonts-noto-color-emoji \
    tigervnc-standalone-server tigervnc-tools novnc websockify \
    dbus dbus-x11 at-spi2-core xdg-utils \
    firefox-esr \
    librsvg2-bin curl ca-certificates \
    sudo nano less procps fastfetch

# --- Universal files (scripts, XFCE defaults, fake /proc entries) -------------
cp -a "$SRC/android-rootfs/overlay/." /
chmod 0755 /usr/local/bin/universal-*

# --- Branding ---------------------------------------------------------------------
mkdir -p /usr/share/backgrounds/universal /usr/share/icons/hicolor/scalable/apps /usr/share/universal/icons
rsvg-convert -w 2560 -h 1600 "$BRAND/wallpaper.svg"       -o /usr/share/backgrounds/universal/meridian.png
rsvg-convert -w 2560 -h 1600 "$BRAND/wallpaper-light.svg" -o /usr/share/backgrounds/universal/glacier.png
cp "$BRAND/logo.svg" /usr/share/icons/hicolor/scalable/apps/universal-logo.svg
gtk-update-icon-cache -f /usr/share/icons/hicolor || true

cat > /etc/os-release <<'EOF'
PRETTY_NAME="Universal OS 1.0 (Meridian) for Android"
NAME="Universal OS"
VERSION="1.0 (Meridian)"
VERSION_ID="1.0"
ID=universal
ID_LIKE=debian
VARIANT="Android edition"
LOGO=universal-logo
EOF

# --- Web apps: AI assistants, Meta, Google (open as Firefox windows) ----------
while IFS='|' read -r id name url domain cats; do
    [ -z "$id" ] && continue
    curl -fsSL --max-time 20 -o "/usr/share/universal/icons/$id.png" \
        "https://www.google.com/s2/favicons?domain=${domain}&sz=128" || true
    cat > "/usr/share/applications/universal-web-$id.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=$name
Comment=$name in its own window
Exec=universal-webapp $url
Icon=/usr/share/universal/icons/$id.png
Terminal=false
Categories=$cats
EOF
done <<'EOF'
claude|Claude|https://claude.ai|claude.ai|Office;Utility;
chatgpt|ChatGPT|https://chatgpt.com|chatgpt.com|Office;Utility;
gemini|Gemini|https://gemini.google.com|gemini.google.com|Office;Utility;
whatsapp|WhatsApp|https://web.whatsapp.com|whatsapp.com|Network;InstantMessaging;
telegram|Telegram|https://web.telegram.org|telegram.org|Network;InstantMessaging;
instagram|Instagram|https://www.instagram.com|instagram.com|Network;
facebook|Facebook|https://www.facebook.com|facebook.com|Network;
messenger|Messenger|https://www.messenger.com|messenger.com|Network;InstantMessaging;
threads|Threads|https://www.threads.com|threads.com|Network;
gmail|Gmail|https://mail.google.com|mail.google.com|Network;Email;
gdrive|Google Drive|https://drive.google.com|drive.google.com|Network;
gcalendar|Google Calendar|https://calendar.google.com|calendar.google.com|Office;Calendar;
gdocs|Google Docs|https://docs.google.com|docs.google.com|Office;
youtube|YouTube|https://www.youtube.com|youtube.com|AudioVideo;Video;
gmaps|Google Maps|https://maps.google.com|maps.google.com|Utility;
EOF

# --- Shrink and pack --------------------------------------------------------------
apt-get clean
rm -rf /var/lib/apt/lists/* /var/cache/apt/*.bin /usr/share/doc/* /usr/share/man/* /var/log/*.log
mkdir -p "$OUT"
tar --one-file-system --numeric-owner -czf "$OUT/universal-rootfs-arm64.tar.gz" \
    --exclude=./src --exclude=./out --exclude='./tmp/*' --exclude='./var/tmp/*' \
    --exclude='./proc/*' --exclude='./sys/*' --exclude='./dev/*' --exclude=./.dockerenv \
    -C / .
cd "$OUT" && sha256sum universal-rootfs-arm64.tar.gz > universal-rootfs-arm64.tar.gz.sha256
ls -lh "$OUT"
