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

## Hardware Proof (Phase 3B — VERIFIED 2026-05-25)

Hardware proof is **complete**. Physical RGB color changes confirmed on real hardware.

### Hardware PASS Results

| Criterion | Result |
|---|---|
| OpenRGB SDK Server running on port 6742 | ✅ PASS |
| Protocol version | 5 |
| Device count reported >= 1 | ✅ PASS (count: 2) |
| Devices enumerated | MSI MPG X570S CARBON MAX WIFI (MS-7D52), Roccat Kone XP |
| Color commands sent (CYAN/RED/GREEN/BLUE) | ✅ PASS |
| Physical RGB LEDs visibly change color | ✅ PASS |
| Manual visual confirmation | ✅ PASS (user confirmed) |
| Hardware artifact folder created | ✅ PASS |

### Artifact Location

```txt
validation-artifacts/luxgrid-hardware-proof-2026-05-25T17-49-56/
validation-artifacts/hardware-proof-latest/
  - HARDWARE_COLOR_TEST.json
  - HARDWARE_CONFIRMATION.json
  - HARDWARE_TEST_RESULT.json
  - OPTIONAL_PHOTO_OR_SCREENSHOT_TODO.md
```

### Caveat

Hardware color proof selected MSI motherboard device by fallback.
OpenRGB reported LEDs: 0 and Zones: 0 for selected device.
Manual visual confirmation was yes — physical RGB changed on hardware.
Future improvement: better device targeting, zone/LED readback, and explicit Roccat Kone XP test.

---

## Validation Artifact History

All timestamped proofs are stored in:
```txt
validation-artifacts/luxgrid-studio-mvp-YYYY-MM-DD-HHMM/
validation-artifacts/luxgrid-hardware-proof-YYYY-MM-DDTHH-MM-SS/
```

Check `validation-artifacts/latest-renderer-debug/` for the most recent render test.
