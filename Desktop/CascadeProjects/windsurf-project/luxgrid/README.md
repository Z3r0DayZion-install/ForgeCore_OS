# LuxGrid™

> Turn your keyboard, mouse, and RGB devices into live signal grids.

---

## 📊 Current Status

LuxGrid is **renderer-smoke-verified** in simulator mode.

| Level | Status |
|---|---|
| **Build** | ✅ PASS |
| **Unit Tests** | ✅ PASS |
| **Renderer Smoke** | ✅ PASS |
| **Simulator RGB Logic** | ✅ PASS |
| **Event Bridge** | ✅ PASS |
| **Physical OpenRGB Hardware** | ⏳ PENDING |
| **Production-Ready** | ❌ NO |

**Next gate:** Physical OpenRGB hardware proof.

For details, see [PROJECT_TRUTH.md](PROJECT_TRUTH.md), [PROOF_LEDGER.md](PROOF_LEDGER.md), and [NEXT_ACTION.md](NEXT_ACTION.md).

---

## Products

- **LuxGrid Studio™** - Visual RGB zone designer
- **LuxGrid Core™** - Backend RGB controller  
- **LuxGrid SDK™** - Event bridge for integrations
- **Snoozurp Bridge™** - Sleep timer integration

## Quick Start

```bash
# Install dependencies
pnpm install

# Start LuxGrid Studio (development)
pnpm dev

# Or start individual components
pnpm core:dev      # Core engine only
pnpm studio:dev    # Studio UI only
pnpm bridge:dev    # Snoozurp bridge only
```

## Structure

```
luxgrid/
├── apps/
│   └── luxgrid-studio/          # Electron + React UI
├── packages/
│   ├── luxgrid-core/            # RGB engine & OpenRGB
│   ├── luxgrid-sdk/             # Event system & schemas
│   └── luxgrid-simulator/       # Hardware simulator
├── integrations/
│   └── snoozurp-bridge/         # Timer event bridge
└── docs/                        # Documentation
```

## Hardware Requirements

- Windows 10/11
- [OpenRGB](https://openrgb.org/) with SDK Server enabled
- RGB keyboard/mouse (any brand supported by OpenRGB)

## First Run

1. Install OpenRGB
2. Start OpenRGB → Settings → SDK Server → Start
3. Run `pnpm dev`
4. Click "Connect" in LuxGrid Studio
5. Your RGB devices should appear

## Validation

```bash
# Run full validation suite
pnpm validate:luxgrid
```

This creates validation artifacts in `validation-artifacts/`.

## Status Policy

| Label | Meaning |
|-------|---------|
| **Implemented** | Code exists but may not have been run |
| **Build-verified** | `pnpm build` passes in a clean workspace |
| **Test-verified** | Named automated tests pass |
| **Smoke-verified** | Renderer or app launches and a documented checklist passes |
| **Hardware-verified** | Real OpenRGB device behavior observed and logged |
| **Production-ready** | Only after all of the above, plus packaging, docs, and repeatable CI |

> **Current Status:** Build-verified and test-verified. Smoke-verification and hardware-verification pending.

## License

MIT - See LICENSE
