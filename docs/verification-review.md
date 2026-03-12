# Independent Technical Review — FPL Draft Dashboard

## Overall Assessment: **Needs Revision**

The documents are well-structured and the core architecture (GitHub Actions → static JSON → Astro SSG) is sound for the stated requirements. However, there are several critical and major issues that need addressing before handing this to an engineer agent.

---

## Critical Findings

### C1. API Endpoint Assumptions Are Unverified
**Section:** Research §5.1–5.8, Blueprint §5.1–5.8

The research report states endpoints were "verified" but provides no evidence of actual API calls. Several endpoints use inconsistent URL patterns:
- `draft.premierleague.com/api/draft/league/820/transactions` (§5.6)
- `draft.premierleague.com/api/draft/820/choices` (§5.7)

One uses `/draft/league/820/`, the other `/draft/820/`. If either is wrong, the engineer agent will waste significant time debugging.

**Also:** The fixtures endpoint (§5.8) switches to `fantasy.premierleague.com` (regular FPL, not Draft). No verification that this API also has no auth requirement or that its fixture data maps cleanly to Draft league context.

**Recommendation:** Run every endpoint once, capture actual response shapes, and include sample response snippets in the blueprint. Create TypeScript types from real data, not assumptions.

---

### C2. 232-Request Batch Fetch Will Likely Get Rate-Limited
**Section:** Blueprint §5.4

Fetching picks for 8 entries × 29 GWs = 232 requests with a 200ms delay = ~46 seconds of API calls in a single workflow run. The report acknowledges rate limits are "unknown/undocumented" (§5.1) but then designs a system that hammers the API with hundreds of requests.

The "optimization" note says "only fetch new GWs" but the blueprint provides no mechanism for tracking which GWs have already been fetched. The JSON files are overwritten each run — there's no incremental state management described.

**Recommendation:** Design an explicit caching/state strategy. Store a `data/meta.json` with `lastFetchedGameweek` and only fetch new data. For the initial seed, add progressive backoff and split across multiple workflow runs if needed.

---

### C3. Git Commit Loop Can Cause Infinite Builds
**Section:** Blueprint §7.2

Workflow 1 (`fetch-data.yml`) commits to `main`. Workflow 2 (`deploy.yml`) triggers on push to `main`. If Workflow 2 somehow touches `data/` or if the path filter isn't perfectly configured, this creates a loop. More practically: every data fetch triggers a full site rebuild. With 4 fetches/day, that's 4 rebuilds/day — fine, but the blueprint doesn't address the commit authorship. GitHub Actions commits using `GITHUB_TOKEN` do **not** trigger subsequent workflows by default, which would actually **break** the deploy pipeline.

**Recommendation:** Explicitly address this. Either:
- Use a Personal Access Token (PAT) for the data commit step (triggers deploy), or
- Combine both workflows into one (fetch → build → deploy), or
- Use `workflow_run` trigger for the deploy workflow.

This is a well-known GitHub Actions gotcha and ignoring it means the dashboard will never auto-deploy after data updates.

---

## Major Findings

### M1. xG/xA Data Is Not Available in the Draft API
**Section:** Research §2.1 (FR-004), Blueprint §3.2, §4.1

Point predictions (FR-004) are listed as "Should" priority and depend on xG and xA data. The data model (Blueprint §4.1) includes `xG, xA` as player fields. However, the FPL Draft API `bootstrap-static` endpoint does **not** include expected goals/assists data — these are not standard FPL data fields. xG/xA come from third-party providers (Opta, FBref, Understat).

This means FR-004 either needs a third-party data source (adding complexity and potentially cost) or needs to be redesigned to use simpler heuristics (form, fixture difficulty rating from the API).

**Recommendation:** Either descope FR-004 to use only available FPL data (form + FDR-based predictions), or explicitly add a third-party xG data source to the architecture with its own fetch script, rate limits, and failure handling.

---

### M2. GitHub Actions 60-Day Inactivity Timeout Is Underestimated
**Section:** Research §6 (Risk table)

The research rates this as "Medium" likelihood but it's actually **certain** during the off-season (roughly June–August = 2–3 months). The FPL season runs ~August to May. The cron will be disabled and must be manually re-enabled every season.

The suggested mitigation ("dependabot, manual trigger, or document re-enable procedure") is vague. Dependabot only works if you have dependencies to update. The whole point of the project is zero user input (NFR-002).

**Recommendation:** Add a keepalive workflow that runs weekly year-round with a no-op job. This is a well-established pattern. Alternatively, accept this as a known limitation and document it clearly — the user will need to click "Enable" once per season.

---

### M3. No Error Handling for Partial Data States
**Section:** Blueprint §3.1, §3.2

The fetch scripts are independent, but the transform step assumes all JSON files exist and are valid. What happens when:
- `players.json` fetches successfully but `league.json` fails?
- A fetch returns valid HTTP 200 but with truncated/empty JSON?
- The API returns a different structure mid-season (e.g., new fields, removed fields)?

The blueprint says "retry 3x" per endpoint but never addresses what the transform step does with missing/stale files. The dashboard build will either fail or render stale data without any indication.

**Recommendation:** Add validation between fetch and transform. The transform step should check file timestamps, validate JSON schemas, and either fail loudly (so the Actions notification fires) or generate a degraded `dashboard.json` with explicit markers for missing data sections.

---

### M4. `live.json` Will Grow Unboundedly
**Section:** Blueprint §4.2

`live.json` is described as "cumulative" and estimated at ~2 MB. But it stores per-player per-GW stats. With ~700 players × 38 GWs, this grows through the season. The 2 MB estimate seems reasonable for end-of-season, but the blueprint stores **all** GWs in one file with no pagination or splitting strategy.

More importantly, this file is committed to Git on every fetch cycle. Git doesn't handle large, frequently-changing binary-like JSON well — the repo will accumulate significant history bloat.

**Recommendation:** Split live data by gameweek (`data/live/gw01.json`, `data/live/gw02.json`). Only update the current/latest GW file. Completed GW files never change, so they add zero Git overhead after first commit.

---

### M5. No Consideration of API Downtime During Live Matches
**Section:** Research §7, Blueprint §5

The FPL API is notoriously unreliable during live match days — high load causes timeouts and 503s. The "every 6 hours" cron will often coincide with live matches. The retry strategy (3x with 5s delay) is insufficient for prolonged API outages that can last 30+ minutes during peak times.

**Recommendation:** Add exponential backoff. Consider offsetting the cron to avoid typical kickoff times (e.g., run at 01:00, 07:00, 13:00, 19:00 UTC rather than on the hour). Document that live-match data will be delayed.

---

### M6. Inconsistent Effort Estimates
**Section:** Research §5.1 vs Blueprint §10

Research estimates 40–55 hours total. Blueprint phases sum to 45–60 hours. These should match since they describe the same scope. The blueprint also front-loads the hardest integration work (data pipeline) into Phase 1 alongside scaffolding, while the research report treats it as a moderate 4–6 hour task. The data pipeline is the riskiest component and 4–6 hours is optimistic given the 8+ API integrations, caching logic, and transform layer.

**Recommendation:** Align estimates. Budget 8–12 hours for the data pipeline alone (fetch + transform + caching + error handling + CI workflow).

---

## Minor Findings

### m1. Svelte 5 + Astro 5 Integration Maturity
**Section:** Blueprint §2.1

Svelte 5 uses runes (a fundamentally different reactivity model from Svelte 4). The Astro + Svelte integration (`@astrojs/svelte`) should be verified for Svelte 5 compatibility. As of early 2026, this should be stable, but it's worth pinning compatible versions in `package.json`.

**Recommendation:** Verify `@astrojs/svelte` adapter supports Svelte 5 runes. Pin versions.

---

### m2. No Favicon, OG Tags, or Social Sharing Metadata
**Section:** Blueprint §3.3, §3.5

For a dashboard shared among friends, basic metadata (page title per route, favicon, maybe an OG image) would make link-sharing in group chats much nicer. Not mentioned anywhere.

**Recommendation:** Add to Phase 1 scope — it's 30 minutes of work.

---

### m3. "Bench Points Lost" Requires Substitution Logic
**Section:** Research §2.1 (FR-014), Blueprint §3.2

FPL Draft has auto-substitution rules. Calculating "bench points lost" isn't simply "sum bench player points" — you need to account for whether a sub would have actually come on (playing XI player didn't play, correct position order, etc.). This is non-trivial logic that isn't acknowledged in the effort estimates.

**Recommendation:** Either document the substitution algorithm explicitly or descope to "bench player total points" (simpler, still useful).

---

### m4. No 404 Page or Error States
**Section:** Blueprint §3.3

Dynamic routes like `/teams/[slug]/` will generate pages for 8 teams. If the slug doesn't match, Astro returns a default 404. No custom 404 page is planned, and no loading/error states are described for chart components.

**Recommendation:** Add a custom 404 page and empty-state designs for charts when data is missing.

---

### m5. Dashboard Will Show Stale Data Between Seasons
**Section:** Research §6 (Risk table)

"Season ends — dashboard becomes static" is noted as expected. But when the new season starts, all the old data is still there and the data pipeline will start overwriting it. There's no archival strategy for previous season data and no handling of the bootstrap-static endpoint returning new-season data that breaks old-season transforms.

**Recommendation:** Add season awareness. Either archive old data into `data/2025-26/` or accept data loss between seasons and document it.

---

## Suggestions

### S1. Add a Manual Refresh Button via `workflow_dispatch`
The blueprint mentions `workflow_dispatch` in the cron workflow but doesn't expose it to the dashboard UI. A small "Refresh Data" link pointing to the GitHub Actions manual trigger URL (or a badge) would let users force an update during live GWs without touching the repo.

### S2. Consider Cloudflare Pages Instead of GitHub Pages
The research (§4.3) lists Cloudflare Pages as an alternative with "Excellent" performance. Given the user already has Cloudflare in their stack (per memory), this could be a simpler deployment story. However, this contradicts NFR-008/C-002, so it's just worth flagging.

### S3. Add a Data Health Page
A `/status/` page showing last successful fetch per endpoint, data freshness per JSON file, and any fetch errors from the last run would make debugging trivial. This is especially valuable since there's no monitoring infrastructure.

### S4. Chart.js Tree-Shaking
Blueprint §2.1 lists Chart.js 4.x but doesn't mention tree-shaking configuration. Chart.js 4 supports tree-shaking via named imports, which can reduce the bundle from ~65 KB to ~30 KB depending on chart types used. Worth documenting the import strategy.

---

## Summary Table

| ID | Severity | Category | Summary |
|----|----------|----------|---------|
| C1 | Critical | Gaps | API endpoints unverified, inconsistent URL patterns |
| C2 | Critical | Under-engineering | 232-request batch with no caching strategy |
| C3 | Critical | Gaps | GitHub Actions commit → deploy trigger chain is broken by design |
| M1 | Major | Inconsistency | xG/xA data not available in FPL Draft API |
| M2 | Major | Risk | Off-season cron disable is certain, not "medium likelihood" |
| M3 | Major | Gaps | No handling of partial data / failed fetches in transform |
| M4 | Major | Under-engineering | `live.json` grows unbounded, Git history bloat |
| M5 | Major | Risk | API unreliable during live matches, retry strategy insufficient |
| M6 | Major | Inconsistency | Effort estimates don't match between documents |
| m1 | Minor | Dependency risk | Svelte 5 + Astro 5 integration maturity |
| m2 | Minor | Gaps | No metadata for social sharing |
| m3 | Minor | Under-engineering | Bench analysis requires non-trivial substitution logic |
| m4 | Minor | Gaps | No 404 page or empty states |
| m5 | Minor | Gaps | No season archival strategy |
| S1 | Suggestion | Feature | Expose manual refresh to dashboard UI |
| S2 | Suggestion | Architecture | Consider Cloudflare Pages given existing stack |
| S3 | Suggestion | Operability | Add a data health/status page |
| S4 | Suggestion | Performance | Document Chart.js tree-shaking strategy |

---

**Verdict: Needs Revision.** The core architecture is valid but three critical issues (C1–C3) must be resolved before implementation. C3 in particular will cause the entire auto-update pipeline to silently fail. The xG/xA assumption (M1) could waste hours of engineering time on a feature that can't work as designed. Addressing the critical and major items should add ~4–6 hours to the estimate but will prevent significantly more time lost to debugging during implementation.
