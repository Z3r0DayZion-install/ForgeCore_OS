# Deterministic Release Manifest Specification
**Version:** v1.0.0  
**Status:** SPEC_LOCKED  

## 1. Goal
Provide a machine-readable proof of build integrity that links the source code (Git Commit) to the final artifacts (Hashes) via a reproducible environment.

## 2. Field Definitions
- **git_commit:** The full SHA-1 hash of the source commit used for the build.
- **SOURCE_DATE_EPOCH:** An integer timestamp used for deterministic build environments (e.g., in ZIP archives or PE headers) to ensure identical outputs across different build times.
- **dependency_hashes:** SHA-256 hashes of all third-party crates and node modules.
- **artifact_hashes:** SHA-256 hashes of the compiled binaries (e.g., `neural-cache.exe`).
- **spec_versions:** Explicit version numbers for core cryptographic models (e.g., `merkle_version: 1`).

## 3. Outsider Verification Flow
1. **Toolchain Setup:** Install the exact Rust and Node versions specified in the `toolchains` section.
2. **Environment:** Export `SOURCE_DATE_EPOCH` to match the manifest value.
3. **Fetch Source:** Clone the repository and `git checkout` the specified `git_commit`.
4. **Compile:** Run `cargo build --release --locked`.
5. **Hash Check:** Generate a SHA-256 hash of the resulting binary.
6. **Comparison:** The hash MUST match the corresponding entry in the `artifacts` array.

## 4. Manifest Integrity
The `manifest.json` artifact itself SHOULD be signed by a known release key (e.g., GPG or Minisign) to prevent tampering with the artifact hashes.
