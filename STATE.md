---
name: LayerOps Project State
description: Current state of the LayerOps site, workers, services, and what's deployed vs pending
type: project
---

## LayerOps — Project State (as of 2026-04-01)

### Live Infrastructure
- **Domain**: layerops.tech (purchased, active, Cloudflare DNS, wildcard *.layerops.tech)
- **Site**: Cloudflare Pages connected to GitHub (auto-deploy from jarekpiot/layerops-site master)
- **GitHub Repos**: jarekpiot/layerops-site (main) + jarekpiot/layerops-email (email worker)
- **Cal.com**: Connected, event type ID 5192245 (15 min meeting)
- **Email**: jarek@layerops.tech (forwarding via Cloudflare Email Routing)
- **Resend**: Verified for layerops.tech — sends from jarek@, audit@, kestrel@, notifications@

### Workers (5 total)
| Worker | URL | Code | Purpose |
|--------|-----|------|---------|
| layerops-site | layerops.tech | `index.html` + static | Main website (Pages auto-deploy) |
| layerops-chat | api.layerops.tech | `layerops-worker.js` | Kestrel chatbot for LayerOps site |
| layerops-audit | audit.layerops.tech | `seo-audit-worker.js` | Audit (4 modes) + lead capture |
| layerops-clients | *.layerops.tech | `workers/client-chat/` | Multi-tenant client chatbot |
| layerops-email | Email Routing | `jarekpiot/layerops-email` repo | Kestrel AI email auto-responder |

### Audit Worker — 4 Modes
- **POST /** — Full audit: 10 categories, plain English for non-technical users
- **POST / mode:copy** — Copy review: 5 categories (honesty, proof, clarity, CTA, tone)
- **POST /visual** — Visual analysis: Browser Rendering screenshots + Claude vision (8 categories)
- **POST /lead** — Lead capture: audit + dual emails (teaser to visitor, full report to Jarek)
- Deploy: `npx wrangler deploy -c wrangler-audit.toml`

### Email Worker — AI Auto-Responder
- Receives inbound email to *@layerops.tech via Cloudflare Email Routing
- Reads the email, generates intelligent reply via Claude (knows all services + pricing)
- Sends reply from kestrel@layerops.tech, CCs jarek@layerops.tech
- Falls back to basic auto-reply if Claude fails
- Repo: jarekpiot/layerops-email (auto-deploy via Cloudflare Builds)

### Multi-Tenant Client Chatbot System — LIVE
- **Routing**: `{slug}.layerops.tech` → KV lookup → landing page (GET) or chat API (POST)
- **Widget**: embeddable via `<script src="https://{slug}.layerops.tech/widget/{slug}"></script>`
- **Demo**: demo.layerops.tech — Sam's Plumbing Canberra (working chatbot + simulated booking)
- **Demo pages**: layerops.tech/demo/ + layerops.tech/demo/embed.html
- **Onboarding**: `node tools/onboard.js`
- **KV**: CLIENTS namespace (ID: 8f8f82f39ade45f2914bd9ec34ec9ea1)
- Deploy: `npx wrangler deploy -c workers/client-chat/wrangler-clients.toml`

### Lead Capture System — LIVE
- Free audit form on homepage (layerops.tech)
- Visitor enters email + URL → runs 10-category audit in real-time
- **Visitor sees**: scores + top 3 fix titles only (no instructions)
- **Visitor email**: teaser report + CTA to book call
- **Jarek email**: full report with all issues + fix descriptions
- Leads stored in LEADS KV (90 day TTL)

### Pricing (updated 2026-04-01)
| Service | Setup | Price |
|---------|-------|-------|
| AI Chatbot — Widget Only | Free | $49/month |
| AI Chatbot — Quick Start (subdomain landing page) | Free | $69/month |
| AI Chatbot — Business (custom + booking + SEO) | Free (first 10) | $79/month |
| AI Chatbot — Premium (own domain + full custom) | $999 | $99/month |
| Automation Builds | — | From $2,000 |
| AI Content Systems | — | From $2,000/month |
| SEO Quick Fix | — | From $299 |
| Kestrel AI Employee | — | Pilot programs |

### Website Audit Scores (latest 2026-04-01)
- **Overall**: 88/100
- **Visual**: 88/100
- **Copy**: 78/100

### Outreach Campaign (sent 2026-04-01)
**Friends (free fixes + chatbot for testimonials):**
| Business | Email | Score | Status |
|----------|-------|-------|--------|
| Byron Bay Platinum Transfers | bookings@byronbayplatinumtransfers.com.au | 62 | ✅ Sent |
| Nice Feilds Farm | Thomas@nice-feilds.farm | 42 | ✅ Sent |

**Cold outreach (free audit report, paid fixes):**
| Business | Email | Score | Status |
|----------|-------|-------|--------|
| Civic Gentle Dental Care | info@civicgentledentalcare.com.au | 58 | ✅ Sent |
| JML Plumbing and Gas | office@jmlplumbing.net.au | 62 | ✅ Sent |
| Blue Rain Electrical | office@bluerainelectrical.com.au | 62 | ✅ Sent |
| Dental Embassy | care.dentalembassy@gmail.com | 67 | ✅ Sent |
| Plumbworks Canberra | plumbworksplumbing@outlook.com | 68 | ✅ Sent |
| Gardengigs | gardengigs@gmail.com | 68 | ✅ Sent |

### Tools
| Tool | Command | Purpose |
|------|---------|---------|
| Batch audit | `node tools/batch-audit.js [targets.json]` | Audit multiple websites |
| Business scout | `node tools/scout.js "plumber Canberra" --audit --outreach` | Find + audit businesses (needs GOOGLE_PLACES_API_KEY) |
| Call prep | `node tools/call-prep.js "https://site.com" --html` | Generate call briefing |
| Onboard client | `node tools/onboard.js` | Create new client in KV |
| Generate emails | `node tools/generate-outreach-html.js` | HTML outreach emails from audit results |
| Send emails | `node tools/send-outreach.js` | Send via Resend |

### Worker Secrets
| Worker | Secret | Status |
|--------|--------|--------|
| layerops-chat | ANTHROPIC_API_KEY | Set (⚠️ ROTATE) |
| layerops-chat | CAL_COM_API_KEY | Set |
| layerops-chat | CAL_EVENT_TYPE_ID | Set (5192245) |
| layerops-audit | ANTHROPIC_API_KEY | Set (⚠️ ROTATE) |
| layerops-audit | RESEND_API_KEY | Set (⚠️ ROTATE) |
| layerops-clients | ANTHROPIC_API_KEY | Set (⚠️ ROTATE) |
| layerops-email | ANTHROPIC_API_KEY | Set (⚠️ ROTATE) |
| layerops-email | RESEND_API_KEY | Set |

### Pending Items
- ⚠️ **URGENT: Rotate API keys** — Anthropic + Resend keys exposed in conversation
- **Build lead capture in client chatbot** — store name/phone, email to business owner
- Add Jarek's photo to about section
- Get first client testimonials (friends first)
- Create OG image as PNG (SVG exists but some platforms need PNG)
- Google Business Profile for local SEO
- Set up Google Places API key for scout tool
- Individual service pages for deeper SEO targeting
- More blog posts (target 10-20 for organic traffic)
- Follow-up email sequence (4-6 touches per lead)
- Consider WhatsApp Business API for client chatbots
