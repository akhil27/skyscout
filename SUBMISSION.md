# SkyScout — DeepSpace evaluation submission

## Live app

**https://skyscout-akhil.app.space**

- Immutable app ID: `app_01M4228SY73WA00M03RT8B1KRW`
- Owner CLI identity verified: Akhil Indraganti, developer account.
- Source authority: DeepSpace cloud repository (`space` remote), not GitHub.
- Runtime release commit: `a7912e474117a701a5065ec25bf952bfcc236679`.
- Initial verified release: `rel_01M4230EW115ZZV1PXDT3ETJQT`, serving/data plane confirmed, retained rollback bundle, clean worktree.
- Registration, build, real tests and live verification completed October 3, 2026.
- Exercise deadline: October 5, 2026, 11:59 PM Eastern.

## Product and focused scope

SkyScout helps a shared crew choose a stargazing night. Create an outing with a city and 2–4 nights; compare weather-based scores; vote live; ask the organizer for a viewing guide; send the decision to the organizer's email; discuss logistics and upload a shared sky photo.

One app-scoped crew workspace keeps the five-day scope realistic. There are no payments, video, calendar OAuth, private groups, or second database merely to inflate an integration count.

## Meaningful integrations — real production results

| Integration / primitive | Purpose | What actually executed |
| --- | --- | --- |
| OpenWeatherMap geocoding + forecast | Pin a city and drive go/no-go | Organizer browser selected Joshua Tree, California, US; forecast action succeeded and score/data persisted. |
| OpenAI `gpt-4o-mini` | Selected-night advice/checklist | Full scout JobRoom ran to `succeeded`; generated guide displayed and survived reload. |
| NASA APOD | Daily shared astronomy inspiration | Production home `getApod` returned success and cached the real NASA response. |
| `email/send` | Reminder outside the planner | Production reminder action returned success; platform usage ledger marked calls completed. **Inbox arrival was not observed.** |
| RecordRoom | SQLite operational records + live sync | Production creation, two-account vote changes, notes and reload persistence passed. |
| PresenceRoom | Ephemeral co-planning peers | Distinct production crew browsers observed peers on the same outing. |
| Platform R2 | Shared sky image bytes | Production PNG upload succeeded, image rendered, request returned 200/image/png, URL persisted through reload. App-scoped URLs are public. |
| CronRoom | Bounded upcoming-weather refresh | Production schedule snapshot and manual nightly trigger succeeded; history confirmed success; logs recorded `nightly-refresh ok 1067ms`. Future overnight alarm not observed. |
| JobRoom | Durable full scout and progress | Production full scout advanced to `succeeded`, generated/saved a real AI guide. Cancellation/restart recovery were not separately exercised. |

All checks used actual auth, app routes, hooks, records, WebSockets and platform integrations. Production checks did not mock services. Paid calls were bounded and authorized by the owner. Test-account passwords and existing owner session credentials stayed in the SDK's local secure storage, never in source or CLI arguments.

## Architecture and tradeoffs

React 19/Vite/Generouted frontend; Hono Cloudflare worker; DeepSpace SDK 0.34.0. Static landing mounts no auth/data providers. `(app)/_layout.tsx` owns the provider boundary; records key to immutable `app:${APP_ID}`.

Schemas retain required `users`, add outings/votes/comments, and use server-side permissions. Vote identity is `userBound`/immutable with composite `uniqueOn` enforcement. Confirmed mutations wait for server acceptance before navigation/success UX. Privileged action tools intentionally bypass RBAC; destructive deletion checks creator/owner before cascading.

**Main tradeoff:** a shared crew workspace rather than private multi-tenant groups. Filtering comments by outing ID is query scope, not privacy. All signed-in members can read crew outings. Organizer-only paid actions/jobs/cron triggering keep random accounts from spending owner credits; crew can create, vote and discuss. Unique settings keys provide fixed-window spend reservations; NASA results cache by UTC day.

Forecasts use the platform catalog's place-name lookup and three-hour/five-day horizon. Scores use descriptions/humidity/approximate lunar illumination; distant nights are unavailable, not zero/No-go. Dates mean 9pm in the creator browser timezone. Guides are date-tagged and invalidated when the selected night changes. No exact ephemeris or safety prediction is promised.

## What existed, and what the coding agent did

Preserved the existing SkyScout scaffold, landing, home/detail UI, schemas, scoring, action skeletons, presence, uploads, cron/job and tests; no restart/redesign.

The agent repaired forecast horizon/date handling, vote uniqueness, spend/auth boundaries, reminder recipient safety, checked persistence, guide invalidation, UI loading/error states, explicit place selection, deletion cleanup and consistent theming. It fixed the cron SDK response contract, then used real tests to discover/fix the missing `await getAuthToken()` and verified that cleanup/actions now work. Uploads now check the SDK success envelope; cron writers are owner-only.

The agent verified owner identity, registered the server-minted app, created exactly two usable test accounts with generated stdin passwords, ran the full build/test suite, deployed a clean commit, and used installed Chrome to drive real production organizer/crew flows. It inspected releases, runtime logs and integration usage. The human completed initial CLI login; **no human/manual inbox verification or overnight observation is claimed**.

## Checks performed

| Check | Result |
| --- | --- |
| Full production build | Passed worker/client builds and static prerender |
| Typecheck | Passed |
| ESLint | Passed scaffold's Rules of Hooks checks |
| Unit/prerender/action tests | **24/24 passed** |
| `deepspace test run all --json` | **13/13 browser tests passed**, no skips, plus unit suite |
| Two-user local planner flow | Passed create → vote → change vote → note/presence sync → cascade delete |
| Real local organizer integrations | Geocode/weather/NASA/OpenAI job/email acceptance passed |
| Production organizer flow | Passed through real browser actions; guide persisted after reload |
| Production two-user flow | Votes, notes, presence and persistence passed |
| Production R2 | Upload/render/200 image bytes/type/reload passed |
| Production cron/job | Manual cron successful history/log; scout job succeeded |
| Installed Chrome 1440×1000 / 390×844 | Live landing/planner content, mobile detail, no horizontal overflow; signed-out pages no JS page errors |
| Git/credential review | 103 tracked files scanned before release: no JWT/private key/vendor-key/credential literals or tracked `.dev.vars`/verification artifacts |
| Deployment | `serving: confirmed`, `dataPlane: confirmed`, clean DeepSpace-source release |

The first real two-user run failed deletion authorization because a Promise was sent as Bearer token. The helper was fixed, and the complete affected suite was rerun successfully. No test assertion was weakened or skipped to pass.

## Repository and important files

- `worker.ts`: Durable Object manifest, auth/realtime/actions and runtime assembly.
- `src/schemas.ts`, `src/schemas/{outings,votes,outing-comments,users,admin}-schema.ts`: data/RBAC/uniqueness.
- `src/actions/index.ts`, `src/server/{action-routes,http-routes,realtime-routes}.ts`: checked privileged work, paid boundary, verified identity.
- `src/lib/{callAction,sky}.ts`, `src/config.ts`: JWT action client, pure scoring/date/provider validation, prompt/model/caps.
- `src/cron.ts`, `src/jobs.ts`: scheduled/durable orchestration.
- `src/components/{NewOutingForm,OutingCard,ApodCard,PresenceBar}.tsx`, `src/pages/(app)/outings/[outingId].tsx`: main product flow.
- `tests/{smoke,api,collab}.spec.ts`, unit tests: static/auth/API/two-user/regression coverage.
- `README.md`: setup/development/deployment and detailed architecture/limits.

Screenshots and verification evidence are local ignored `.deepspace/verification/` artifacts, not committed credentials or production fixture data. Test records use `__test-` prefixes; the live verification outing/photo are removed after checks rather than left as crew data.

## Remaining limitations — no deployment blocker

- Email API/provider acceptance verified; inbox receipt not verified.
- Cron schedule/manual execution verified; future overnight alarm not observed.
- Job success verified; cancellation/recovery remain additional tests.
- Shared crew, not private groups; photos intentionally public URLs.
- Approximate astronomy, browser-timezone dates, place-name weather lookup and bounded query/cron sizes.
- Replaced photo garbage collection and fine-grained quotas are future work.
