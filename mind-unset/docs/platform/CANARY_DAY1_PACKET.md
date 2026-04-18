# Day 1 External Canary Packet

Status: Ready to execute
Date: 2026-04-18

## Purpose of the Canary

Validate real-world operator adoption on clean environments and confirm that MindUnset can be installed, launched, and used without direct internal assistance.

## Scope Clarification

- MindUnset buyer delivery canary scope is Windows x64 only.

NeuralBook Platform Testing Note

macOS/Linux validation belongs to NeuralBook platform testing, not the MindUnset Gumroad buyer canary. The MindUnset buyer canary is scoped to supported Windows x64 systems only.

## Who the Tester Is

- External operator (not part of internal build team)
- Comfortable using desktop apps but not required to be technical
- Uses their own machine and browser setup

## Exact Setup Commands

For MindUnset buyer canary (Windows x64):

### Windows

```powershell
cd C:\Users\<operator>\Downloads\MindUnset
powershell -ExecutionPolicy Bypass -File launcher\launch_mindunset.ps1 -OpenSelfCheck
```

### Windows (quick launch)

```bat
launcher\launch_mindunset.bat
```

### Validation Commands (internal verifier only)

Internal verifier command, run from repo root:

```powershell
python -m pytest -q tests --lane cold_start
```

External operators should not be required to run pytest unless they are specifically testing the NeuralBook platform development workflow.

## Exact Success Criteria

- Startup self-check page opens
- Runtime integrity checks pass
- Reader launches successfully
- Onboarding can be completed
- At least 2 chapters can be navigated
- No Sev-1 failures
- User can describe the difference between NeuralBook (platform) and MindUnset (title/app)

## Time-to-First-Success Target

- Target: under 7 minutes from package extraction to successful first chapter read

## Screenshots and Logs to Collect

Required capture set:

1. Startup self-check results screen
2. Reader loaded with first chapter visible
3. Onboarding completion state
4. Tier unlock modal result (if paid-tier test)
5. Any error dialog or failed step

Required files:

- reports/adoption_reliability_summary.json (if telemetry was run)
- reports/disaster_recovery_drill_report.json (internal verifier copy)
- Optional terminal transcript if command failure occurs

## How to Report Friction

Use docs/platform/CANARY_FRICTION_LOG.md and add one row per friction event:

- exact step
- observed symptom
- severity
- time lost
- workaround
- proposed fix candidate

## Pass/Fail Decision Rules

Pass:

- All success criteria met
- No Sev-1 issues
- Time-to-first-success <= 7 minutes

Fail:

- Any Sev-1 issue
- Runtime integrity validation fails
- User cannot launch or complete onboarding
- Time-to-first-success > 15 minutes

Conditional pass:

- One or more Sev-2 issues with working workaround
- Time-to-first-success between 7 and 15 minutes

## Escalation Path

- Sev-1: Stop canary immediately; open incident and execute docs/platform/INCIDENT_PLAYBOOKS.md
- Sev-2: Continue canary, log issue, patch before wider rollout
- Sev-3: Log for backlog prioritization

Escalation owners:

- First responder: Launch/Support owner
- Technical escalation: Platform engineer
- Decision owner: Product owner (go/no-go)
