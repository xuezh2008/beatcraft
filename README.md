# BeatCraft Web

A 375px mobile web app for gamified music creation. Three views (Orchestra / Pads / Studio) over the Web Audio API — no samples, pure synthesis.

## Features

- **Orchestra** — 5 concentric arcs, drag along each to play the 8-note scale of that instrument.
- **Pads** — 4×4 grid with rows mapped to kick / snare+hat / bass / synth lead.
- **Studio** — recordings library with save, rename, delete, and mix.
- **Record / Overdub** — tap ● to record. Toggle NEW vs OVERDUB to either create a new recording or append to the active one. Anything in the mix plays back under you while you record.
- **Mix** — check multiple recordings in Studio; Play All loops them in parallel. Mute any instrument globally via the chip on each recording.
- **Persistence** — recordings live in `localStorage`. Close the tab, come back later.

## Dev

```bash
npm install
npm run dev         # http://localhost:5173
npm run dev -- --host   # also expose on LAN for phone testing
npm run build       # dist/ static site
npm run preview     # serve the built bundle
```

## Deploy to GitHub Pages

The repo ships a GitHub Actions workflow at [.github/workflows/deploy.yml](.github/workflows/deploy.yml). To enable it:

1. Push to GitHub.
2. **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Push to `main` (or run the workflow manually). The action builds, copies `index.html` → `404.html` for SPA fallback, and publishes `dist/`.

`vite.config.ts` uses `base: './'`, so the same build works on user pages (`you.github.io`), project pages (`you.github.io/beatcraft/`), or any static host.

## Tech

Vite 5 · React 18 · TypeScript 5.6 · Web Audio API · no external audio libs.
