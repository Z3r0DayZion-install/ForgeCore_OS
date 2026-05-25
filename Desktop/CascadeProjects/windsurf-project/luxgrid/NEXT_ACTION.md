# LuxGrid™ Next Action

## Hardware Proof: COMPLETE (2026-05-25)

Physical OpenRGB hardware proof passed. This gate is closed.

```txt
OpenRGB SDK Server: connected (protocol v5)
Device count: 2 (MSI MPG X570S CARBON MAX WIFI, Roccat Kone XP)
Color sequence: CYAN / RED / GREEN / BLUE — all PASS
Manual visual confirmation: PASS
Artifact: validation-artifacts/luxgrid-hardware-proof-2026-05-25T17-49-56/
```

---

## Do Next

**Standalone repo conversion.**

LuxGrid lives under the parent `forge.git` root (`C:/Users/KickA`). Before any installer, packaging, or distribution work, it must be extracted into its own standalone git repository.

Do not run installer/package/release work until standalone conversion is complete.

---

## Do Not Do Next

Do not start work on any of these until hardware proof is complete:

- ❌ Installer packaging
- ❌ New RGB effects (gradients, chase, etc.)
- ❌ Marketplace / effect sharing
- ❌ Smart lights / Philips Hue integration
- ❌ Device remapping UI
- ❌ NeuralOS integration
- ❌ Audio visualizer
- ❌ Multi-device sync

---

## Why Hardware First?

The entire project's value prop is **controlling physical RGB lights**.

Without proving it works on real hardware:
- We don't know if the OpenRGB protocol implementation is correct.
- We don't know if timing/latency causes issues.
- We don't know if device enumeration handles edge cases.
- Everything else is theater.

Once hardware proof exists, the project is **fundamentally sound** and can move to:
1. Installation & deployment
2. UI polish
3. Advanced features

---

## If No Hardware Available

If there's no OpenRGB device available for testing:

1. Document simulator-only limitations clearly.
2. Create a **Hardware-Unavailable Proof** artifact:
   ```txt
   validation-artifacts/luxgrid-hardware-unavailable-TIMESTAMP/
   ├── LIMITATION.md       # Why no hardware
   ├── SIMULATOR_PROOF.md  # What we CAN prove
   └── NOTE.md             # When hardware becomes available
   ```
3. Mark status as **Simulator-Verified Only**.
4. Hardware proof becomes unblocked future work.

This is honest and leaves a clear path for hardware verification later.

---

## Fix OpenRGB Failure Classification

Do not treat `ENOBUFS` as the same as `ECONNREFUSED`.

Expected states and handling:

- `ECONNREFUSED` = OpenRGB SDK server not running; instruct user to start OpenRGB SDK server.
- `ETIMEDOUT` = host/port unreachable; check network/host firewall or server responsiveness.
- `ENOBUFS` = socket/resource/buffer exhaustion; investigate system socket limits, firewall/VPN interference, or stale processes.
- `connected + 0 devices` = OpenRGB running but no devices detected.
- `connected + devices` = proceed to color test.

Action items for scripts and client:

- Update `check-openrgb.ts`, `hardware-color-test.ts`, and `proof-hardware.ts` to preserve exact error codes and messages in `CHECK_RESULT.json`, `OPENRGB_STATUS.txt`, and `SUMMARY.md`.
- Ensure the OpenRGB client opens only one socket per check, closes/destroys the socket on failure, uses a connection timeout, does not retry in a tight loop, and writes the exact error code to `CHECK_RESULT.json`.
- When `ENOBUFS` occurs, report it clearly with guidance:

```
OpenRGB connection failed with ENOBUFS.
This is not the normal "server not running" state.
Check for socket/resource exhaustion, repeated connection loops, firewall/VPN interference, or stale processes.
```

These checks are intended to prevent misclassification and to provide actionable troubleshooting steps for maintainers.
