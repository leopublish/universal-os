# Universal OS — bootable image definition
#
# Base: Universal Blue "kinoite-main" = Fedora Atomic (Kinoite, KDE Plasma)
# with codecs and hardware enablement. The result is a bootc container image:
# it can be installed from an ISO, or switched to from any Fedora Atomic system
# with `bootc switch`, and it updates atomically with rollback (A/B style).

# Build scripts live in a throwaway stage so they don't end up in the image.
FROM scratch AS ctx
COPY build_files /

FROM ghcr.io/ublue-os/kinoite-main:latest

# Files copied verbatim into the root filesystem (branding, scripts, defaults).
COPY system_files /

RUN --mount=type=bind,from=ctx,source=/,target=/ctx \
    --mount=type=cache,dst=/var/cache \
    --mount=type=cache,dst=/var/log \
    --mount=type=tmpfs,dst=/tmp \
    bash /ctx/build.sh && \
    ostree container commit

# Fail the build early if the image is not a valid bootc image.
RUN bootc container lint
