#!/usr/bin/env bash
# Downloads Termux's arm64 builds of proot (GPL-2.0) and the libraries it needs
# (libtalloc LGPL-3.0, libandroid-shmem BSD-3-Clause) and places them in the APK
# as native libraries:
#   libproot.so, libproot-loader.so, libtalloc.so, libandroid-shmem.so
# Sources: https://github.com/termux/proot and https://github.com/termux/termux-packages
set -euo pipefail

BASE=https://packages.termux.dev/apt/termux-main
DEST="$(cd "$(dirname "$0")" && pwd)/app/src/main/jniLibs/arm64-v8a"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
USR=data/data/com.termux/files/usr

curl -fsSL "$BASE/dists/stable/main/binary-aarch64/Packages" -o "$WORK/Packages"
filename() { awk -v p="$1" '$1=="Package:"{c=($2==p)} c && $1=="Filename:"{print $2; exit}' "$WORK/Packages"; }

for pkg in proot libtalloc libandroid-shmem; do
    f="$(filename "$pkg")"
    [ -n "$f" ] || { echo "Package $pkg not found in the Termux index" >&2; exit 1; }
    echo "Fetching $f"
    curl -fsSL "$BASE/$f" -o "$WORK/$pkg.deb"
    mkdir -p "$WORK/$pkg"
    (cd "$WORK/$pkg" && ar x "../$pkg.deb" && tar -xf data.tar.*)
done

rm -rf "$DEST"; mkdir -p "$DEST"
cp "$WORK/proot/$USR/bin/proot"                "$DEST/libproot.so"
cp "$WORK/proot/$USR/libexec/proot/loader"     "$DEST/libproot-loader.so"
cp -L "$(ls "$WORK/libtalloc/$USR/lib/"libtalloc.so.2* | head -n1)" "$DEST/libtalloc.so"
cp -L "$WORK/libandroid-shmem/$USR/lib/libandroid-shmem.so"          "$DEST/libandroid-shmem.so"
chmod 0755 "$DEST"/*.so
ls -l "$DEST"

# Every library these binaries need must be either part of Android itself or
# shipped in the APK (libtalloc.so.2 is provided as libtalloc.so + a symlink).
ANDROID_LIBS="libc.so libdl.so libm.so liblog.so"
SHIPPED="libtalloc.so.2 libandroid-shmem.so"
missing=0
for so in "$DEST"/*.so; do
    for need in $(readelf -d "$so" | awk '/NEEDED/ {gsub(/[\[\]]/, "", $NF); print $NF}'); do
        echo "$(basename "$so") needs $need"
        case " $ANDROID_LIBS $SHIPPED " in
            *" $need "*) ;;
            *) echo "ERROR: $need is not bundled" >&2; missing=1 ;;
        esac
    done
done
[ "$missing" = 0 ] || exit 1
echo "All proot dependencies are bundled."
