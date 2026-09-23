# Universal OS

A real, installable operating system for x86_64 PCs, built on Fedora Atomic (KDE Plasma).
It's Phase 1 of the Universal OS architecture: one system that runs **Linux**, **Android** and
**Windows** programs, with a desktop that also has a touch/tablet mode.

| | |
|---|---|
| Base | Fedora Atomic Kinoite via Universal Blue `kinoite-main` (includes media codecs) |
| Updates | Image-based, atomic, with rollback (`bootc`). A bad update never breaks boot: pick the previous entry. |
| Desktop | KDE Plasma 6 with the Universal layout: top bar with global menu, centred floating dock, Meridian wallpaper, teal accent |
| Touch | Plasma tablet mode (`universal-mode touch`) and a **Plasma Mobile** session for a phone-style home screen |
| Android apps | Waydroid (LineageOS container). Double-click an `.apk` to install it. |
| Windows apps | Wine. Double-click an `.exe` or `.msi`; each program gets its own drive C:. |
| Linux apps | Flatpak (Flathub), native packages, and `distrobox` for any other distro |
| Secure Boot | Works: Fedora's signed shim and kernel |

## Install it

### Option A — installer ISO (new or spare PC, or a virtual machine)

1. Open this repository on GitHub → **Actions** → **Build Universal OS installer ISO** → latest green run →
   download **universal-os-x86_64-iso** (a zip containing the `.iso` and its SHA-256).
2. Write the ISO to a USB stick (8 GB+) with [Fedora Media Writer](https://fedoraproject.org/workstation/download),
   [Rufus](https://rufus.ie) (choose **DD image** mode) or [Ventoy](https://www.ventoy.net).
3. Boot the PC from the USB stick (usually F12, F11, Esc or F8 at power-on).
4. The installer asks for language, disk and time zone, then installs.
   **Installing erases the disk you pick.** To keep Windows, shrink its partition first and choose the free space.
5. Reboot. Before the desktop opens, the **setup wizard** asks you to create your account
   (name, username, password). Universal OS can't be used without one, and the login screen asks for it every time.
6. On your first login, **Welcome** opens and offers to:
   - **Sign in with Google**, which adds Google Drive to the Files app under *Network*
   - install **Google Chrome**
   - set up the **Google Play Store** for Android apps

To try it without touching your PC, create a VM in VirtualBox or virt-manager
(UEFI on, 4 GB+ RAM, 40 GB+ disk) and boot the ISO. In Hyper-V, use a Generation 2 VM and set Secure Boot's template
to **Microsoft UEFI Certificate Authority**.

### Option B — switch an existing Fedora Atomic system (Kinoite, Silverblue, Bazzite, Aurora…)

```bash
sudo bootc switch ghcr.io/OWNER/universal-os:latest
systemctl reboot
```

Replace `OWNER` with the lowercase GitHub account that builds the image. Your files are kept.
To go back: `sudo bootc rollback` and reboot.

## First steps after installing

| To… | Do this |
|---|---|
| Connect Google again | Open **Welcome** from the launcher, or System Settings → **Online Accounts** |
| Run Android apps | Open **Set Up Android Runtime** once (downloads ~1 GB), then double-click any `.apk` |
| Android with Google Play | `universal-android-setup --gapps`, then register the device ID it shows at google.com/android/uncertified (Google requires this for custom Android devices) |
| Run a Windows program | Double-click the `.exe`/`.msi`, or `universal-open setup.exe` |
| See all runtimes | Open **Runtimes** in the dock, or run `universal-runtimes` |
| Touch / desktop behaviour | `universal-mode touch`, `universal-mode desktop`, `universal-mode auto` |
| Phone-style home screen | Log out and choose the **Plasma Mobile** session |
| Update | Automatic in the background; or `sudo bootc upgrade` then reboot |
| Install apps | **Discover** (Flathub), or `flatpak install …` |

## Build it yourself

Everything is built by GitHub Actions, so you don't need Linux locally:

1. Push this folder to a GitHub repository (public repos get free Actions minutes and storage).
2. **Build Universal OS image** runs on every push and publishes `ghcr.io/<owner>/universal-os`.
3. **Build Universal OS installer ISO** runs after it and uploads the ISO as a workflow artifact.
4. In GitHub → your profile → **Packages** → `universal-os` → **Package settings**, set visibility to **Public**
   so installed systems can download updates without logging in.

On a Linux machine you can also build locally:

```bash
sudo podman build -t localhost/universal-os:latest .
sudo podman run --rm -it --privileged --pull=newer \
  --security-opt label=type:unconfined_t \
  -v ./disk_config/iso.toml:/config.toml:ro -v ./output:/output \
  -v /var/lib/containers/storage:/var/lib/containers/storage \
  quay.io/centos-bootc/bootc-image-builder:latest \
  --type anaconda-iso --use-librepo=True localhost/universal-os:latest
```

## Layout

```
Containerfile                 image definition (base + our layer)
build_files/build.sh          packages, services, branding, os-release
system_files/                 copied into the OS root
  usr/bin/universal-open          runtime dispatcher (.apk → Android, .exe → Windows, …)
  usr/bin/universal-android-setup one-time Android runtime setup
  usr/bin/universal-runtimes      runtime status
  usr/bin/universal-mode          touch / desktop switch
  usr/share/plasma/look-and-feel/org.universal.desktop   desktop layout and theme
  usr/share/universal/branding    logo + wallpaper sources (SVG)
  etc/xdg/                        system defaults (theme, file associations)
disk_config/iso.toml          installer settings
.github/workflows/            image + ISO builds
```

## Current limits

- **PCs only (x86_64).** Phones need a separate port for each device. The planned route is postmarketOS with Plasma Mobile on devices it supports well (for example OnePlus 6/6T).
- **Google account:** your Universal OS login is a local account. Google is connected after login (like on Linux or macOS), not used as the login itself.
  Google Drive access uses KDE's Google sign-in. If Google ever blocks it, use Drive in Chrome instead.
- **Android:** apps that require Google Play Integrity (banking, some games) won't run. ARM-only apps need an ARM translation layer, which isn't included.
- **Windows:** games with kernel anti-cheat, and drivers, don't run. For games, install Steam from Discover and use Proton.
- **macOS/iOS apps** aren't supported.
