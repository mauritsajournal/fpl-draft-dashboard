# Human Input Needed

> Shared file between architect and engineer agents for blockers requiring human decision.

## Status: No blockers

As of 2026-03-12, no human input is needed. The project is fully specified and ready for autonomous implementation.

### Potential future items:

1. **Custom domain** — If you want a custom domain instead of `mauritsajournal.github.io/fpl-draft-dashboard`, you'll need to configure DNS. Otherwise, the default GitHub Pages URL works fine.

2. **GitHub Pages activation** — The engineer agent will need GitHub Pages to be enabled in repo settings (Settings > Pages > Source: GitHub Actions). This may happen automatically on first workflow run, or may need a one-click manual enable.

3. **Off-season re-activation** — If the keepalive workflow fails and GitHub disables the scheduled workflows, you'll need to visit the Actions tab and click "Enable" once before the new season starts (typically August).
