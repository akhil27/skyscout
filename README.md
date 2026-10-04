# SkyScout

A shared stargazing planner: choose a place and 2–4 nights, compare forecast-based go/no-go scores, vote together, and get an organizer-generated viewing guide. Crew notes, presence, and a shared sky photo keep planning in one place.

**Live:** https://skyscout-akhil.app.space — deployed with serving and data plane confirmed. Immutable app ID: `app_01M4228SY73WA00M03RT8B1KRW`. Production organizer flow, two-user collaboration, R2 upload, and desktop/mobile Chrome checks passed on October 3, 2026. Email provider acceptance passed; inbox arrival and a future overnight alarm were not observed.

**GitHub mirror for review:** https://github.com/akhil27/skyscout — source of truth remains the DeepSpace cloud repo (`space` remote, revision 1, release `rel_01M4230EW115ZZV1PXDT3ETJQT`). GitHub holds a copy for PR review only; deploys still ship from the clean DeepSpace-source checkout and carry the DeepSpace commit lineage.

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

All four integrations executed successfully through the real production app. No vendor SDK or API key is required; DeepSpace injects owner billing credentials. Email sender/provider acceptance was verified; inbox delivery is not claimed.

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

Browser login needs an interactive terminal. The owner completed it before registration; the agent verified the authenticated developer identity. Do not paste passwords or JWTs into chat/source files. Consult `npx deepspace auth login --help` for supported headless credential transport.

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

DeepSpace cloud source is the deploy authority (`space` remote); GitHub `origin` (https://github.com/akhil27/skyscout) is a review mirror only and does not change the latched source. After successful registration and final checks, review and commit the checkout, then deploy from a clean worktree:

```bash
npx deepspace status --json
# Review/stage/commit the intended source files (no secrets or generated artifacts).
npx deepspace deploy
npx deepspace releases
npx deepspace logs --follow --json
```

DeepSpace-source deploys require a real app ID and a clean committed checkout. Registration created the initial checkpoint, and the runtime repair commit is `a7912e474117a701a5065ec25bf952bfcc236679`. The deployment claimed DeepSpace source and installed its `space` remote. Never use a fake ID to force a successful build.

To sync the GitHub review mirror (does not deploy):

```bash
git remote -v  # origin -> https://github.com/akhil27/skyscout.git, space -> DeepSpace cloud repo
git push origin master
```

Before submitting, test the **returned release URL**, not merely the intended name: sign in as organizer, create/select location, refresh forecast, generate guide, send reminder, open a second signed-in crew browser to vote/post, upload a photo, reload and verify persistence, inspect job/cron status and worker logs. Check owner credits and email sender configuration if a real call refuses. Record the actual results in `SUBMISSION.md`.

## Final validation evidence

- Typecheck, lint, and 24 unit/prerender/action-contract tests passed.
- Real local Playwright execution passed: **13/13**, no skips. Two distinct test accounts created an outing, changed votes, posted notes, observed presence, and deleted their test outing.
- Actual static landing markup/CSS was rendered in installed Chrome at 390×844 and 1440×1000: heading, planner CTA destination, theme CSS, no horizontal overflow, no page errors passed. Screenshots are local ignored artifacts in `.deepspace/verification/`.
- Full production Vite build passed, including worker/client assets and static prerender.
- `deepspace deploy` confirmed serving/data plane at the live URL; runtime code shipped from `a7912e4`, release `rel_01M4230EW115ZZV1PXDT3ETJQT`.
- Real local and production organizer flows passed: geocoding → create → weather → full scout JobRoom/OpenAI guide → email acceptance → reload persistence. NASA APOD succeeded on home.
- Production Chrome passed at 1440×1000 and 390×844; signed-out pages had no page errors/overflow. Authenticated detail at mobile size showed the real guide, votes and photo without horizontal overflow.
- Two production crew accounts verified vote changes, note sync, presence and reload persistence. R2 uploaded PNG bytes returned 200/image/png and remained visible after reload.
- Production CronRoom exposed its schedule and a manually triggered nightly refresh returned successful history. Logs recorded `[cron] nightly-refresh ok 1067ms`.
- Email inbox arrival and a future scheduled overnight alarm were not observed. Job cancellation/restart recovery were not separately exercised.

See `SUBMISSION.md` for handoff and remaining release gates.

A targeted 85-file source/test/public/documentation scan found no credential-like literals, private keys, personal absolute paths, or debugger statements. This is a heuristic scan, not a guarantee. Local verification outputs and dependency directories remain ignored.

## Limitations / future work

- Five-day, three-hour weather steps; description-based cloud proxy plus humidity and approximate lunar illumination. No ephemeris, precise cloud percentage, wind/safety guarantee, or astronomical event predictions. AI is explicitly warned not to invent exact positions/times.
- Dates mean 9pm in the creator's browser timezone, displayed in the form; no location-timezone lookup. Confirm this convention for a distant destination.
- The current forecast catalog supports location/q strings, not lat/lon fields. Coordinates aid guide context; forecast lookup uses the selected city/state/country. Verify ambiguous provider matching live.
- Query views are bounded (home 50 outings, 200 votes, 100 comments); no pagination. Overnight refresh is capped at 20 eligible outings among the first 100.
- Photos are public, app-scoped storage; their URLs are world-readable. Replaced/deleted outing photos are not automatically garbage-collected. MIME/size checks in the UI supplement platform storage validation; they are not a private-photo policy.
- Reservation/cache settings and app owner administrators are trusted. Fixed-window limits are intentionally simple, not per-user fine-grained quotas.
- No deployment or critical-flow blocker remains. Inbox delivery, overnight alarm observation and job cancel/recovery tests are additional verification work; do not infer them from API acceptance.

## Important files

`worker.ts`; `src/schemas.ts`; `src/schemas/{outings,votes,outing-comments,admin}-schema.ts`; `src/server/{action-routes,http-routes,realtime-routes}.ts`; `src/actions/index.ts`; `src/cron.ts`; `src/jobs.ts`; `src/lib/sky.ts`; `src/components/{NewOutingForm,OutingCard,ApodCard,PresenceBar}.tsx`; `src/pages/(app)/outings/[outingId].tsx`; `src/pages/(app)/home.tsx`; `src/config.ts`; `tests/{smoke,api,collab}.spec.ts`.
