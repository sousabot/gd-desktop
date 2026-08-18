# RIFT.LOL Desktop

A League of Legends stats tracker, RIFT.LOL
identity (violet + gold, Space Grotesk headers, mono stat numbers), built
as an Electron + React (Vite) app.

**This is a fresh scaffold, not a merge of your previous `gd-desktop`
project.** Your earlier screenshots only showed filenames
(`Leaderboard.jsx`, `LinkAccount.jsx`, etc.), not their contents, so I
rebuilt working versions of each page from scratch rather than guessing at
what was already there. If you still have the old project, treat this as
the new base and port over anything custom you want to keep.

## Product site

The public landing page, privacy policy, and terms live in `docs/`.
GitHub Pages serves that folder at `https://sousabot.github.io/rift-desktop/`.

```bash
npm run dist          # Windows installer + portable
npm run dist:portable # portable .exe only
```

Do not put `RIOT_API_KEY` in a public release. A public app needs a backend that holds the key.

## API proxy (for testers / public builds)

The desktop app can call Riot through `server/` so the key never ships in the `.exe`.

1. Deploy the repo as a Render Web Service (`render.yaml`). Set `RIOT_API_KEY`, **`RIFT_APP_TOKEN`**, and `DISCORD_WEBHOOK_URL` if you want in-app feedback.
2. Put the same values in `client.env` (gitignored). `npm run dist` creates this file and generates a token if it is empty:

```
RIFT_API_URL=https://your-service.onrender.com
RIFT_APP_TOKEN=the-same-token-as-render
```

The hosted proxy refuses Riot and feedback calls without that token. Local `npm run server` with an empty token only accepts localhost.

3. `npm run dist` and send **`release\Rift.lol-Setup-0.1.11.exe`** (the installer). Portable still works, but it cannot auto-update. Local `npm run dev` still uses `.env` (set `RIFT_USE_LOCAL_KEY=1` to skip the proxy).

Windows SmartScreen / Defender will warn (the exe is unsigned). Tell testers: **More info → Run anyway**. If Defender quarantined the file: **Windows Security → Virus & threat protection → Protection history → Allow**. Do not send an older exe that bundled a key.

## Setup

```bash
npm install
cp .env.example .env
# then edit .env and add:
# RIOT_API_KEY=RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Get a key at https://developer.riotgames.com — a personal dev key expires
every 24h, fine for testing. For anything you'd actually ship, you need a
production key, which requires an app submission to Riot.

## Run it

```bash
npm run dev
```

This starts the Vite dev server and opens the Electron window pointed at
it, with DevTools attached. Without a Riot key or proxy token, pages show
an error instead of fake stats.

## Build a distributable

```bash
npm run dist          # Windows installer + portable into release/
npm run dist:portable # portable .exe only
```

Do not ship `.env` / `RIOT_API_KEY` in a public binary.

## Auto-updates

A **portable** `.exe` cannot replace itself while it is running. In-app
updates only work for people who installed **Rift.lol-Setup-x.x.x.exe**.

After that, the app checks GitHub Releases on launch (and every few hours).
Installed copies download the new build in the background and show a
**Restart now** bar. Portable copies only get a prompt to install Setup
once — then they auto-update too.

Anyone already on an older portable still has to install Setup **one time**.
There is no way to push code into an exe that never had an updater.

### Ship an update

Use **`npm run dist`** to build locally. That does not need `GH_TOKEN`.

Use **`npm run release`** only when you want GitHub Releases (auto-update). In PowerShell, two lines — never paste the token into chat or onto the same line as the npm command:

```powershell
$env:GH_TOKEN = "YOUR_TOKEN"
npm run release
```

That builds Setup + portable and publishes a GitHub Release with
`latest.yml` (required). The installed app reads that file and updates.

If you already ran `npm run dist`, you can upload these files to a
Release tagged `v0.1.11` instead:

- `Rift.lol-Setup-0.1.11.exe`
- `Rift.lol-Setup-0.1.11.exe.blockmap`
- `latest.yml`

Keep the Setup artifact name exactly like that. Do not upload only the
portable build if you want silent updates.


## Pages

| Route | File | Status |
|---|---|---|
| `/` | `src/pages/Dashboard.jsx` | Stat cards, recent matches, champion performance |
| `/leaderboard` | `src/pages/Leaderboard.jsx` | Challenger/GM/Master tables via League-v4 |
| `/live` | `src/pages/LiveStatus.jsx` | Spectator-v5 check for the linked account |
| `/link-account` | `src/pages/LinkAccount.jsx` | Verifies a Riot ID exists, stores it locally |
| `/login` | `src/pages/Login.jsx` | Entry screen, links to account linking |

There's no real authentication — "session" is just the linked Riot ID
saved to `localStorage` (`src/state/SessionContext.jsx`) so pages can
share it without a backend. If you want actual user accounts later
(multiple people using the same install, saved history, etc.) that needs
a real backend and is a separate piece of work.

## Why Riot calls go through Electron's main process

Riot's API doesn't send CORS headers, so `fetch()` calls from React
(renderer/browser context) get blocked. `electron/riot-ipc.js` runs in the
main process (plain Node, no CORS) and does the real HTTP calls;
`electron/preload.js` exposes them to React as `window.riotAPI`;
`src/services/riotApi.js` is what your components actually call. If
`window.riotAPI` isn't present, the UI shows an error instead of mock data.

## Known rough edges

- **Rate limits**: a dev key allows 20 req/sec, 100 req/2min. Fine for one
  profile view; the leaderboard page pulls up to 50 entries in one call
  (that's within one League-v4 request, so it's fine) but if you add
  bulk match-fetching across many players you'll want a cache layer.
- **Region** comes from the Link Account picker, then Rift.lol probes the real
  League shard so NA/KR/etc. do not silently load as EUW.
- **Champion/profile icon CDN** uses the current Data Dragon version from
  `https://ddragon.leagueoflegends.com/api/versions.json`.
- **No public Riot key in the client** — a downloadable app must call your
  own backend with `RIFT_APP_TOKEN`. Personal keys stay in local `.env` for development only.
- **Overlays** stay off. In-game HUD injection is not Riot-safe.
