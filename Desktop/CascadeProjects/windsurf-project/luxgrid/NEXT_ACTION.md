# LuxGrid™ Next Action

## Do Next

**Run physical OpenRGB hardware proof.**

This is the only remaining gate before considering any new features.

### Steps

```bash
cd luxgrid

# Check if OpenRGB is reachable
pnpm check:openrgb

# Test color commands if device found
pnpm hardware:test-color

# Generate hardware proof artifact
pnpm proof:hardware
```

### Expected Outputs

**If OpenRGB is running:**
```
✓ Found OpenRGB SDK Server on 127.0.0.1:6742
✓ Device count: N
✓ Devices: [...]
✓ Color test sent
✓ Physical LEDs changed color
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
