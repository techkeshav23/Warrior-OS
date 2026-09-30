# Deploying Warrior OS

Warrior OS is a standard Next.js 16 app. The live site runs from the repository's `Dockerfile` on a self-hosted VM through Coolify; Vercel works just as well. GitHub Actions checks every push, and owner sync and the API keys are optional add-ons. Every step below is done from your own machine and browser.

Repository: `github.com/techkeshav23/Warrior-OS` · production branch: `master`

## 1. What works without any keys

Deploying with no environment variables at all gives a fully working OS:

| Feature | Without keys | With keys |
|---|---|---|
| All 19 apps, XP, achievements, creature, decay, dreams, music | Stored in the visitor's browser (localStorage / IndexedDB) | Same, plus mirrored between the owner's devices (`OWNER_PASSWORD`, section 4) |
| NEXUS chat | Offline rule-based brain (`/api/ai` answers `model: nexus-offline`) | Gemini (`GEMINI_API_KEY`) |
| Weather | Keyless Open-Meteo through `/api/weather` | OpenWeatherMap (`WEATHER_API_KEY`); a rejected key falls back to Open-Meteo |
| Ghost Warriors | Local campfire: the visitor's other open tabs plus SIM-labelled warriors | Same (live cross-visitor presence is not available for now) |
| Typing-biometrics history | Stays in the browser | Syncs with everything else when owner sync is on |

So the fastest deploy is: deploy with no variables, add keys later.

## 2. Docker / Coolify (the live setup)

The `Dockerfile` builds a Node 22 image from Next.js's `output: 'standalone'` build: a slim runtime that runs `node server.js` as a non-root user on port **3000**.

**Coolify:**

1. **New Resource → Public/Private Repository** → `techkeshav23/Warrior-OS`, branch `master`, Build Pack **Dockerfile**.
2. **Ports Exposes:** `3000`. Attach your domain; Coolify's proxy terminates HTTPS.
3. **Environment Variables:** add `NEXT_PUBLIC_SITE_URL` (your public origin, e.g. `https://os.example.com`) and tick **Build Variable**: it is a `NEXT_PUBLIC_*` value, baked into the bundle at build time through the Dockerfile's `ARG NEXT_PUBLIC_SITE_URL`. Add the server-only values (`OWNER_PASSWORD`, `GEMINI_API_KEY`, `WEATHER_API_KEY`) as normal runtime variables.
4. **Persistent Storage:** add a volume mounted at `/data` (see section 4). Without it, owner sync data is lost on every redeploy.
5. **Deploy.** Enable the GitHub webhook / auto deploy if pushes to `master` should redeploy.

**Plain Docker**, anywhere:

```bash
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://os.example.com -t warrior-os .
docker run -d --name warrior-os -p 3000:3000 \
  -e OWNER_PASSWORD='<temporary password>' \
  -e GEMINI_API_KEY='<optional>' \
  -v warrior-data:/data \
  warrior-os
```

Put it behind a reverse proxy that serves HTTPS and sets `X-Real-IP` (see below). The image already sets `WARRIOR_DATA_DIR=/data`.

## 3. Vercel

1. Sign in at [vercel.com](https://vercel.com) with GitHub, then **Add New → Project** and import `techkeshav23/Warrior-OS` (grant the Vercel GitHub app access to the repo if it is not listed).
2. Leave the detected defaults: Framework Preset **Next.js**, Root Directory `./`, build/install/output commands untouched.
3. Open **Environment Variables** and add the ones you want from the table below (all optional). Tick **Production** and, if previews should have them too, **Preview**.
4. Click **Deploy**. The production URL is `https://<project>.vercel.app`; add a custom domain under **Settings → Domains** if you like.
5. **Settings → Build and Deployment → Node.js Version:** `22.x` (Next.js 16 needs 20.9 or newer).
6. **Production branch:** Vercel takes the repository's default branch, `master`; confirm it under **Settings → Environments → Production → Branch Tracking**. Every push to `master` redeploys production.
7. **Preview deploys** are automatic: every other branch and every pull request gets its own URL, posted on the PR by the Vercel bot. They use the variables scoped to **Preview**. Preview URLs are behind Vercel Authentication by default (**Settings → Deployment Protection**); the production domain stays public.

After changing any variable, redeploy (**Deployments → ⋯ → Redeploy**): `NEXT_PUBLIC_*` values are baked into the bundle at build time, and server values apply to new deployments only.

Owner sync needs a disk that survives restarts, which Vercel's serverless filesystem is not. Leave `OWNER_PASSWORD` unset on Vercel; use the Docker / Coolify setup (or any VM running `next start`) if you want sync.

### Environment variables

The same list, with comments, is in [`.env.example`](.env.example).

| Variable | Scope | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | Server only | [Google AI Studio](https://aistudio.google.com/apikey) → Create API key |
| `WEATHER_API_KEY` | Server only | [OpenWeatherMap](https://home.openweathermap.org/api_keys) (new keys can take a couple of hours to activate) |
| `OWNER_PASSWORD` | Server only | Temporary owner password (8+ characters) for the first sign-in, which then asks for your own password (section 4). Unset → sync off, any owner password unlocks locally |
| `WARRIOR_DATA_DIR` | Server only | Folder for `sync.json`. Defaults to `./.data` locally; the Docker image sets `/data` |
| `NEXT_PUBLIC_SITE_URL` | Public, build time | Your public origin, e.g. `https://warrior-os.vercel.app` (used for link previews; defaults to the Vercel production domain). **Required when hosting anywhere other than Vercel** (Docker: pass it as a build arg) |

Keep the Gemini, weather and sync values under exactly these names. Never create `NEXT_PUBLIC_` versions of them: anything named `NEXT_PUBLIC_*` is shipped to every browser.

**Hosting off Vercel** (Docker, Coolify, a Node server, another platform): set `NEXT_PUBLIC_SITE_URL` before `npm run build` (for Docker, as the `NEXT_PUBLIC_SITE_URL` build arg). Without it and without Vercel's `VERCEL_PROJECT_PRODUCTION_URL`, the `og:image` / `twitter:image` link-preview URLs fall back to `http://localhost:3000`, so shared links show no preview image. Also have your reverse proxy set `X-Real-IP` (or append the client address to `X-Forwarded-For`): the per-IP rate limits on `/api/ai`, `/api/weather` and the wrong-password limit on `/api/owner` / `/api/sync` read the client address from those headers.

## 4. Owner sync (optional)

Owner sync mirrors the owner's saved data (notes, decks, habits, projects, expenses, progress, settings, typing-biometrics history) between their devices through the app's own server: `/api/sync` (`src/app/api/sync/route.ts`) stores it in one JSON file on the server's disk, `sync.json` in `WARRIOR_DATA_DIR`. No third-party service is involved.

1. **Pick a temporary password** (8+ characters). It is only for the very first sign-in.
2. **Set `OWNER_PASSWORD`** to it as a server-only (runtime) variable and redeploy. Unset or shorter than 8 characters, sync is off, `GET /api/sync?status=1` reports `{ "configured": false }`, and the lock screen behaves as before (any owner password unlocks, local only).
3. **Persist the data.** Docker / Coolify: add a persistent volume mounted at `/data`. Use a named volume (Coolify's **Persistent Storage** → Volume, or `-v warrior-data:/data`) rather than a bind-mounted host folder, so it inherits the image's `/data` ownership and the non-root `nextjs` user can write to it. A plain Node server writes to `./.data` unless you set `WARRIOR_DATA_DIR`. On Vercel the filesystem is not persistent, so sync needs a VM or Docker host.
4. **First sign-in.** On the lock screen, type the temporary password and press Enter. The OS asks for a **new password** and to **confirm** it; saving it unlocks and connects that device. The new password is stored on the server as a salted scrypt hash in `owner.json` (next to `sync.json`), and from then on the temporary password no longer works.
5. **Connect each other device** by unlocking it with your password (or Settings → Account → **Connect this device**). A wrong password does not unlock the owner session. Change the password any time in Settings → Account (current, new, confirm); other devices then ask for the new one at their next unlock. Devices never store the password itself, only a credential the server issued plus a salted hash for offline unlock. The Account tab also shows the sync state, **Sync now** and **Disconnect**. Guest sessions hold demo data and never sync.

How it behaves (`src/lib/sync/client.ts`, `src/components/os/OwnerSync.tsx`):

- Every `warrior*` localStorage key is mirrored except device-only ones (`DEVICE_ONLY` in `client.ts`: session mode, tour and demo flags, screen layout, caches, phantom and ghost state, and sync's own credential and bookkeeping).
- Each key carries the time it last changed; the newest change wins. Deleted keys travel as tombstones.
- A sync round runs on unlock, every minute, and whenever the tab is shown or hidden.
- On a device's first connect, the server's copy wins for keys that exist on both sides; keys only this device has are uploaded.

**Backups:** everything lives in `/data/sync.json` and `/data/owner.json` (or under `WARRIOR_DATA_DIR`). Copy them off the host, e.g. `docker cp warrior-os:/data/sync.json ./sync-backup.json`, or back up the volume. To restore, put it back in place and restart the container.

**Security notes:**

- The owner password is the only lock: anyone who knows it can read and overwrite the owner's data. Use one you don't use anywhere else.
- Serve the site over HTTPS only: the password is sent once per sign-in, and the device credential on every sync request.
- Wrong passwords are rate limited per client IP (10 failures per 10 minutes), which relies on the `X-Real-IP` / `X-Forwarded-For` note above.
- **Forgot the password?** Delete `owner.json` from the data folder (e.g. `docker exec <container> rm /data/owner.json`) and restart the app: the `OWNER_PASSWORD` temporary password works again and asks for a new one. Synced data in `sync.json` is kept.
- Without a persistent `/data` volume, `owner.json` is lost on redeploy too, so the temporary password becomes active again.

## 5. Run the CI checks locally

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request with Node 22. To reproduce it:

```bash
npm ci
npx tsc --noEmit
npx eslint src
npm run build

# End-to-end smoke test (boots the OS, unlocks it, opens and closes every app)
npx playwright install --with-deps chromium   # once per machine
npm run test:e2e
```

`npm run test:e2e` starts `next start` on port 3100 (or reuses a server already running there), so build first. To use a Chromium that is already installed, point `PW_CHROMIUM_PATH` at its binary. Reports and failure screenshots land in `tests/.results/`; on GitHub they are attached to the run as the `playwright-report` artifact.

To block merges on red builds: GitHub **Settings → Branches → Add rule** for `master`, require the **Typecheck, lint, build** and **E2E smoke (Playwright)** checks.
