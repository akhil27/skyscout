# SkyScout

A shared stargazing planner: choose a place and 2–4 nights, compare forecast-based go/no-go scores, vote with your crew, and generate a viewing guide. Notes, live presence, and a shared sky photo keep the plan together.

Public source repository: [github.com/akhil27/skyscout](https://github.com/akhil27/skyscout).

## Live Demo

**[skyscout-akhil.app.space](https://skyscout-akhil.app.space)**

DeepSpace app ID: `app_01M4228SY73WA00M03RT8B1KRW`.

The October 3, 2026 production release confirmed serving and data-plane readiness. Organizer and two-user crew flows, integrations, persistence, uploads, and desktop/mobile Chrome were verified. See [SUBMISSION.md](SUBMISSION.md) for evidence and verification boundaries.

## What It Does

- Create an outing with a location and 2–4 upcoming nights.
- Compare forecast-based scores and select a crew pick.
- Vote Go / Maybe / No, with live shared tallies.
- Generate an AI viewing guide, directly or through Full Scout.
- Collaborate with crew notes and live presence.
- Upload a shared JPG/PNG sky photo, up to 10 MB.
- Send a reminder to the organizer's verified account email.

## DeepSpace Integrations

| Integration | Purpose |
| --- | --- |
| RecordRoom | Persistent collaborative outing, vote, and comment data |
| PresenceRoom | Live crew presence on an outing |
| JobRoom | Durable background scouting and AI guide generation |
| CronRoom | Scheduled, bounded forecast refresh |
| R2 | Shared sky-photo storage |
| OpenWeatherMap | Location geocoding and five-day forecast data |
| OpenAI | Selected-night viewing guide using `gpt-4o-mini` |
| NASA APOD | Cached daily astronomy inspiration |
| Email | Organizer reminder outside the planner |

External APIs use DeepSpace's integration proxy and owner billing; no vendor SDK or vendor API key is required in the app. Forecast, guide, and reminder calls retain their spending limits. NASA results cache by UTC day.

## Architecture

React 19, Vite, and Generouted file-based routes form the frontend. A Hono worker runs on Cloudflare Workers with DeepSpace SDK 0.34.0 and Durable Objects.

The public landing page mounts no auth/data providers; `(app)/_layout.tsx` owns that boundary. Records synchronize over WebSockets in the immutable `app:${APP_ID}` scope. Schemas preserve the required `users` collection, enforce permissions server-side, and bind votes to the caller with composite uniqueness. Confirmed mutations wait for server acceptance before navigation or success feedback.

Organizer-only actions and jobs handle paid integrations. Full Scout reuses the same forecast/guide actions and cooldowns. CronRoom refreshes eligible upcoming outings at 4am America/New_York, with at most 20 forecast calls per run. Presence is ephemeral; photo bytes live in platform R2, not Git.

## Key Design Decisions / Tradeoffs

- **One shared crew workspace, not private multi-tenant groups.** Signed-in members can read all outings and notes. An outing query filter is not a privacy boundary.
- **Organizer-only paid integrations.** Crew can create outings, vote, and discuss without spending the owner's integration budget. Server-side authorization and atomic fixed-window reservations enforce the paid boundary.
- **Approximate scoring, not an astronomy engine.** Cloud descriptions dominate scores; humidity and approximate lunar illumination adjust them. Guide prompts receive illumination and phase from the same lunar calculation as scoring, explicitly labeled approximate—not independently inferred astronomy.

## Verification

The original release passed typecheck, ESLint, production build, **24 unit/prerender/action tests**, and **13/13 browser tests** without skips. Real local and production checks covered organizer integrations, two-user voting/notes/presence, RecordRoom reload persistence, R2 upload, and a manual cron run.

Submission cleanup adds focused lunar-context and Full Scout cooldown/error regression coverage. These code changes require a separate production release; GitHub publication does not deploy them. Detailed results and unverified behavior are recorded in [SUBMISSION.md](SUBMISSION.md).

## Development

Use Node 22.15+ on the 22 line, or Node 24/26; npm 11.6+.

```bash
npm ci
npx deepspace auth login
npx deepspace auth whoami --json
npm run dev
```

This existing app is already registered: keep its immutable app ID. Do not register a replacement app. Secrets are managed by the DeepSpace CLI; do not commit credentials or local secret files.

```bash
npm run type-check
npm run lint
npm run test:unit
npm run validate
npm run build
npx deepspace test run all --port 5181 --json
```

Browser tests need CLI login and two usable test accounts. Inspect the existing pool with `npx deepspace test accounts list --usable`; reuse accounts rather than storing credentials in source. Use a separate port when the local dev server is already running.

## Deployment

GitHub is the public source repository for the project and submission. **Pushing to GitHub does not deploy SkyScout.** The existing app remains permanently latched to **DeepSpace source**, revision 1, with the `space` remote and commit-first release lineage. Do not change that source model.

Deployment is a separate, explicitly authorized operation from a reviewed, clean committed checkout:

```bash
npx deepspace status --json
npx deepspace deploy
npx deepspace releases
```

The initial verified runtime shipped from `a7912e474117a701a5065ec25bf952bfcc236679`, release `rel_01M4230EW115ZZV1PXDT3ETJQT`. Keep that lineage and rollback evidence. After an authorized release, verify the returned live URL, runtime logs, and affected organizer/crew flows. Submission cleanup itself does not deploy.

## Limitations / Future Work

- Forecasts cover roughly five days in three-hour steps. Nights outside the actual data horizon are unavailable, not automatically No-go.
- Description-based cloud estimates and synodic-cycle lunar illumination/phase are approximate. No ephemeris, Moon rise/set, exact event visibility, or safety guarantee is provided. AI advice can still be imperfect.
- Dates mean 9pm in the creator's browser timezone, not the destination timezone. Weather uses the selected city/state/country name; coordinates supply guide context, not forecast lookup.
- Shared crew data is not private-group data. Photos have public app-scoped URLs; replaced/deleted photos are not automatically garbage-collected.
- Home/query and cron results are bounded, with no pagination. Fixed-window spend reservations can allow calls near a bucket boundary and are not fine-grained billing quotas.
- Email provider acceptance was verified, not inbox arrival. A manual cron run was verified, not a future overnight alarm. Job cancellation/restart recovery was not separately exercised end-to-end.

## Important Files

- `worker.ts`: worker routes and Durable Object assembly.
- `src/schemas/`: data contracts, permissions, and vote uniqueness.
- `src/actions/index.ts`, `src/server/`: authenticated actions and integration boundaries.
- `src/lib/sky.ts`, `src/config.ts`: scoring, lunar estimates, guide prompt, and limits.
- `src/jobs.ts`, `src/lib/scout.ts`, `src/cron.ts`: background outcomes and scheduled refresh.
- `src/pages/(app)/`, `src/components/`: planner, outing detail, notes, presence, and uploads.
- `src/**/*.test.ts`, `tests/`: unit/regression and real-runtime browser tests.
- `SUBMISSION.md`: submission evidence and remaining verification boundaries.
