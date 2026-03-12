# FPL Draft Dashboard — FC Driegangendiner

> Auto-updating dashboard for FPL Draft League 820 with standings, head-to-head comparisons, gameweek trends, point predictions, and more.

## Status

In planning -- tickets are being created by the architect agent.

## Documentation

- [Research Report](docs/research-report.md) — Market analysis, technology comparison, cost estimation
- [Technical Blueprint](docs/technical-blueprint.md) — Architecture, component design, data model, deployment
- [Verification Review](docs/verification-review.md) — Independent technical review findings
- [Tickets](docs/tickets.md) — Implementation backlog
- [Human Input Needed](docs/human-input-needed.md) — Blockers requiring human decision

## Architecture

```
GitHub Actions (cron) --> FPL Draft API --> JSON files --> Astro SSG --> GitHub Pages
```

- **Data Pipeline:** GitHub Actions fetches FPL Draft API data every 6 hours, commits JSON to repo
- **Frontend:** Astro static site with Svelte interactive islands and Chart.js visualizations
- **Hosting:** GitHub Pages (free, zero cost)
- **Cost:** $0/month

## Quick Start

> To be filled in by the engineer agent after initial setup is complete.
