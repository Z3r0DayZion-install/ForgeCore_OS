FROM debian:bullseye

RUN apt-get update && apt-get install -y \
    live-build \
    squashfs-tools \
    xorriso \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /iso_builder

# The actual build script will be mounted or executed here.
CMD ["/bin/bash", "-c", "lb config -d bullseye --archive-areas 'main contrib non-free' && lb build"]