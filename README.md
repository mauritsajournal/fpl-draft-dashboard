# FPL Draft Dashboard -- FC Driegangendiner

> Auto-updating dashboard for FPL Draft League 820 with standings, head-to-head comparisons, gameweek trends, point predictions, and more.

## Quick Start

```bash
# Install dependencies
npm install

# Fetch latest data from FPL API
npm run fetch

# Build dashboard data
npm run transform

# Start dev server
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

## Architecture

```
GitHub Actions (cron 4x/day) --> FPL Draft API --> JSON files --> Astro SSG --> GitHub Pages
```

- **Data Pipeline:** GitHub Actions fetches FPL Draft API data every 6 hours, commits JSON to repo
- **Frontend:** Astro 5 static site with Svelte 5 interactive islands
- **Styling:** Tailwind CSS 4
- **Hosting:** GitHub Pages (free, zero cost)
- **Cost:** $0/month

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Astro dev server |
| `npm run build` | Build static site to `dist/` |
| `npm run preview` | Preview production build |
| `npm run test` | Run Vitest tests |
| `npm run fetch` | Fetch all FPL API data to `data/` |
| `npm run transform` | Transform raw data into `dashboard.json` |

## Documentation

- [Technical Blueprint](docs/technical-blueprint.md) -- Architecture, component design, data model, deployment
- [Tickets](docs/tickets.md) -- Implementation backlog
- [Research Report](docs/research-report.md) -- Market analysis, technology comparison, cost estimation
