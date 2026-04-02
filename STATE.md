---
name: LayerOps Project State
description: Current state of the LayerOps site, workers, services, and what's deployed vs pending
type: project
---

## LayerOps — Project State (as of 2026-04-02, updated end of day)

### Live Infrastructure
- **Domain**: layerops.tech (purchased, wildcard DNS *.layerops.tech)
- **Site**: Cloudflare Pages (GitHub auto-deploy from jarekpiot/layerops-site master)
- **Email**: jarek@layerops.tech (forwarding) + kestrel@layerops.tech (auto-responder) + audit@layerops.tech (lead notifications)
- **Google Business Profile**: Set up — Canberra, ACT + Byron Bay, NSW service areas
- **Resend**: Verified domain, webhooks configured for email tracking
- **CRM**: Cloud KV-backed, auto-syncing dashboard with 30s refresh

### Workers (5 total)
| Worker | URL | Config | Purpose |
|--------|-----|--------|---------|
| layerops-site | layerops.tech | Pages (auto-deploy) | Main website |
| layerops-chat | api.layerops.tech | `wrangler-chat.toml` | Kestrel chatbot (outcomes-focused prompts) |
| layerops-audit | audit.layerops.tech | `wrangler-audit.toml` | Audit (5 modes) + CRM API + lead capture |
| layerops-clients | *.layerops.tech | `workers/client-chat/wrangler-clients.toml` | Multi-tenant client chatbot + multi-team calendar |
| layerops-email | Email Routing | `jarekpiot/layerops-email` repo | Kestrel AI email auto-responder (Claude-powered) |

### Audit Worker — 5 Modes
- **POST /** — Full audit: 10 categories, plain English, reads all page content
- **POST / mode:copy** — Copy review: 5 categories, now reads paragraphs + list items (fixed blind spot)
- **POST /visual** — Visual analysis: Browser Rendering screenshots + Claude vision (8 categories)
- **POST /lead** — Lead capture: audit + dual emails (teaser to visitor, full to Jarek)
- **POST /premium** — 4-pass adversarial audit: technical + copy + visual + synthesis with action plan + pitch recommendation

### CRM System
- Cloud KV storage (auto-sync from audit form leads)
- Local dashboard with 30-second auto-refresh (`tools/crm.html`)
- Resend webhook integration: tracks delivered, opened, clicked, bounced
- Status pipeline: Lead → Contacted → Opened → Replied → Call → Client

### Pricing (updated 2026-04-02, outcomes-focused)
| Service | Price | Type |
|---------|-------|------|
| **Capture More Customer Enquiries** | | |
| — Chatbot | $49/month (free setup) | Recurring |
| — Chatbot + Website Care | $149/month | Recurring |
| — No website yet? | $299 setup + $49/month | One-off + recurring |
| **Get Found on Google** | $299 | One-off |
| **Stop Doing the Same Thing Twice** | From $500 | One-off |
| **Content Done For You** | From $499/month | Recurring |
| **Your Virtual Team Member** | From $199/month | Recurring |

### Website Copy — Outcomes-Focused (rewritten 2026-04-02)
- All service names lead with outcomes, AI mentioned as "how"
- Title: "Get More Customers, Save More Time | AI Automation, Canberra"
- H1: "Get more customers. Save more time."
- Hero sub: "Powered by AI."
- Copy audit now reads full page content (paragraphs + list items)
- Results section: "What's Possible" with qualified claims
- Interactive AI Checklist at /checklist.html (10 questions, dynamic scoring)

### Website Audit Score: 92/100
| Category | Score |
|----------|-------|
| Social Sharing | 100 |
| On-Page SEO | 98 |
| Technical SEO | 95 |
| Mobile | 95 |
| Design | 95 |
| Navigation | 95 |
| Performance | 92 |
| Content | 90 |
| Trust & Conversion | 88 |
| Accessibility | 85 |

### Outreach Campaign
**Friends (free fixes for testimonials):**
- Byron Bay Platinum Transfers — sent, waiting
- Nice Feilds Farm — sent, waiting
- Preece Tactical — sent (friend testing audit tool)

**Cold outreach (6 Canberra businesses):**
- Sent 2026-04-01, no replies yet
- Day 3 follow-ups due 2026-04-04

### Internal Tools
| Tool | File | Purpose |
|------|------|---------|
| Audit Dashboard | `tools/dashboard.html` | One-click buttons for all 5 audit modes |
| CRM Dashboard | `tools/crm.html` | Lead tracking, pipeline, email performance |
| Sales Book | `tools/salesbook.html` | Products, pricing, objections, call script, margins |
| Architecture Doc | `tools/architecture-tunnel.html` | System diagrams, security layers, tunnel deep-dive |
| Call Prep | `tools/call-prep.js` | Generate call briefing for any business |
| Business Scout | `tools/scout.js` | Find businesses via Google Places |
| Blog Writer | Not built yet | Generate blog posts |
| Batch Audit | `tools/batch-audit.js` | Audit multiple websites |
| Outreach Generator | `tools/generate-outreach-html.js` | HTML outreach emails |
| Email Sender | `tools/send-outreach.js` | Send via Resend |
| Client Onboarding | `tools/onboard.js` | Create new client in KV |

### Worker Secrets
| Worker | Secret | Status |
|--------|--------|--------|
| layerops-chat | ANTHROPIC_API_KEY | Set (⚠️ ROTATE) |
| layerops-chat | CAL_COM_API_KEY | Set |
| layerops-chat | CAL_EVENT_TYPE_ID | Set (5192245) |
| layerops-audit | ANTHROPIC_API_KEY | Set (⚠️ ROTATE) |
| layerops-audit | RESEND_API_KEY | Set (⚠️ ROTATE) |
| layerops-clients | ANTHROPIC_API_KEY | Set (⚠️ ROTATE) |
| layerops-clients | RESEND_API_KEY | Set |
| layerops-email | ANTHROPIC_API_KEY | Set (⚠️ ROTATE) |
| layerops-email | RESEND_API_KEY | Set |

### Completed Today (2026-04-02)
- ✅ Google Analytics (G-ZMQQH95654) on all 8 pages
- ✅ Google Search Console verified + sitemap submitted
- ✅ Google Business Profile (Canberra + Byron Bay)
- ✅ OG image as PNG (1200x630)
- ✅ Blog writer tool built
- ✅ 6 new blog posts (10 total)
- ✅ Follow-up email automation (day 3, 7, 14, 21)
- ✅ CRM auto-refresh + cloud sync
- ✅ Outcomes-focused copy rewrite across entire site
- ✅ Pricing restructured based on competitive research
- ✅ Multi-team calendar support
- ✅ Interactive AI Checklist lead magnet
- ✅ Operator manual (comprehensive)
- ✅ Sales book with call scripts + objection handling
- ✅ Architecture + security documentation
- ✅ Sitemap updated with all 9 pages
- ✅ Byron Bay added to footer + Google Business Profile

### Pending Items
- ⚠️ **URGENT: Rotate API keys** — Anthropic + Resend exposed in conversation
- **Day 3 follow-up emails** — due Tuesday 2026-04-08 (after Easter)
- **Testimonials** — waiting on friends' responses
- **Jarek's photo** on about section
- **More blog posts** — have 10, target 20
- **New product pages** (Review Management, Social Media) — future
- **Logo review** — bird logo may not match outcomes-focused positioning, revisit later
