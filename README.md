# SkyScout

A shared stargazing planner: choose a place and 2–4 nights, compare forecast-based go/no-go scores, vote together, and get an organizer-generated viewing guide. Crew notes, presence, and a shared sky photo keep planning in one place.

**Release status:** implementation repaired and locally checked; **not deployed or fully submission-ready yet**. DeepSpace authentication is missing on this machine, so `wrangler.toml` still contains its original `__APP_ID__` placeholder. The intended URL is `https://skyscout-akhil.app.space`; the URL probe returned **404** during this continuation. Do not present it as a live demo.

## Core flow

1. Open `/home` and sign in. Create an outing with a city/state/country and 2–4 upcoming dates.
2. The organizer can use **Find place** to select a geocoding candidate. Crew can enter a disambiguated city directly without spending credits.
3. Creation waits for the RecordRoom acknowledgement, then navigates to the detail page.
4. Organizer selects **Refresh weather**. Each night gets a score only if actual forecast rows fall within six hours of its chosen 9pm instant.
5. Crew votes Go / Maybe / No; changing a vote updates the same row. Select the crew pick; scores derive from that date, not a stale stored score.
6. Organizer generates the guide or runs **Full scout** as a durable background job. A changed date invalidates the displayed guide.
7. Organizer sends a reminder to their own account email. Crew posts notes, sees presence, and uploads a JPG/PNG up to 10 MB.
8. Creator/organizer can delete the outing with confirmation; the action removes its votes and comments first.

## Architecture and platform primitives

React 19 + Vite + file-based Generouted routes, Hono worker, DeepSpace SDK 0.34.0, Cloudflare Workers/Durable Objects.

- Static `/` renders without auth or realtime providers. `(app)/_layout.tsx` owns the authenticated/data provider boundary.
- A single `RecordScope` keys to immutable `app:${APP_ID}`. `outings`, `votes`, and `outing_comments` persist in RecordRoom SQLite and broadcast changes over WebSockets. App fields are read from `record.data`.
- The required `users` schema is preserved. Collection permissions run server-side; member writable fields exclude generated weather/AI fields.
- Vote uniqueness is enforced by `uniqueOn: ['outingId', 'option', 'userId']`, a `userBound` immutable user column, and own-write RBAC, not just UI checks.
- Paid server actions verify the organizer against `OWNER_USER_ID`. Privileged action tools bypass RBAC deliberately; outing deletion explicitly checks the record creator/organizer before cascading.
- Atomic unique-key records in admin-only `settings` reserve spending intervals across worker isolates. Reservations persist even if upstream fails, avoiding rapid failure/retry spend. They expire through nightly cleanup. Fixed time buckets can allow two calls near an interval boundary; these are conservative caps, not a billing firewall.
- `AppJobRoom` authorizes paid jobs organizer-only. `scout-outing` reuses the real action tools/actions, propagates failures and abort signals, and broadcasts progress and terminal status.
- `AppCronRoom` refreshes upcoming unfinished outings at 4am America/New_York. Work is bounded to 20 forecasts per run, within the actual five-day horizon. `CronContext.integrations.call` returns unwrapped provider data (unlike action tools).
- PresenceRoom is ephemeral and outing-scoped. `useR2Files({ scope: 'app' })` uses platform file storage; file bytes are never checked into Git.
- Integration proxy routes reject anonymous calls and disallow direct developer-billed calls, so browser console calls cannot bypass action limits.

## DeepSpace integrations

Catalog input/output contracts were inspected with `deepspace integrations info`.

| Integration | Product purpose | Execution/billing |
| --- | --- | --- |
| `openweathermap/geocoding` + `openweathermap/forecast` | Disambiguate the location; conditions are the core go/no-go input. | Organizer actions; owner-billed. Forecast cooldown 10 minutes; nightly refresh bounded to 20 calls. |
| `openai/chat-completion`, `gpt-4o-mini` | Summarize the selected night, weather and crew context into a short guide/checklist. | Organizer action/job; owner-billed, five-minute cooldown, 900-token output bound. |
| `nasa/apod` | Shared daily astronomy inspiration while planning. | Cached by UTC day in settings; only the organizer populates a missing cache. Signed-in crew reads the cached result. |
| `email/send` | Deliver the decision/guide outside the app. | Organizer-only; recipient loaded from verified caller's users row, never accepted from browser params. One-minute spend reservation. |

These are real platform calls, not simulated production integrations. **Live integration execution and email delivery remain unverified** because authentication/app registration is unavailable. No vendor SDK or API key is required; DeepSpace injects owner billing credentials. The email sender's provider acceptance must be checked in the first live run.

## Main tradeoff

**One shared crew workspace, not private multi-tenant groups.** Signed-in members can read all outings and comments and collaborate on planning. The `outingId` query isolates a discussion view, **not security/privacy**. This keeps a five-day exercise focused; future private crews need collaborator/team policies and excluded-user tests.

Organizer-only spending is deliberate: members can create outings, vote, and discuss without being able to burn the owner's integration budget. No payments, video, OAuth calendar, or second database is needed.

## Setup / development

Use Node 22.15+ on the supported 22 line, or Node 24/26; npm 11.6+. This continuation used Node 24.19.0 and npm 12.2.0.

```bash
npm ci
npx deepspace auth login
npx deepspace auth whoami --json
npx deepspace app init          # mints the real immutable ID; never hand-write one
npx deepspace dev start
```

Normal browser login needs an interactive terminal. The agent shell's login attempt refused `interactive_required`. Run login in your own terminal; do not paste passwords or JWTs into chat/source files. For an operator-managed headless environment, consult `npx deepspace auth login --help` for supported credential transport.

```bash
npm run type-check
npm run lint
npm run test:unit               # pure unit/prerender tests do not require a registered ID
npm run validate
npm run build                  # requires the real registered ID
npx deepspace test run all      # real runtime; requires CLI login and usable test accounts
```

The Playwright suite includes a real two-user create → vote → change vote → note sync → delete flow. Use two existing usable accounts (`deepspace test accounts list --usable`); recover/create only the missing accounts using the CLI. No test passwords are in source. External integration responses can be mocked only at the external boundary; internal auth/records/routes must remain real.

## Deployment

Keep DeepSpace cloud source as the default; do not attach GitHub unasked. After successful registration and final checks, review and commit the checkout, then deploy from a clean worktree:

```bash
npx deepspace status --json
# Review/stage/commit the intended source files (no secrets or generated artifacts).
npx deepspace deploy
npx deepspace releases
npx deepspace logs --follow --json
```

DeepSpace-source deploys require a real app ID and a clean committed checkout. The starting repository has no commits or remote; this continuation leaves the source uncommitted rather than claiming a release with a placeholder identity. CLI registration may create its own initial checkpoint. Never use a fake ID to force a successful build.

Before submitting, test the **returned release URL**, not merely the intended name: sign in as organizer, create/select location, refresh forecast, generate guide, send reminder, open a second signed-in crew browser to vote/post, upload a photo, reload and verify persistence, inspect job/cron status and worker logs. Check owner credits and email sender configuration if a real call refuses. Record the actual results in `SUBMISSION.md`.

## Validation evidence from this continuation

- Typecheck, lint, and 24 unit/prerender/action-contract tests passed.
- Playwright discovery succeeded: 13 tests in three spec files. Discovery is **not execution**.
- Actual static landing markup/CSS was rendered in installed Chrome at 390×844 and 1440×1000: heading, planner CTA destination, theme CSS, no horizontal overflow, no page errors passed. Screenshots are local ignored artifacts in `.deepspace/verification/`.
- Full Vite build refused because the app has not been registered.
- Real dev/test/deploy commands refused `not_authenticated`; login action refused `interactive_required`.
- Intended production URL probe returned 404. Authenticated planner, real integrations, multi-user runtime, uploads, email and deployed cron/job execution are **not yet verified**.

See `SUBMISSION.md` for handoff and remaining release gates.

A targeted 85-file source/test/public/documentation scan found no credential-like literals, private keys, personal absolute paths, or debugger statements. This is a heuristic scan, not a guarantee. Local verification outputs and dependency directories remain ignored.

## Limitations / future work

- Five-day, three-hour weather steps; description-based cloud proxy plus humidity and approximate lunar illumination. No ephemeris, precise cloud percentage, wind/safety guarantee, or astronomical event predictions. AI is explicitly warned not to invent exact positions/times.
- Dates mean 9pm in the creator's browser timezone, displayed in the form; no location-timezone lookup. Confirm this convention for a distant destination.
- The current forecast catalog supports location/q strings, not lat/lon fields. Coordinates aid guide context; forecast lookup uses the selected city/state/country. Verify ambiguous provider matching live.
- Query views are bounded (home 50 outings, 200 votes, 100 comments); no pagination. Overnight refresh is capped at 20 eligible outings among the first 100.
- Photos are shared app storage. Replaced/deleted outing photos are not automatically garbage-collected. MIME/size checks in the UI supplement platform storage validation; they are not a private-photo policy.
- Reservation/cache settings and app owner administrators are trusted. Fixed-window limits are intentionally simple, not per-user fine-grained quotas.
- Production app registration, build, deploy and important-flow verification remain release blockers, not optional future work.

## Important files

`worker.ts`; `src/schemas.ts`; `src/schemas/{outings,votes,outing-comments,admin}-schema.ts`; `src/server/{action-routes,http-routes,realtime-routes}.ts`; `src/actions/index.ts`; `src/cron.ts`; `src/jobs.ts`; `src/lib/sky.ts`; `src/components/{NewOutingForm,OutingCard,ApodCard,PresenceBar}.tsx`; `src/pages/(app)/outings/[outingId].tsx`; `src/pages/(app)/home.tsx`; `src/config.ts`; `tests/{smoke,api,collab}.spec.ts`.
