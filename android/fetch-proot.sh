#!/usr/bin/env bash
# Downloads Termux's arm64 builds of proot (GPL-2.0) and libtalloc (LGPL-3.0)
# and places them in the APK as native libraries:
#   libproot.so, libproot-loader.so, libtalloc.so
# Sources: https://github.com/termux/proot and https://github.com/termux/termux-packages
set -euo pipefail

BASE=https://packages.termux.dev/apt/termux-main
DEST="$(cd "$(dirname "$0")" && pwd)/app/src/main/jniLibs/arm64-v8a"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

curl -fsSL "$BASE/dists/stable/main/binary-aarch64/Packages" -o "$WORK/Packages"
filename() { awk -v p="$1" '$1=="Package:"{c=($2==p)} c && $1=="Filename:"{print $2; exit}' "$WORK/Packages"; }

for pkg in proot libtalloc; do
    f="$(filename "$pkg")"
    [ -n "$f" ] || { echo "Package $pkg not found in the Termux index" >&2; exit 1; }
    echo "Fetching $f"
    curl -fsSL "$BASE/$f" -o "$WORK/$pkg.deb"
    mkdir -p "$WORK/$pkg"
    (cd "$WORK/$pkg" && ar x "../$pkg.deb" && tar -xf data.tar.*)
done

USR=data/data/com.termux/files/usr
mkdir -p "$DEST"
cp "$WORK/proot/$USR/bin/proot"             "$DEST/libproot.so"
cp "$WORK/proot/$USR/libexec/proot/loader"  "$DEST/libproot-loader.so"
cp -L "$(ls "$WORK/libtalloc/$USR/lib/"libtalloc.so.2* | head -n1)" "$DEST/libtalloc.so"
chmod 0755 "$DEST"/*.so

ls -l "$DEST"
echo "proot needs:"; readelf -d "$DEST/libproot.so" | grep NEEDED || true
