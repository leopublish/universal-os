#!/usr/bin/bash
# Universal OS image build script. Runs once inside the Containerfile.
set -ouex pipefail

### 1. Runtimes and shell packages ############################################
# Required: the build fails if any of these are missing.
dnf5 install -y \
    waydroid \
    wine \
    winetricks \
    kdialog \
    librsvg2-tools \
    file \
    sqlite

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

### 3. Branding: render SVG sources to the bitmaps Plasma expects ##############
BRAND=/usr/share/universal/branding
WP=/usr/share/wallpapers/Universal/contents/images
mkdir -p "$WP" /usr/share/icons/hicolor/scalable/apps /usr/share/pixmaps
for size in 3840x2160 2560x1600 1920x1080; do
    w=${size%x*}; h=${size#*x}
    rsvg-convert -w "$w" -h "$h" "$BRAND/wallpaper.svg" -o "$WP/$size.png"
done
rsvg-convert -w 1920 -h 1080 "$BRAND/wallpaper.svg" -o /usr/share/wallpapers/Universal/contents/screenshot.png
cp "$BRAND/logo.svg" /usr/share/icons/hicolor/scalable/apps/universal-logo.svg
rsvg-convert -w 256 -h 256 "$BRAND/logo.svg" -o /usr/share/pixmaps/universal-logo.png
gtk-update-icon-cache -f /usr/share/icons/hicolor || true

### 4. Identify as Universal OS ###############################################
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

### 5. Permissions on our tools ################################################
chmod 0755 /usr/bin/universal-* /usr/libexec/universal/*

### 6. Make .apk and Windows programs open with the runtime dispatcher #######
update-desktop-database /usr/share/applications || true
