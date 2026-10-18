# Fourth Down — CFP Tracker (v0.1)

Responsive Next.js public-site starter. Live college football scores refresh every 60 seconds through a server-side API route. The tracker shows top-12 / bubble / outside-bubble **poll-based preview**, not actual CFP selection probabilities.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy publicly

1. Push this folder to a GitHub repository.
2. Import that repository at https://vercel.com/new and select Next.js.
3. Deploy. Vercel supplies a public URL; configure a custom domain if desired.

## Architecture

Browser (React UI; 60s polling) → Next.js `/api/live` → ESPN public scoreboard and rankings endpoints. Provider requests cache for ~60s. No API key required for this prototype, but the endpoints are undocumented and can change; verify usage rights before public/commercial distribution.

## Limitations and next milestones

- The 12 displayed teams are top-ranked poll teams, **not** a true projected 12-team CFP field.
- Rankings are whichever poll the provider returns (CFP preferred, otherwise AP), with source shown. Polls do not update every play.
- Scoreboard data may cover only the current week and may omit games depending on upstream feed.
- No automated classification of eliminated/safe/clinched teams; this requires conference standings, full schedules, strength of schedule, probabilistic model, and special 2026 qualification rules.
- The 2026 rules: automatic berths for ACC, Big Ten, Big 12, SEC champions, highest-ranked G6 team (regardless of championship), and Notre Dame if CFP top 12; remaining at-large; top four seeds by committee rank get byes. Source: https://collegefootballplayoff.com/sports/2024/5/29/12-team-format
- For a production public site, move to a licensed data feed, persistent snapshots, a model that recalculates after game finals, alerts, and shareable image generation.
