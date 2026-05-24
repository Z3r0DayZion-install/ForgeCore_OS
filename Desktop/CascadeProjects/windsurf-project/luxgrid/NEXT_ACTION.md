# LuxGrid™ Next Action

## Do Next

**Run physical OpenRGB hardware proof.**

This is the only remaining gate before considering any new features.

### Steps

```bash
cd luxgrid

# Check if OpenRGB is reachable
pnpm check:openrgb

# If deviceCount > 0, run the color test
pnpm hardware:test-color

# Generate hardware proof artifact if devices exist
pnpm proof:hardware
```

> Note: `deviceCount = 0` blocks hardware proof progression. `pnpm hardware:test-color` and `pnpm proof:hardware` should only be run once OpenRGB reports `deviceCount > 0`.

### Expected Outputs

**If OpenRGB is running and devices are available:**
```
✓ Found OpenRGB SDK Server on 127.0.0.1:6742
✓ Device count: N (> 0)
✓ Devices: [...]
✓ Color test sent
✓ Physical LEDs changed color
```

**If OpenRGB is running but no devices are detected:**
```
✓ Found OpenRGB SDK Server on 127.0.0.1:6742
⚠️ Device count: 0
OpenRGB is connected, but no RGB devices are detected.
Hardware color proof is blocked until deviceCount > 0.
```

**If OpenRGB is not running (graceful):**
```
✗ ECONNREFUSED 127.0.0.1:6742
OpenRGB is not reachable.
Start OpenRGB and enable SDK server.
```

This is **correct behavior**—not a failure.

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
