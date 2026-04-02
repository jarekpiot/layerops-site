---
name: LayerOps Project State
description: Current state of the LayerOps site, workers, services, and what's deployed vs pending
type: project
---

## LayerOps — Project State (as of 2026-04-02, end of day)

### Live Infrastructure
- **Domain**: layerops.tech (wildcard DNS *.layerops.tech)
- **Site**: Cloudflare Pages (GitHub auto-deploy from master)
- **Email**: jarek@layerops.tech + kestrel@layerops.tech + audit@layerops.tech + notifications@layerops.tech
- **Google Business Profile**: Canberra, ACT + Byron Bay, NSW
- **Google Analytics**: G-ZMQQH95654 (all 8 pages)
- **Google Search Console**: Verified, sitemap submitted
- **Resend**: Domain verified, webhooks active
- **CRM Admin**: layerops.tech/admin/ (password protected)

### Workers (5 total)
| Worker | URL | Config | Purpose |
|--------|-----|--------|---------|
| layerops-site | layerops.tech | Pages (auto-deploy) | Main website |
| layerops-chat | api.layerops.tech | `wrangler-chat.toml` | Kestrel chatbot (outcomes-focused) |
| layerops-audit | audit.layerops.tech | `wrangler-audit.toml` | Audit (5 modes) + CRM API + leads + follow-ups |
| layerops-clients | *.layerops.tech | `workers/client-chat/wrangler-clients.toml` | Multi-tenant client chatbot + multi-team calendar |
| layerops-email | Email Routing | `jarekpiot/layerops-email` repo | Kestrel AI email auto-responder (Claude-powered, CCs Jarek) |

### Audit Worker — 5 Modes + CRM API
| Endpoint | Purpose |
|----------|---------|
| POST / | Standard audit (10 categories, plain English) |
| POST / mode:copy | Copy review (5 categories, reads full page content) |
| POST /visual | Visual analysis (screenshots + Claude vision, 8 categories) |
| POST /lead | Lead capture (dual emails: teaser to visitor, full to Jarek) |
| POST /premium | 4-pass adversarial (technical + copy + visual + synthesis) |
| GET /crm/leads | Fetch all CRM leads |
| POST /crm/update | Update lead status/notes |
| POST /crm/add | Add lead manually |
| POST /crm/follow-ups | Run follow-up sequence (server-side, has Resend key) |
| POST /crm/save-audit | Save audit results to KV |
| GET /crm/get-audit | Retrieve saved audit results |
| POST /webhook/resend | Auto-track email opens/clicks/bounces |

### Admin Dashboard (layerops.tech/admin/)
- Password protected (layerops2026)
- **CRM Tab**: Pipeline funnel, stats, email performance, add leads, export CSV
- **Service Monitor Tab**: Health checks all services + manual check links
- **Audit buttons**: 🔍 Standard (cached) + ⭐ Premium (cached) per lead
- **Follow-ups**: "Check Follow-ups" + "Send Follow-ups" buttons (server-side)
- Auto-syncs from cloud KV every 30 seconds
- Saved audit reports load instantly, "Re-run fresh" button for new data

### Premium Audit Report Includes
- Unified score + letter grade (A-F)
- Recommended pitch with correct pricing (one-off + monthly options)
- Talking points for sales call + opening line
- Full technical audit (10 categories, all issues, all fixes with descriptions)
- Full copy review (5 categories, all flagged copy with suggestions)
- Full visual analysis (8 categories, strongest/weakest, visual fixes)
- Action plan + contradictions between audits

### Pricing (updated 2026-04-02)
| Service | Price | Type |
|---------|-------|------|
| **Capture More Customer Enquiries** | | |
| — Chatbot | $49/month (free setup) | Recurring |
| — Chatbot + Website Care | $149/month | Recurring |
| — No website yet? | $499 setup + $49/month | One-off + recurring |
| **Get Found on Google** | $299 | One-off |
| **Automate Your Repetitive Work** | From $500 | One-off |
| **Content Done For You** | From $499/month | Recurring |
| **Morning Briefings & Email Triage** | From $199/month | Recurring |

### Website — Outcomes-Focused Copy
- Title: "Get More Customers, Save More Time | AI Automation, Canberra"
- All services named by outcomes, AI mentioned as "how"
- Copy audit reads full page content (paragraphs + list items)
- Results section: "What's Possible" with qualified claims
- Interactive AI Checklist at /checklist.html
- 10 blog posts live (Canberra + Byron Bay SEO)
- OG image as PNG (1200x630)
- Phone number in header, footer has address + contacts
- Byron Bay in footer for local SEO

### Website Audit Score: 92/100

### Industry Vertical Templates (10 verticals)
medical, dental, realestate, property_management, trade, vet, physio, legal, accounting, default

Each vertical customises outreach email language for the industry's specific pain points.

### Outreach Pipeline
| Batch | Leads | Industries | Status |
|-------|-------|-----------|--------|
| Batch 1 | 6 | Plumber, electrician, dentist, landscaper | Sent Apr 1, follow-ups due Apr 8 |
| Batch 2 | 4 | Vet, barber | Sent Apr 2 |
| Batch 3 | 5 | Real estate, legal, medical | Sent Apr 2 |
| Friends | 2 | Transport, farm | Waiting |
| Organic | 1 | Tactical gear | Waiting |
| **Total** | **18 leads** | | |

### Follow-Up Automation
- Day 3, 7, 14, 21 sequence
- Server-side (Resend key not exposed to client)
- One-click from admin dashboard
- Tracks which follow-ups sent via CRM notes
- Skips: replied, client, lost, friends

### Internal Tools
| Tool | Location | Purpose |
|------|----------|---------|
| Admin Dashboard | layerops.tech/admin/ | CRM + Service Monitor (password protected) |
| Audit Dashboard | tools/dashboard.html | One-click audit buttons |
| Sales Book | tools/salesbook.html | Products, pricing, objections, call script |
| Operator Manual | tools/operator-manual.html | Complete business reference |
| Architecture Doc | tools/architecture-tunnel.html | System diagrams, security, tunnel |
| Call Prep | `node tools/call-prep.js "url" --html` | Call briefing |
| Blog Writer | `node tools/write-blog.js "topic" --publish` | Generate + publish posts |
| Business Scout | `node tools/scout.js "query" --audit --outreach` | Find businesses |
| Batch Audit | `node tools/batch-audit.js [targets.json]` | Audit multiple sites |
| Outreach Generator | `node tools/generate-outreach-html.js` | Vertical-specific emails |
| Follow-Up | Click button in admin, or `node tools/follow-up.js --send` | Automated sequence |
| Client Onboarding | `node tools/onboard.js` | New client chatbot |
| OG Image | `node tools/generate-og-image.js` | Regenerate social preview |

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

### Pending Items
- ⚠️ **URGENT: Rotate API keys** — Anthropic + Resend exposed in conversation
- **Follow-ups**: Batch 1 due Apr 8 (Tuesday after Easter)
- **Testimonials**: Waiting on friends
- **Jarek's photo**: On about section
- **Kestrel auto-learning**: Cron Worker to scrape website + update prompt dynamically
- **More blog posts**: Have 10, target 20
- **Conversation memory**: Store chat history per visitor in KV
- **Scout in admin dashboard**: Server-side endpoint (needs Google Places API)
