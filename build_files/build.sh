#!/usr/bin/bash
# Universal OS image build script. Runs once inside the Containerfile.
set -ouex pipefail

BRAND=/usr/share/universal/branding

### 1. Runtimes and shell packages ############################################
# Required: the build fails if any of these are missing.
dnf5 install -y \
    waydroid \
    wine \
    winetricks \
    kdialog \
    librsvg2-tools \
    file \
    sqlite \
    plymouth-theme-spinner

# First-boot setup wizard (creates the user account before the desktop starts)
dnf5 install -y \
    initial-setup \
    initial-setup-gui \
    initial-setup-gui-wayland-plasma

# Google account integration: KDE Online Accounts + Google Drive in Dolphin
dnf5 install -y \
    kaccounts-providers \
    kio-gdrive

# Nice to have: skipped quietly if a Fedora release drops or renames them.
dnf5 install -y --skip-unavailable \
    plasma-mobile \
    maliit-keyboard \
    fastfetch \
    distrobox

### 2. Services #################################################################
# Android runtime container manager (the Android system itself is downloaded
# on first use by `universal-android-setup`, it is ~1 GB).
systemctl enable waydroid-container.service
# First-boot account wizard. A drop-in (system_files) limits it to machines
# that have no user account yet, so switching an existing system skips it.
systemctl enable initial-setup.service
# First boot with network: install Chrome + Telegram, fetch web-app icons.
systemctl enable universal-apps-setup.service

### 3. Branding: render SVG sources to the bitmaps Plasma expects ##############
WPD=/usr/share/wallpapers/Universal/contents
mkdir -p "$WPD/images" "$WPD/images_dark" /usr/share/icons/hicolor/scalable/apps /usr/share/pixmaps
for size in 3840x2160 2560x1600 1920x1080; do
    w=${size%x*}; h=${size#*x}
    rsvg-convert -w "$w" -h "$h" "$BRAND/wallpaper.svg"       -o "$WPD/images_dark/$size.png"
    rsvg-convert -w "$w" -h "$h" "$BRAND/wallpaper-light.svg" -o "$WPD/images/$size.png"
done
rsvg-convert -w 1920 -h 1080 "$BRAND/wallpaper.svg" -o "$WPD/screenshot.png"
cp "$BRAND/logo.svg" /usr/share/icons/hicolor/scalable/apps/universal-logo.svg
rsvg-convert -w 256 -h 256 "$BRAND/logo.svg" -o /usr/share/pixmaps/universal-logo.png
gtk-update-icon-cache -f /usr/share/icons/hicolor || true

### 4. Boot splash (Plymouth) ##################################################
PT=/usr/share/plymouth/themes/universal
mkdir -p "$PT"
cp -a /usr/share/plymouth/themes/spinner/. "$PT/"
rm -f "$PT"/*.plymouth
rsvg-convert -w 128 -h 128 "$BRAND/logo.svg" -o "$PT/watermark.png"
cat > "$PT/universal.plymouth" <<'EOF'
[Plymouth Theme]
Name=Universal
Description=Universal OS boot splash
ModuleName=two-step

[two-step]
ImageDir=/usr/share/plymouth/themes/universal
DialogHorizontalAlignment=.5
DialogVerticalAlignment=.382
TitleHorizontalAlignment=.5
TitleVerticalAlignment=.382
HorizontalAlignment=.5
VerticalAlignment=.72
WatermarkHorizontalAlignment=.5
WatermarkVerticalAlignment=.45
Transition=none
TransitionDuration=0.0
BackgroundStartColor=0x0b1420
BackgroundEndColor=0x0b1420

[boot-up]
UseEndAnimation=false

[shutdown]
UseEndAnimation=false

[reboot]
UseEndAnimation=false
EOF
plymouth-set-default-theme universal
# The splash lives in the initramfs, so rebuild it for the image's kernel.
KVER="$(ls /usr/lib/modules | sort -V | tail -n1)"
dracut --no-hostonly --kver "$KVER" --reproducible --add ostree -f "/usr/lib/modules/$KVER/initramfs.img"
chmod 0600 "/usr/lib/modules/$KVER/initramfs.img"

### 5. Web apps: AI assistants, Meta and Google ################################
# Each opens in its own Chrome app window with its own launcher and dock icon.
# Icons are fetched on first boot into /var/lib/universal/icons.
#   id | name | url | categories | keywords
while IFS='|' read -r id name url cats keys; do
    [ -z "$id" ] && continue
    host="${url#https://}"; host="${host%%/*}"
    cat > "/usr/share/applications/universal-web-$id.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=$name
Comment=$name in its own window
Exec=universal-webapp $url
Icon=/var/lib/universal/icons/$id.png
Terminal=false
Categories=$cats
Keywords=$keys
StartupWMClass=chrome-${host}__-Default
EOF
done <<'EOF'
claude|Claude|https://claude.ai|Office;Utility;|ai;assistant;anthropic;chat;
chatgpt|ChatGPT|https://chatgpt.com|Office;Utility;|ai;assistant;openai;gpt;chat;
gemini|Gemini|https://gemini.google.com|Office;Utility;|ai;assistant;google;chat;
whatsapp|WhatsApp|https://web.whatsapp.com|Network;InstantMessaging;|meta;chat;messages;
instagram|Instagram|https://www.instagram.com|Network;|meta;photos;social;
facebook|Facebook|https://www.facebook.com|Network;|meta;social;
messenger|Messenger|https://www.messenger.com|Network;InstantMessaging;|meta;chat;messages;
threads|Threads|https://www.threads.com|Network;|meta;social;
gmail|Gmail|https://mail.google.com|Network;Email;|google;mail;email;
gdrive|Google Drive|https://drive.google.com|Network;FileTransfer;|google;drive;files;cloud;
gcalendar|Google Calendar|https://calendar.google.com|Office;Calendar;|google;calendar;events;
gdocs|Google Docs|https://docs.google.com|Office;WordProcessor;|google;docs;sheets;slides;
youtube|YouTube|https://www.youtube.com|AudioVideo;Video;|google;video;
gmaps|Google Maps|https://maps.google.com|Utility;Maps;|google;maps;directions;
gmeet|Google Meet|https://meet.google.com|Network;VideoConference;|google;meet;video;call;
EOF

### 6. Identify as Universal OS ###############################################
# ID stays "fedora" so package tooling keeps working; names and logo change.
sed -i \
    -e 's/^NAME=.*/NAME="Universal OS"/' \
    -e 's/^PRETTY_NAME=.*/PRETTY_NAME="Universal OS 1.0 (Meridian)"/' \
    -e 's/^LOGO=.*/LOGO=universal-logo/' \
    /usr/lib/os-release
grep -q '^VARIANT_ID=' /usr/lib/os-release \
    && sed -i 's/^VARIANT_ID=.*/VARIANT_ID=universal/' /usr/lib/os-release \
    || echo 'VARIANT_ID=universal' >> /usr/lib/os-release
grep -q '^LOGO=' /usr/lib/os-release || echo 'LOGO=universal-logo' >> /usr/lib/os-release
grep -q '^IMAGE_NAME=' /usr/lib/os-release || echo 'IMAGE_NAME="universal-os"' >> /usr/lib/os-release

### 7. Permissions on our tools ################################################
chmod 0755 /usr/bin/universal-* /usr/libexec/universal/*

### 8. Register launchers and file associations ###############################
update-desktop-database /usr/share/applications || true
