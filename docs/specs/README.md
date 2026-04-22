# Specs

Every feature gets a spec in `docs/specs/` **before** code is written.

## Convention

- Path: `docs/specs/<TIER>_<feature_slug>.md`
  Examples: `T2_driver_pwa_sms.md`, `T3_team_invites.md`
- Tier prefix (`T1`, `T2`, `T2.5`, `T3`, ...) tracks which launch tranche the feature belongs to.
- Slug is lowercase, snake_case.

## Why this exists

- The spec is the contract Claude builds against. Drift from spec = bug.
- Claude sessions are stateless; specs are durable. Without them, the same feature gets re-invented with different semantics every time.
- Juan reviews the spec before any terminal build begins. Spec review catches scope, schema, and acceptance-criteria mistakes at the cheap stage.

## Workflow

1. Copy `docs/specs/TEMPLATE.md` to `docs/specs/<TIER>_<slug>.md`
2. Fill in every section. Leaving a section empty is a signal the design is incomplete.
3. Open a PR with only the spec file. Get it merged before opening an implementation PR.
4. Implementation PR links back to the spec in the body.

## Existing specs

- `T1_contractor_dashboard.md` — contractor dashboard (retroactive, shipped)
- `T2_driver_pwa_sms.md` — driver PWA bootstrap + outbound dispatch SMS (retroactive, shipped; inbound SMS + PWA UI in T2.5)
