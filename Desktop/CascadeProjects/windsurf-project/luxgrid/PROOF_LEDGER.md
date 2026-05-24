# LuxGrid™ Proof Ledger

## Verified Renderer Proof (Phase 2I)

Renderer smoke tests, color transitions, and event integration passing.

### Known Verified Color Changes

| Zone | Control/Event | Before | After | Result |
|---|---|---|---|---|
| ArrowUp | CPU Temp 90°C | `#5500aa` | `#ff0000` | ✅ PASS |
| Key-1 | Memory 85% | `#669900` | `#d82600` | ✅ PASS |
| Key-Q | Timer 50% | `#00ff64` | `#7f7f64` | ✅ PASS |
| Key-Q | Snoozurp Event | `#00ff64` | `#ff0064` | ✅ PASS |

---

## Expected Renderer Artifacts

The following files should exist in `validation-artifacts/luxgrid-studio-mvp-*/` :

```txt
SUMMARY.md                      # Phase result summary
STUDIO_PROOF.json               # Boot + connectivity proof
RENDERER_SMOKE.json             # Renderer load proof
COLOR_CHANGE.json               # CPU slider color transition
MEMORY_COLOR_CHANGE.json        # Memory slider color transition
TIMER_COLOR_CHANGE.json         # Timer slider color transition
EVENT_MONITOR_PROOF.json        # Snoozurp event reception
SLIDER_CHANGE_SCREENSHOT.png    # Visual confirmation of slider
TIMER_CHANGE_SCREENSHOT.png     # Visual confirmation of timer
EVENT_MONITOR_SCREENSHOT.png    # Visual confirmation of event
```

Run `pnpm proof:studio` to generate new renderer artifacts.

---

## Hardware Proof (Pending)

Hardware proof is **not yet completed**.

### Hardware PASS Criteria

- ✅ OpenRGB SDK Server running on port 6742
- ✅ Device count reported >= 1
- ✅ Device details populated
- ✅ Color commands sent successfully
- ✅ Physical RGB LEDs visibly change color
- ✅ Manual visual confirmation recorded
- ✅ Hardware artifact folder created with timestamp

Run:
```bash
pnpm check:openrgb
pnpm hardware:test-color
pnpm proof:hardware
```

If OpenRGB is unavailable, expected graceful failure:
```txt
ECONNREFUSED 127.0.0.1:6742
OpenRGB is not reachable.
Start OpenRGB and enable SDK server.
```

This is **not a crash**—it's correct handling of missing hardware.

---

## Validation Artifact History

All timestamped proofs are stored in:
```txt
validation-artifacts/luxgrid-studio-mvp-YYYY-MM-DD-HHMM/
validation-artifacts/luxgrid-hardware-proof-YYYY-MM-DDTHH-MM-SS/
```

Check `validation-artifacts/latest-renderer-debug/` for the most recent render test.
