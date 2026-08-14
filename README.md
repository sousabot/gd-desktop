# GD Esports Desktop

A League of Legends stats tracker, styled like DPM.LOL with a GD Esports
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
GitHub Pages serves that folder at `https://sousabot.github.io/gd-desktop/`.

```bash
npm run dist          # Windows installer + portable
npm run dist:portable # portable .exe only
```

Do not put `RIOT_API_KEY` in a public release. A public app needs a backend that holds the key.

## API proxy (for testers / public builds)

The desktop app can call Riot through `server/` so the key never ships in the `.exe`.

1. Deploy the repo as a Render Web Service (`render.yaml`). Set `RIOT_API_KEY` (and `DISCORD_WEBHOOK_URL` if you want in-app feedback).
2. Put the HTTPS URL in `client.env`:

```
GD_API_URL=https://your-service.onrender.com
```

3. `npm run dist:portable` and send that exe. Local `npm run dev` still uses `.env` directly.

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
it, with DevTools attached. Without a `RIOT_API_KEY` set, every page falls
back to mock/sample data automatically — the app fully renders and is
click-through-able either way, so you can see the UI before wiring up the
key.

## Build a distributable

```bash
npm run dist          # Windows installer + portable into release/
npm run dist:portable # portable .exe only
```

Do not ship `.env` / `RIOT_API_KEY` in a public binary.

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
`window.riotAPI` isn't present for any reason, everything falls back to
`src/services/mockData.js` instead of crashing.

## Known rough edges

- **Rate limits**: a dev key allows 20 req/sec, 100 req/2min. Fine for one
  profile view; the leaderboard page pulls up to 50 entries in one call
  (that's within one League-v4 request, so it's fine) but if you add
  bulk match-fetching across many players you'll want a cache layer.
- **Region is hardcoded** to `europe`/`euw1` in a couple of default calls
  (`Dashboard.jsx`, `Leaderboard.jsx`) — the region picker only currently
  lives on the Link Account page. Worth centralizing later.
- **Champion/profile icon CDN** pinned to Data Dragon `14.14.1` — bump
  that version string each patch, or fetch it dynamically from
  `https://ddragon.leagueoflegends.com/api/versions.json`.
- **Brand colors are placeholders.** I couldn't pull real colors from
  gdesports.uk (it loaded as a blank JS shell when I fetched it). Every
  color derives from `src/styles/gd-theme.css` — swap the hex values
  there and the whole app follows.
- **No public Riot key in the client** — a downloadable app must call your
  own backend. Personal keys stay in local `.env` for development only.
