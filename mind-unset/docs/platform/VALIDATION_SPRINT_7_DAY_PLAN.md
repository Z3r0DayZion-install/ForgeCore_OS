# Validation Sprint - 7 Day Plan

Status: Ready to execute
Start Date: __________
Owner: __________

## Day 1 - Canary Packet + Tester Selection

- Finalize canary packet and friction log templates
- Select 3-5 external operators
- Assign operator IDs and schedule windows
- Confirm escalation owner and decision owner

Deliverables:

- docs/platform/CANARY_DAY1_PACKET.md
- docs/platform/CANARY_FRICTION_LOG.md

## Day 2 - First Operator Run

- Execute one external operator run end-to-end
- Record exact time-to-first-success
- Capture screenshots/logs
- Log all friction events

Success target:

- One full run completed with clear pass/fail result

## Day 3 - Second/Third Operator Run

- Execute at least two more external runs
- Consolidate recurring friction patterns
- Score adoption using ADOPTION_SCORECARD

Deliverable:

- docs/platform/ADOPTION_SCORECARD.md populated with observed scores

## Day 4 - Friction Triage

- Rank issues by severity and frequency
- Select top 3 blockers
- Assign owners and patch plan

Deliverable:

- Prioritized issue list with owner/date

## Day 5 - Patch Top 3 Blockers

- Implement and verify top 3 fixes
- Re-run cold_start lane and feature lane
- Update run sheet if operational steps changed

Validation commands:

```powershell
python -m pytest -q tests --lane cold_start
python -m pytest -q tests --lane feature
```

## Day 6 - Re-Run Validation

- Run mini-canary with 1-2 external operators
- Confirm blocked steps are resolved
- Re-score adoption scorecard

Success target:

- Improved score and reduced time-to-first-success

## Day 7 - Go/No-Go Commercialization Decision

- Review canary outcomes, scorecard, and blocker closure
- Decide Go / Hold / Pilot-Only
- Document decision and next release scope

Decision output:

- Go if score >= 45 and no Sev-1 issues
- Pilot-only if score 35-44
- Hold if score < 35 or unresolved Sev-1/Sev-2 blockers
