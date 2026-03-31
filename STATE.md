---
name: LayerOps Project State
description: Current state of the LayerOps site, workers, services, and what's deployed vs pending
type: project
---

## LayerOps — Project State (as of 2026-03-31)

### Live Infrastructure
- **Domain**: layerops.tech (purchased, active, Cloudflare DNS)
- **Wildcard DNS**: `*.layerops.tech` → CNAME → layerops.tech (proxied) — enables client subdomains
- **Site**: Cloudflare Pages connected to GitHub (auto-deploy from jarekpiot/layerops-site master)
- **Chat Worker**: `api.layerops.tech` — Kestrel chatbot proxy (layerops-chat)
- **Audit Worker**: `audit.layerops.tech` — SEO+UX audit + copy review (layerops-audit)
- **Client Worker**: `*.layerops.tech` — multi-tenant client chatbot system (layerops-clients)
- **GitHub Repo**: jarekpiot/layerops-site (public)
- **Cal.com**: Connected, event type ID 5192245 (15 min meeting)

### Workers Summary (4 total)
| Worker | URL | Config | Purpose |
|--------|-----|--------|---------|
| layerops-site | layerops.tech | Cloudflare Pages (GitHub auto-deploy) | Main website |
| layerops-chat | api.layerops.tech | `layerops-worker.js` | Kestrel chatbot for LayerOps |
| layerops-audit | audit.layerops.tech | `wrangler-audit.toml` | SEO+UX audit + copy review |
| layerops-clients | *.layerops.tech | `workers/client-chat/wrangler-clients.toml` | Multi-tenant client chatbot |

### Multi-Tenant Client Chatbot System — LIVE
- **Worker**: `layerops-clients` — routes by subdomain, serves landing page + AI chatbot
- **KV Namespace**: `CLIENTS` (ID: 8f8f82f39ade45f2914bd9ec34ec9ea1) — stores per-client config
- **Routing**: `{slug}.layerops.tech` → KV lookup → dynamic landing page (GET) or chat API (POST)
- **Widget**: `<script src="https://{slug}.layerops.tech/widget/{slug}"></script>` — embeddable chat widget
- **Onboarding**: `node tools/onboard.js` — interactive CLI to create new client configs
- **Demo LIVE**: `demo.layerops.tech` — "Sam's Plumbing Canberra" (fictional tradie, working chatbot)
- **Demo page**: `layerops.tech/demo/` — overview page with iframe of demo site
- **Deploy**: `npx wrangler deploy -c workers/client-chat/wrangler-clients.toml`
- **Add client**: `npx wrangler kv key put "{slug}" --path=config.json --binding=CLIENTS -c workers/client-chat/wrangler-clients.toml --remote`

### Audit Worker — SEO + UX + Copy Review (2 modes)
- **Audit mode** (default): POST `{"url": "https://..."}` — 9 categories (5 SEO + 4 UX), 7 prioritised fixes
- **Copy review mode**: POST `{"url": "...", "mode": "copy"}` — flags over-promises, missing proof, vague claims
- SEO categories: technical_seo, on_page_seo, content, mobile, social_sharing
- UX categories: accessibility, navigation_structure, trust_conversion, performance
- Copy categories: honesty, proof, clarity, cta_quality, tone_consistency
- Rate limited: 10 audits/hour per worker instance
- Deploy: `npx wrangler deploy -c wrangler-audit.toml`

### Kestrel Chatbot (LayerOps own site)
- Answers questions about LayerOps services
- Cal.com booking integration — checks real availability, books appointments in-chat
- Multi-turn conversation history
- Rich text rendering (bold, links) in chat bubbles
- Email assistant code ready but NOT configured (needs Gmail OAuth secrets)

### Website Services (5 total)
1. AI Landing Pages & Funnels — from $1,500
2. Automation Builds — from $2,000
3. AI Content Systems — from $2,000/month
4. Kestrel AI Employee — Pilot Available
5. SEO Quick Fix — from $299

### SEO Status
- Canonical URL, robots meta tag added
- Title tag optimised (59 chars)
- Twitter image + summary_large_image card
- JSON-LD schema: LocalBusiness, WebSite, 5x Service, FAQPage
- OG tags + Twitter Card tags
- Proper heading hierarchy (h1 > h2 > h3)
- robots.txt + sitemap.xml with blog URLs
- lang="en-AU", geo tags for Canberra
- FAQ section with 6 questions (accordion)
- Blog: 3 posts by Kestrel AI
- Accessibility: skip nav link, semantic HTML (header, main, footer, nav), form labels

### Copy Review Applied (2026-03-31)
- Softened "save hours every week" → "designed to save time"
- Changed "never clocks off" → "works around the clock"
- "Don't take our word for it" → "We're new — and honest about it" (no fake testimonials)
- "You See Results" → "We Track Progress"
- H1 changed to specific problem statement
- All meta/OG/Twitter descriptions updated to match

### Blog Posts Live
1. /blog/5-ways-ai-saves-small-business-time.html
2. /blog/what-is-workflow-automation.html
3. /blog/ai-vs-hiring-when-to-automate.html

### Batch Audit Tool
- `node tools/batch-audit.js` — crawls target businesses, generates SEO+UX reports + outreach emails
- 10 real Canberra businesses in tools/targets.json
- Outputs: tools/audit-results.json + tools/outreach-emails.md

### Worker Secrets Configured
| Worker | Secret | Status |
|--------|--------|--------|
| layerops-chat | ANTHROPIC_API_KEY | Set |
| layerops-chat | CAL_COM_API_KEY | Set |
| layerops-chat | CAL_EVENT_TYPE_ID | Set (5192245) |
| layerops-chat | GOOGLE_CLIENT_ID | NOT SET |
| layerops-chat | GOOGLE_CLIENT_SECRET | NOT SET |
| layerops-chat | GOOGLE_REFRESH_TOKEN | NOT SET |
| layerops-audit | ANTHROPIC_API_KEY | Set |
| layerops-clients | ANTHROPIC_API_KEY | Set (⚠️ ROTATE — key was exposed in chat) |

### Competitive Assessment Score: 6.3/10
- Strengths: Copy (8/10), Pricing transparency (9/10)
- Weaknesses: Trust signals (3/10 — no testimonials), Content depth (2.5/10 — improving with blog)
- Key gap: Need real client testimonials and case studies

### Pending Items
- ⚠️ **URGENT: Rotate Anthropic API key** — exposed in conversation, update on all 3 workers
- Set up dedicated email (Gmail or Workspace)
- Configure Gmail API OAuth for Kestrel email assistant
- Run batch audit on Canberra businesses for lead gen
- Get first client testimonials
- Jarek founder photo on site
- Create OG image as PNG (SVG exists but some platforms need PNG)
- Google Business Profile for local SEO
- Individual service pages for deeper SEO targeting
- More blog posts (target 10-20 for organic traffic)
- Link demo page from main LayerOps site services section
- Onboard first real client via `node tools/onboard.js`
