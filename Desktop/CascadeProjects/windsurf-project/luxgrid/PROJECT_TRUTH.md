# LuxGrid™ Project Truth

**LuxGrid™ is the active primary RGB control project.**

The old `repos/rgb-controller`, `repos/sleeptimer-core`, `repos/sleeptimer-gui`, and `repos/sleeptimer-sdk` are legacy/separated prototypes unless explicitly revived.

---

## Current Verified Status

| Area | Status |
|---|---|
| Install | ✅ Verified |
| Build | ✅ Verified |
| Unit tests | ✅ Verified |
| Renderer boot | ✅ Verified |
| Renderer smoke | ✅ Verified |
| Simulator RGB logic | ✅ Verified |
| CPU slider → ArrowUp color | ✅ Verified |
| Memory slider → number row color | ✅ Verified |
| Timer slider → QWERTY color | ✅ Verified |
| Snoozurp event → QWERTY color | ✅ Verified |
| OpenRGB failure handling | ✅ Verified |
| Physical OpenRGB hardware | ✅ Verified |
| Production-ready | ❌ No |

---

## Do Not Regress

Do not claim:

- ~~Studio renderer is missing.~~
- ~~Tests are unverified.~~
- ~~Dev mode is pending.~~
- ~~LuxGrid is production-ready.~~
- ~~Hardware is verified.~~

These were true during earlier phases. Current truth is above.

---

## Phase Truth Summary

| Phase | Status |
|---|---|
| Phase 2 renderer/simulator proof | VERIFIED |
| Phase 3 OpenRGB SDK connection | VERIFIED |
| Phase 3 OpenRGB device enumeration | VERIFIED |
| Phase 3 physical hardware color proof | VERIFIED |
| Production readiness | NOT CLAIMED |
| Standalone repo conversion | STILL REQUIRED BEFORE RELEASE WORK |

---

## Hardware Proof Caveat

Hardware color proof selected MSI motherboard device by fallback.
OpenRGB reported LEDs: 0 and Zones: 0 for selected device.
Manual visual confirmation was yes — physical RGB changed on hardware.
Future improvement: better device targeting, zone/LED readback, and explicit Roccat Kone XP test.

---

## Completed Gate

Physical OpenRGB hardware proof is **COMPLETE** as of 2026-05-25.

Artifact: `validation-artifacts/luxgrid-hardware-proof-2026-05-25T17-49-56/`

- OpenRGB SDK Server: connected, protocol v5
- Devices found: 2 (MSI MPG X570S CARBON MAX WIFI, Roccat Kone XP)
- Color sequence: CYAN / RED / GREEN / BLUE — all PASS
- Manual visual confirmation: PASS

---

## Next True Gate

**Standalone repo conversion before any release work.**

LuxGrid still lives under the parent `forge.git` root (`C:/Users/KickA`). It must be extracted into its own standalone repository before installer, packaging, or distribution work begins.

---

## Renderer Verification Note

Renderer smoke was previously verified during Phase 2I. The Phase 2I artifacts show 6/6 smoke tests passing (Edge) and include timestamped color-change proofs.

During the recent truth-lock run we revalidated build and unit tests; `pnpm smoke:renderer` was not re-run successfully in that context because the dev server was not started, which caused a timeout. This does not invalidate the Phase 2I artifacts.

Current source of truth:
- Renderer proof: verified by Phase 2I artifacts.
- Latest truth-lock run: build and unit tests passed; renderer smoke was not re-run.
- Next gate remains physical OpenRGB hardware proof.
