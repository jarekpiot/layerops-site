---
name: LayerOps Project State
description: Current state of the LayerOps site, workers, services, and what's deployed vs pending
type: project
---

## LayerOps — Project State (as of 2026-04-01)

### Live Infrastructure
- **Domain**: layerops.tech (purchased, active, Cloudflare DNS, wildcard *.layerops.tech)
- **Site**: Cloudflare Pages connected to GitHub (auto-deploy from jarekpiot/layerops-site master)
- **GitHub Repo**: jarekpiot/layerops-site (public)
- **Cal.com**: Connected, event type ID 5192245 (15 min meeting)
- **Email**: jarek@layerops.tech

### Workers (5 total)
| Worker | URL | Code in repo | Config | Purpose |
|--------|-----|-------------|--------|---------|
| layerops-site | layerops.tech | `index.html` + static | Cloudflare Pages (auto-deploy) | Main website |
| layerops-chat | api.layerops.tech | `layerops-worker.js` | Dashboard only (no wrangler.toml) | Kestrel chatbot |
| layerops-audit | audit.layerops.tech | `seo-audit-worker.js` | `wrangler-audit.toml` | SEO+UX+Design audit, copy review, visual analysis, lead capture |
| layerops-clients | *.layerops.tech | `workers/client-chat/` | `workers/client-chat/wrangler-clients.toml` | Multi-tenant client chatbot |
| layerops-email | Email Routing | `jarekpiot/layerops-email` (separate repo) | `wrangler.toml` in that repo | Kestrel email auto-responder |

### layerops-email Worker (separate repo: jarekpiot/layerops-email)
- **Trigger**: Cloudflare Email Routing — receives inbound email to *@layerops.tech
- **Forwards**: all inbound email to jarekpiot@gmail.com (⚠️ should update to jarek@layerops.tech)
- **Auto-replies**: via Resend from kestrel@layerops.tech — thanks + Jarek will get back to you
- **Skips**: noreply, mailer-daemon, postmaster, self-sends
- **Secrets**: RESEND_API_KEY
- **Auto-deploy**: Cloudflare Builds connected to GitHub repo
- **Deploy**: `cd C:/krestel/layerops-email && npm run deploy`

### Audit Worker — 4 Modes
- **POST /** — Full audit: 10 categories (5 SEO + 4 UX + 1 Design), plain English output
- **POST / mode:copy** — Copy review: 5 categories (honesty, proof, clarity, CTA quality, tone)
- **POST /visual** — Visual analysis: screenshots via Cloudflare Browser Rendering + Claude vision (8 categories)
- **POST /lead** — Lead capture: runs audit, stores in KV, emails teaser to visitor + full report to Jarek
- Deploy: `npx wrangler deploy -c wrangler-audit.toml`

### Lead Capture System — LIVE
- Free audit form on homepage: visitor enters email + website URL
- Runs 10-category audit in real-time, shows score + top 3 fix titles on page
- **Visitor email**: score, category numbers, fix titles only (no instructions) + CTA to book call
- **Jarek email**: full report with all issues, fix descriptions, follow-up guidance
- Leads stored in LEADS KV namespace (90 day TTL, indexed by email)
- Email via Resend API (audit@layerops.tech sender)
- All output in plain English — no jargon, business impact focused

### Multi-Tenant Client Chatbot System — LIVE
- **Worker**: `layerops-clients` — routes by subdomain, serves landing page + AI chat
- **KV Namespace**: `CLIENTS` (ID: 8f8f82f39ade45f2914bd9ec34ec9ea1)
- **Routing**: `{slug}.layerops.tech` → KV lookup → dynamic landing page (GET) or chat API (POST)
- **Widget**: embeddable via single `<script>` tag
- **Demo LIVE**: `demo.layerops.tech` — Sam's Plumbing Canberra (fictional tradie, working chatbot + simulated booking)
- **Demo pages**: `layerops.tech/demo/` (overview) + `layerops.tech/demo/embed.html` (widget injection demo)
- **Onboarding**: `node tools/onboard.js` — interactive CLI to create new clients
- WhatsApp support built in (config field), not demoed yet
- Deploy: `npx wrangler deploy -c workers/client-chat/wrangler-clients.toml`

### Website Audit Scores (latest)
- **Overall**: 88/100
- Technical SEO: 95 | On-Page SEO: 92 | Content: 85
- Mobile: 90 | Social Sharing: 95 | Accessibility: 80
- Navigation: 88 | Trust & Conversion: 85 | Performance: 90 | Design: 92
- **Visual audit**: 88/100 (via Browser Rendering + Claude vision)
- **Copy review**: 78/100

### SEO & Accessibility Improvements Applied
- Canonical URL, robots meta tag, Twitter image + summary_large_image
- Title tag optimised (50 chars)
- Meta description optimised (143 chars)
- Skip navigation link, ARIA landmarks (role=banner/navigation/main/contentinfo)
- Semantic HTML: header, main, nav, footer
- Form labels, aria-labels
- Text contrast improved (#5C5C5C meets WCAG AA)
- Mobile hamburger menu: larger, visible background, 44px+ touch target

### Copy Review Applied
- Softened "save hours every week" → "designed to save time"
- "never clocks off" → "works around the clock"
- "Don't take our word for it" → "We're new — and honest about it"
- "You See Results" → "We Track Progress"
- "What our builds deliver" → "What our builds typically deliver"
- "Get a free website audit in 30 seconds" → "Get a quick, free website audit"
- Kestrel mockup moved from hero to Kestrel section with "coming soon" note

### Design Improvements
- 4 SVG illustrations: hero, services, Canberra skyline, trust shield
- Inline styles reduced from 78 → ~10 (SVG + chatbot only)
- Internal blog links added (3 blog posts linked from main content)
- "Demo" added to nav menu
- Canberra-specific content throughout

### Website Services (5 total)
1. AI Landing Pages & Funnels — from $1,500
2. Automation Builds — from $2,000
3. AI Content Systems — from $2,000/month
4. Kestrel AI Employee — Pilot Available
5. SEO Quick Fix — from $299

### Blog Posts Live
1. /blog/5-ways-ai-saves-small-business-time.html
2. /blog/what-is-workflow-automation.html
3. /blog/ai-vs-hiring-when-to-automate.html

### Batch Audit Tool
- `node tools/batch-audit.js` — crawls target businesses, generates SEO+UX reports + outreach emails
- 10 real Canberra businesses in tools/targets.json

### Worker Secrets Configured
| Worker | Secret | Status |
|--------|--------|--------|
| layerops-chat | ANTHROPIC_API_KEY | Set (⚠️ ROTATE) |
| layerops-chat | CAL_COM_API_KEY | Set |
| layerops-chat | CAL_EVENT_TYPE_ID | Set (5192245) |
| layerops-chat | GOOGLE_CLIENT_ID | NOT SET |
| layerops-chat | GOOGLE_CLIENT_SECRET | NOT SET |
| layerops-chat | GOOGLE_REFRESH_TOKEN | NOT SET |
| layerops-audit | ANTHROPIC_API_KEY | Set (⚠️ ROTATE) |
| layerops-audit | RESEND_API_KEY | Set (⚠️ ROTATE) — domain verified, emails working |
| layerops-clients | ANTHROPIC_API_KEY | Set (⚠️ ROTATE) |

### Pending Items
- ⚠️ **URGENT: Rotate API keys** — Anthropic + Resend keys exposed in conversation
- ~~Verify layerops.tech domain in Resend~~ DONE — emails sending from audit@layerops.tech
- Add Jarek's photo to about section (replace SVG placeholder)
- Set up Gmail OAuth for Kestrel email assistant
- Run batch audit on Canberra businesses for lead gen
- Get first client testimonials
- Create OG image as PNG (SVG exists but some platforms need PNG)
- Google Business Profile for local SEO
- Individual service pages for deeper SEO targeting
- More blog posts (target 10-20 for organic traffic)
- Onboard first real client via `node tools/onboard.js`
- ~~Pull layerops-email worker code~~ DONE — separate repo jarekpiot/layerops-email
- Update layerops-email FORWARD_TO from jarekpiot@gmail.com → jarek@layerops.tech
- Create wrangler config for `layerops-chat` (currently dashboard-only)
- Consider WhatsApp Business API integration for client chatbots
