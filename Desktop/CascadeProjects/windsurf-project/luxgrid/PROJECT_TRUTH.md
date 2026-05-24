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
| Physical OpenRGB hardware | ⏳ Pending |
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

## Next True Gate

**Physical OpenRGB hardware proof.**

Required to advance:

- OpenRGB running on test machine.
- SDK server enabled.
- RGB device detected and listed.
- Color command sent from LuxGrid.
- Physical LEDs visibly change.
- Manual confirmation recorded.
- Hardware artifact folder created.

If you don't have OpenRGB hardware available, document graceful degradation (simulator-only mode).

---

## Renderer Verification Note

Renderer smoke was previously verified during Phase 2I. The Phase 2I artifacts show 6/6 smoke tests passing (Edge) and include timestamped color-change proofs.

During the recent truth-lock run we revalidated build and unit tests; `pnpm smoke:renderer` was not re-run successfully in that context because the dev server was not started, which caused a timeout. This does not invalidate the Phase 2I artifacts.

Current source of truth:
- Renderer proof: verified by Phase 2I artifacts.
- Latest truth-lock run: build and unit tests passed; renderer smoke was not re-run.
- Next gate remains physical OpenRGB hardware proof.
