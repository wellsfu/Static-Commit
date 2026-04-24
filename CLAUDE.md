# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A no-build, vanilla-JS web app for scheduling FF14 raid sessions. Members fill in their weekly availability; the overview page renders a heatmap of overlapping free windows. Data lives in Firestore; the static files are served via GitHub Pages.

Three pages: `index.html` (member picker + fill status), `fill.html` (per-member availability form), `overview.html` (heatmap + detail panel).

## Local development

There is no build step or package manager. Open the HTML files directly in a browser, or serve with any static file server:

```bash
python3 -m http.server 8000
# or
npx serve .
```

**Firebase config is required locally.** Copy the example and fill in real values:

```bash
cp js/firebase.config.example.js js/firebase.config.js
# edit js/firebase.config.js with your Firebase project credentials
```

`js/firebase.config.js` is `.gitignore`d and must never be committed. In CI, GitHub Actions injects it from repository secrets at deploy time.

## Deployment

Pushes to `main` auto-deploy via `.github/workflows/deploy.yml` → GitHub Pages. The workflow injects `js/firebase.config.js` from secrets (`FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, etc.) before uploading the artifact.

To deploy Firestore security rules: `firebase deploy --only firestore:rules`

## Architecture

All JS is ES modules loaded via `<script type="module">`. Firebase SDK is imported directly from `gstatic.com` CDN (no npm).

**Module responsibilities:**
- `js/constants.js` — static data: `MEMBERS` array (member id/name/role), `PRESET_SLOTS` (4 time windows), time bounds
- `js/utils.js` — pure date/time helpers (ISO week ID, date ranges, time arithmetic, formatting)
- `js/data.js` — all Firestore reads/writes (`getMemberWeekData`, `saveMemberWeekData`, `getFullWeekData`, `watchWeekStatus`)
- `js/firebase.js` — initializes Firebase app and exports `db`
- `js/index.js` — home page: renders member buttons, live-updates fill status via `onSnapshot`
- `js/fill.js` — availability form: day cards with preset slot toggles, time adjusters, "apply to all days" shortcut, submit to Firestore
- `js/overview.js` — heatmap: fetches all member data, renders 7×28 grid (30-min cells, 13:00–27:00), click-to-detail panel

**Firestore data shape:**
```
weeks/{weekId}/members/{memberId}              { updatedAt }
weeks/{weekId}/members/{memberId}/days/{date}  { unavailable: bool, slots: [{start, end}] }
```
`weekId` is ISO week format: `YYYY-Www` (e.g. `2026-W17`). `date` keys are `YYYY-MM-DD`.

**To add or rename a member:** edit only `js/constants.js` — the `MEMBERS` array drives all pages.

**To add a preset time slot:** edit `PRESET_SLOTS` in `js/constants.js`. Slots are matched back from Firestore by `start`+`end` values, not by `id`.
