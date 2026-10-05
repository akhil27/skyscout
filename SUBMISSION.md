# SkyScout — DeepSpace Build Exercise

**Live app:** https://skyscout-akhil.app.space

**Public source:** https://github.com/akhil27/skyscout

**App ID:** `app_01M4228SY73WA00M03RT8B1KRW`

## What I Built

SkyScout helps a shared crew choose a stargazing night: create an outing with a place and 2–4 nights, compare forecast-based scores, vote together, generate an AI viewing guide, discuss logistics, upload a sky photo, and send the organizer a reminder.

React 19/Vite/Generouted serves the planner; a Hono Cloudflare worker uses DeepSpace SDK 0.34.0. The public landing is static, while authenticated routes share an app-scoped realtime workspace.

## DeepSpace Integrations and Why

| Integration | Product role and recorded production evidence |
| --- | --- |
| RecordRoom | Persistent outings, votes, and notes; two-user sync and reload persistence passed. |
| PresenceRoom | Live co-planning peers; distinct crew browsers observed each other. |
| JobRoom | Durable Full Scout progress and guide generation; real production job reached `succeeded`. |
| CronRoom | Bounded nightly forecast refresh; schedule and manual run returned successful history/logs (`nightly-refresh ok 1067ms`). |
| R2 | Shared sky photo; PNG upload, rendered image, HTTP 200/image/png, and persisted URL passed. |
| OpenWeatherMap | Geocoding and forecasts; organizer selected Joshua Tree, refreshed weather, and persisted scores. |
| OpenAI `gpt-4o-mini` | Selected-night guide/checklist; real Full Scout guide displayed and survived reload. |
| NASA APOD | Daily astronomy inspiration; production response was cached and shared. |
| Email | Organizer reminder outside the app; provider/API acceptance passed, not inbox delivery. |

These recorded production checks used real auth, records, WebSockets, and integration calls, not mocked services. Paid operations remain organizer-only and bounded. No vendor credentials are committed.

## Main Tradeoff

**A shared crew workspace rather than private multi-tenant groups.** All signed-in members can read crew outings and notes; outing filters scope a view, not privacy. Organizer-only paid actions prevent crew accounts from spending owner credits.

Scoring is intentionally approximate: cloud descriptions, humidity, and a synodic-cycle lunar estimate—not an ephemeris or safety prediction. Dates mean 9pm in the creator's browser timezone. Forecasts are bounded to their actual five-day horizon; photos have public app-scoped URLs.

## What the Coding Agent Did

The agent preserved the existing product and integrations rather than redesigning it. Earlier work repaired forecast/date handling, vote uniqueness, authorization/spending boundaries, guide invalidation, reminders, deletion cleanup, persistence feedback, and SDK response/token handling. It ran local and production checks and deployed the original clean release after the owner authenticated.

Submission cleanup adds two narrow fixes:

- **Lunar context:** the previous guide prompt included illumination only indirectly in weather prose and never supplied phase. It now receives explicit approximate illumination and phase derived from the same cycle as scoring, including when weather is unavailable. The system prompt prohibits independent phase inference or overrides from crew notes; an explicit contradictory phase claim is rejected before saving, preserving any previous guide. No schema, scoring formula, or astronomy dependency changed.
- **Full Scout cooldown:** the previous job threw the expected five-minute guide refusal, creating a real `failed` JobRoom row. It now returns a structured `cooldown` request outcome, displayed as “Guide generation is on cooldown. Try again in a few minutes.” This does not claim a new guide was generated. Only the exact historical cooldown message receives compatibility display handling; genuine provider/storage/auth/job failures remain errors. Duplicate spend reservations retain cooldown protection, while unrelated storage failures are no longer mislabeled cooldowns.

README and this submission note now distinguish the public GitHub repository from the unchanged DeepSpace deployment authority. No production deployment is part of submission cleanup.

## Verification and Personal Review

### Recorded original release evidence — October 3, 2026

- Production build, typecheck, ESLint, and **24/24 unit/prerender/action tests** passed.
- **13/13 real browser tests** passed, no skips, including two-user create → vote → change vote → notes/presence sync → delete.
- Real local and production organizer flows covered geocoding, weather, OpenAI/JobRoom, NASA APOD, and email provider acceptance.
- Production crew browsers verified votes, notes, presence, and reload persistence; R2 upload/render/reload passed.
- Chrome at 1440×1000 and 390×844 showed real landing/planner/detail content without horizontal overflow; signed-out pages had no page errors.
- Credential/Git review found no tracked secret files, credential literals, or local verification artifacts. Scans are heuristic, not guarantees.
- Release `rel_01M4230EW115ZZV1PXDT3ETJQT` confirmed serving and data plane; runtime commit `a7912e474117a701a5065ec25bf952bfcc236679` retains DeepSpace-source lineage and rollback evidence. Read-only release inspection during cleanup also confirmed the latest existing release `rel_01M423AYZEN5B7WH0BTQ4Z6GCF` at `516145dc46d8f5fc813f28e48755acfaff1e10f9` (October 3, 2026); no new release was made.

The owner personally completed CLI login and subsequently inspected an outing, reporting the contradictory lunar advice and misleading Full Scout failure. The broader browser/integration evidence above was agent-driven; it is not represented as additional human/manual verification.

### Submission cleanup — local verification

- Typecheck, ESLint, `test:unit`, `validate`, and production build passed; **48/48 unit/prerender/action/job regression tests** now cover lunar phase direction, shared illumination, selected-date prompts, cooldown protection, normal guide generation, and genuine errors.
- The full real-runtime browser suite passed again: **13/13**, no skips, including two-user creation/voting/notes/presence and deletion.
- Real local Chrome organizer flow reproduced **moon 29%** and generated **waning crescent** advice. Normal OpenAI guide generation, JobRoom cooldown display, unchanged saved guide, reload persistence, and Full Scout success after waiting the real five-minute cooldown passed.
- After the final code edits, the full browser suite passed again. Real local R2 upload/render/HTTP image bytes/reload and manual CronRoom execution/history passed. A deliberately missing test record produced a genuine JobRoom `failed` error (`Record not found`), not cooldown. Created test outings were deleted through authorized app actions.
- The first supplemental organizer attempt hit a stopped local server; it was restarted and the complete flow rerun successfully. Live model output also exposed an unsupported moonset statement, so the prompt was tightened and phase-validation regression tests added; all required checks were rerun. This does not establish that arbitrary AI prose can never be wrong.
- R2/cron checks use the local app runtime with real platform integrations; production records/configuration/releases were not changed. Local verification scripts/results remain ignored and are not submission artifacts.

## What Remains Unverified / Future Work

- Email inbox arrival was not observed; provider acceptance is not delivery confirmation.
- A future overnight cron alarm was not observed; schedule/manual execution is the available evidence.
- Job cancellation/restart recovery was not separately exercised end-to-end. Unit cancellation coverage does not establish crash recovery.
- Approximate astronomy and AI advice remain imperfect; no exact positions, moonrise/set, or visibility guarantee is claimed.
- Private crews, destination-timezone lookup, pagination, replaced-photo garbage collection, and fine-grained quotas are future work.
- New code fixes are local until a separately authorized DeepSpace production deployment. Existing stored guides are not automatically rewritten.

## Source and Release Model

GitHub is the public project/submission repository. A GitHub push does **not** deploy the app. The existing app remains latched to DeepSpace source, revision 1, with the `space` remote and commit-first releases. Source authority, app ID, production configuration, and release were not changed by submission cleanup. See [README.md](README.md) for development and deployment commands.
