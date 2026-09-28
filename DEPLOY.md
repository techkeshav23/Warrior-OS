# Deploying Warrior OS

Warrior OS is a standard Next.js 16 app: Vercel hosts it, GitHub Actions checks it, and Firebase and the API keys are optional add-ons. Every step below is done from your own machine and browser.

Repository: `github.com/techkeshav23/Warrior-OS` · production branch: `master`

## 1. What works without any keys

Deploying with no environment variables at all gives a fully working OS:

| Feature | Without keys | With keys |
|---|---|---|
| All 19 apps, XP, achievements, creature, decay, dreams, music | Stored in the visitor's browser (localStorage / IndexedDB) | Same |
| NEXUS chat | Offline rule-based brain (`/api/ai` answers `model: nexus-offline`) | Gemini (`GEMINI_API_KEY`) |
| Weather | Keyless Open-Meteo through `/api/weather` | OpenWeatherMap (`WEATHER_API_KEY`); a rejected key falls back to Open-Meteo |
| Ghost Warriors | Local campfire: the visitor's other open tabs plus SIM-labelled warriors | Live presence and war cries (`NEXT_PUBLIC_FIREBASE_DATABASE_URL`) |
| Typing-biometrics cloud copy | Off; history stays local | Hourly averages copied to Firestore while a user is signed in (`NEXT_PUBLIC_FIREBASE_*`) |

So the fastest deploy is: import on Vercel, deploy, add keys later.

## 2. Vercel

1. Sign in at [vercel.com](https://vercel.com) with GitHub, then **Add New → Project** and import `techkeshav23/Warrior-OS` (grant the Vercel GitHub app access to the repo if it is not listed).
2. Leave the detected defaults: Framework Preset **Next.js**, Root Directory `./`, build/install/output commands untouched.
3. Open **Environment Variables** and add the ones you want from the table below (all optional). Tick **Production** and, if previews should have them too, **Preview**.
4. Click **Deploy**. The production URL is `https://<project>.vercel.app`; add a custom domain under **Settings → Domains** if you like.
5. **Settings → Build and Deployment → Node.js Version:** `22.x` (Next.js 16 needs 20.9 or newer).
6. **Production branch:** Vercel takes the repository's default branch, `master`; confirm it under **Settings → Environments → Production → Branch Tracking**. Every push to `master` redeploys production.
7. **Preview deploys** are automatic: every other branch and every pull request gets its own URL, posted on the PR by the Vercel bot. They use the variables scoped to **Preview**. Preview URLs are behind Vercel Authentication by default (**Settings → Deployment Protection**); the production domain stays public.

After changing any variable, redeploy (**Deployments → ⋯ → Redeploy**): `NEXT_PUBLIC_*` values are baked into the bundle at build time, and server values apply to new deployments only.

### Environment variables

The same list, with comments, is in [`.env.example`](.env.example).

| Variable | Scope | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | Server only | [Google AI Studio](https://aistudio.google.com/apikey) → Create API key |
| `WEATHER_API_KEY` | Server only | [OpenWeatherMap](https://home.openweathermap.org/api_keys) (new keys can take a couple of hours to activate) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public | Firebase web app config: `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Public | `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Public | `projectId` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Public | `storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Public | `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Public | `appId` |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | Public | Realtime Database URL (step 3.5) |
| `NEXT_PUBLIC_SITE_URL` | Public | Your public origin, e.g. `https://warrior-os.vercel.app` (used for link previews; defaults to the Vercel production domain) |

Keep the Gemini and weather keys under exactly these names. Never create `NEXT_PUBLIC_` versions of them: anything named `NEXT_PUBLIC_*` is shipped to every browser. The Firebase web config is public by design; the security rules below are what protect the data.

Tip: to keep preview visitors out of the production campfire, leave `NEXT_PUBLIC_FIREBASE_DATABASE_URL` unset for **Preview** (or point it at a second database).

## 3. Firebase (optional)

Create the project once at [console.firebase.google.com](https://console.firebase.google.com). The free Spark plan is enough.

1. **Create a project**, then **Project settings → General → Your apps → Web (`</>`)**. Register an app (no Firebase Hosting needed) and copy the six config values into the `NEXT_PUBLIC_FIREBASE_*` variables.
2. **Authentication → Get started → Sign-in method:** enable **Google** and **Email/Password** (the providers `src/lib/auth.ts` uses). This only backs cloud sync for signed-in users; the OS itself never requires an account.
3. **Authentication → Settings → Authorized domains:** add your production domain (`<project>.vercel.app` and any custom domain). `localhost` is there already. Wildcards are not supported, so add a specific preview domain only if you sign in there.
4. **Firestore Database → Create database** (production mode, any region), then **Rules** → paste and **Publish**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Each signed-in user owns their own tree, e.g. users/{uid}/biometrics/{day}.
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

5. **Realtime Database → Create Database** (locked mode). Copy the URL shown at the top of the **Data** tab (e.g. `https://<project>-default-rtdb.firebaseio.com`) into `NEXT_PUBLIC_FIREBASE_DATABASE_URL`. Then **Rules** → paste and **Publish**. They match what `src/lib/ghost-presence/realtime.ts` writes: anonymous presence rows that remove themselves on disconnect, and war cries that anyone may prune once they are an hour old.

   ```json
   {
     "rules": {
       "presence": {
         ".read": true,
         ".indexOn": ["lastActive"],
         "$connectionId": {
           ".write": true,
           ".validate": "newData.hasChildren(['anonymousId', 'studyHoursToday', 'quizzesToday', 'streak', 'lastActive'])",
           "anonymousId": { ".validate": "newData.isString() && newData.val().matches(/^Warrior#[0-9][0-9][0-9][0-9]$/)" },
           "studyHoursToday": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 24" },
           "quizzesToday": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 500" },
           "streak": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 10000" },
           "lastActive": { ".validate": "newData.isNumber() && newData.val() <= now" },
           "$other": { ".validate": false }
         }
       },
       "warcries": {
         ".read": true,
         ".indexOn": ["timestamp"],
         "$cryId": {
           ".write": "(!data.exists() && newData.exists()) || (!newData.exists() && data.child('timestamp').val() < now - 3600000)",
           ".validate": "newData.hasChildren(['anonymousId', 'message', 'timestamp'])",
           "anonymousId": { ".validate": "newData.isString() && newData.val().matches(/^Warrior#[0-9][0-9][0-9][0-9]$/)" },
           "message": { ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 50" },
           "timestamp": { ".validate": "newData.isNumber() && newData.val() <= now" },
           "$other": { ".validate": false }
         }
       }
     }
   }
   ```

   Presence needs no sign-in and no API key: the database URL alone turns it on. To check it, click the online counter in the taskbar tray: the leaderboard reads **Live** when connected, and a "Presence write refused" or "Presence read refused" note means the rules were not published.

6. Optional hardening: in [Google Cloud → Credentials](https://console.cloud.google.com/apis/credentials), restrict the Firebase browser key to HTTP referrers: your domains plus `<project>.firebaseapp.com` (sign-in runs there).

Storage is not used; skip it.

## 4. Run the CI checks locally

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
