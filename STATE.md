---
name: LayerOps Project State
description: Current state of the LayerOps site, workers, services, and what's deployed vs pending
type: project
---

## LayerOps — Project State (as of 2026-04-04, end of day)

### Live Infrastructure
- **Domain**: layerops.tech (wildcard DNS *.layerops.tech)
- **Site**: Cloudflare Pages (GitHub auto-deploy from master)
- **Email**: jarek@layerops.tech + kestrel@layerops.tech + audit@layerops.tech + notifications@layerops.tech
- **Google Business Profile**: Canberra, ACT + Byron Bay, NSW
- **Google Analytics**: G-ZMQQH95654 (all 8 pages)
- **Google Search Console**: Verified, sitemap submitted
- **Resend**: Domain verified, webhooks active
- **CRM Admin**: layerops.tech/admin/ (password protected)

### Workers (6 total)
| Worker | URL | Config | Purpose |
|--------|-----|--------|---------|
| layerops-site | layerops.tech | Pages (auto-deploy) | Main website |
| layerops-chat | api.layerops.tech | `wrangler-chat.toml` | Kestrel chatbot (outcomes-focused) |
| layerops-voice | voice.layerops.tech | `/c/krestel/layerops-voice/wrangler.toml` | Kestrel voice AI (Twilio ConversationRelay + Durable Object + Claude) |
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

### Pricing (updated 2026-04-05)

See admin dashboard Pricing & Costs tab for full breakdown with margins.

**AI Receptionist Tiers:**
| Tier | Price | Setup |
|------|-------|-------|
| Chatbot Only | $49/mo | Free |
| Voice Only | $249/mo | $499 |
| Starter Bundle | $299/mo | $499 |
| Pro Bundle | $399/mo | $499 |
| Full Bundle | $499/mo | Free |

**Automation Packages (setup + monthly):**
| Package | Setup | Monthly |
|---------|-------|---------|
| Essentials (pick 2) | $999 | $297/mo |
| Growth (pick 4) | $1,497 | $497/mo |
| Full Ops (all 6) | $1,997 | $697/mo |
| Custom | From $500 | From $197/mo |

**Other:**
| Service | Price |
|---------|-------|
| Website + Chatbot (no site) | $499 setup + $49/mo |
| Chatbot + Website Care | $149/mo |
| Get Found on Google (SEO) | $299 one-off |

### Website — SEO & Copy (updated 2026-04-05)
- Title: "AI Automation Canberra & Byron Bay | Voice AI, Chatbots & Business Automation | LayerOps.tech"
- Meta description includes all services + Kestrel phone number
- JSON-LD: LocalBusiness with serviceType array, areaServed (Canberra, Byron Bay, AU), contactPoint
- OG + Twitter tags with AI automation keywords
- Canonical URLs on all pages
- 15 blog posts live (10 original + 5 new SEO-targeted)
- Automation page with 6 interactive demos + 5 industry vertical tabs + AML/CTF banner
- Phone number in hero, contact, footer, chatbot widget
- Footer: suburb names (Belconnen, Tuggeranong, Woden, Gungahlin, Queanbeyan)
- Footer disclaimer: not legal/financial/medical advice
- Chatbot: accessible (button, aria-labels, dialog role, aria-live)
- Mobile: optimised chatbot (centred, iOS zoom fix, 64px tap target)
- Sitemap: 21 URLs (all pages + all blog posts)

### Website Audit Score: 92/100 (standard) / 82/100 (premium)
Premium score limited by lack of testimonials/case studies — #1 priority for improvement.

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
| Admin Dashboard | layerops.tech/admin/ | CRM + Service Monitor + Pricing + Onboard Client (password protected) |
| Discovery Tool | layerops.tech/admin/discovery.html | Dynamic on-site client discovery form → auto-generates proposal |
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

### Admin Dashboard Tabs (layerops.tech/admin/)
1. **CRM** — Lead pipeline, email performance, follow-ups
2. **Service Monitor** — Health checks for all workers
3. **Pricing & Costs** — All products with client price, our cost, margin, tools needed, custom quoting guide
4. **Onboard Client** — Voice AI + chatbot config generator with deployment checklist
5. **Discovery Tool** (separate page) — Dynamic on-site questionnaire → proposal generator

### Discovery Tool (layerops.tech/admin/discovery.html) — Built 2026-04-04
- 8-step dynamic questionnaire for on-site client meetings
- Industry-specific branching (financial, trades, dental, vet, real estate, accounting, legal, physio)
- 30+ industry-specific pain point cards
- Customer journey mapping (how they get/lose customers)
- Time audit with live cost calculation
- Auto-generated proposal: business overview, journey map, cost of doing nothing, recommended LayerOps products, workflow diagrams, package + ROI, next steps
- Every recommendation maps to a specific LayerOps product + pricing
- Print as PDF / copy as text
- Mobile-optimised for tablet use on-site

### Client Voice AI Template (/c/krestel/client-voice-template/) — Built 2026-04-04
- One config file per client (`client-config.js`)
- Deploy script: `./deploy-client.sh <client-slug>`
- Configurable: AI receptionist name, voice, services, pricing, FAQs, booking system, tier
- Chatbot uses existing multi-tenant `layerops-clients` worker (config in KV)

### Automation Services Page (layerops.tech/automation) — Updated 2026-04-05
- 6 interactive workflow demos with "See it in action" simulations
- Before/after comparisons with flow diagrams
- 5 industry-specific tab sections:
  - Dental & Medical: recalls, no-shows, treatment follow-up, post-care
  - Real Estate: open home follow-up, vendor reports, lead response, maintenance
  - Law Firms: intake, deadlines, status updates, trust accounting
  - Tradies: quote follow-up, job completion, warranty, licence tracking
  - Financial Advisers: annual review, file notes, client comms, compliance
- AML/CTF Tranche 2 banner (1 July 2026 deadline) — prominent
- Monthly pricing: Essentials $297/mo, Growth $497/mo, Full Ops $697/mo
- Footer disclaimer: not legal/financial/medical advice
- "Automation" in main site navigation

### Blog Posts — 15 Total (updated 2026-04-05)
**New (5 April 2026):**
1. AI Automation for Small Business in Canberra → "AI automation small business Canberra"
2. Why Canberra Tradies Are Switching to AI Phone Answering → "AI phone answering tradies Canberra"
3. AI Chatbot vs Receptionist: Real Cost → "AI chatbot business Canberra"
4. Byron Bay Tourism AI Booking → "AI booking Byron Bay business"
5. Complete Guide Business Automation Australia → "business automation Australia"

**Existing (10 posts from March-April 2026)**

**Other Services:**
| Service | Price |
|---------|-------|
| Website + Chatbot (no site) | $499 setup + $49/mo |
| Chatbot + Website Care | $149/mo |
| Get Found on Google (SEO) | $299 one-off |

### Worker Secrets
| Worker | Secret | Status |
|--------|--------|--------|
| layerops-chat | ANTHROPIC_API_KEY | Set (⚠️ ROTATE) |
| layerops-chat | CAL_COM_API_KEY | Set |
| layerops-chat | CAL_EVENT_TYPE_ID | Set (5192245) |
| layerops-voice | ANTHROPIC_API_KEY | Set |
| layerops-voice | CAL_COM_API_KEY | Set |
| layerops-voice | TWILIO_ACCOUNT_SID | Set |
| layerops-voice | TWILIO_AUTH_TOKEN | Set |
| layerops-voice | RESEND_API_KEY | Set |
| layerops-audit | ANTHROPIC_API_KEY | Set (⚠️ ROTATE) |
| layerops-audit | RESEND_API_KEY | Set (⚠️ ROTATE) |
| layerops-clients | ANTHROPIC_API_KEY | Set (⚠️ ROTATE) |
| layerops-clients | RESEND_API_KEY | Set |
| layerops-email | ANTHROPIC_API_KEY | Set (⚠️ ROTATE) |
| layerops-email | RESEND_API_KEY | Set |

### Usage Limits on Free Audit Tool
- 3 audits per email address (90 day window)
- 3 audits per website hostname (90 day window)
- After limit: shows "Book a call" CTA — converts limit into lead

### Email Improvements
- Visitor audit email now HTML with score badge + CTA button
- Sent from jarek@layerops.tech (not audit@)
- All outreach uses BCC (not CC) for Jarek's copy
- Industry-vertical templates for tailored outreach

### Kestrel Voice AI (layerops-voice) — Built 2026-04-04
- **Phone**: +61 2 5941 6608 (Sydney, Twilio — upgraded from trial)
- **Twilio webhook**: https://voice.layerops.tech/twiml (POST)
- **Architecture**: Twilio ConversationRelay → WebSocket → Durable Object → Claude Haiku (streaming) → ElevenLabs TTS
- **STT**: Deepgram nova-3-general (en-AU)
- **TTS**: ElevenLabs Hannah (Australian female voice, Flash v2.5, 1.1x speed)
- **Model**: Claude Haiku 4.5 with prompt caching (ephemeral)
- **KV**: CALL_LOGS (0ee6a757b4bf45f6b23bd40a478e7494)
- **Features**:
  - Books meetings via Cal.com (check availability + book)
  - Collects callback details → emails Jarek at jarek@layerops.tech
  - Call summary email after every call (full transcript, for debugging — remove later)
  - Caller memory: stores contacts per phone number in KV (multi-contact per number)
  - Smart interruption: tracks what was spoken before cut-off, trims conversation history
  - Token fallback: retries if max_tokens hit during tool call
  - Proactive conversation: asks caller's name, qualifies business, natural funnel
  - Filler phrases during tool calls ("Let me check Yarek's availability")
  - Streaming tokens for low latency
- **Website**: Phone number added to hero, contact section, footer, chatbot widget
- **SMS**: Not yet active — Twilio voice number not SMS-capable. Need Alphanumeric Sender ID (requires ACMA registration) or separate AU mobile number (~$6/mo)
- **Pricing in voice prompt**: Updated productized pricing ($49/mo chatbot, $149/mo bundle, etc.)
- **Known quirks**: Jarek pronounced as "Yarek" in prompt so ElevenLabs says it correctly

### Potential Clients
- **Aaron** (friend) — Byron Bay private transfer business, wants voice AI for missed calls. Can reuse client-voice-template.
- **Jarek's friend** — Financial advisory business, discovery session planned — first case study for automation services

### Pending Items
- ⚠️ **URGENT: Rotate API keys** — Anthropic + Resend exposed in earlier conversations
- **Testimonials** — #1 blocker for premium audit score (82 → 90+). Need real quotes from Aaron, friends, or first clients. Can use LayerOps' own dog-fooding as interim.
- **Follow-ups**: All 15 cold leads due Tuesday Apr 7 (after Easter)
- **SMS confirmations**: Need Twilio SMS-capable number or Alphanumeric Sender ID for AU
- **Remove call summary emails**: Once voice AI is stable, disable debug emails
- **Update chatbot pricing**: layerops-chat worker.js still has old enterprise pricing, should match new productized pricing
- **Outbound appointment reminders**: Future feature for voice AI — call clients day before/hour before meetings
- **Discovery tool enhancements**: Typeform-style one-question-at-a-time UX, automation suitability scoring (green/yellow/red)
- **Jarek's photo**: On about section
- **Kestrel auto-learning**: Cron Worker to scrape website + update prompt dynamically
- **More blog posts**: Have 15, target 20
- **Conversation memory**: Store chat history per visitor in KV
- **Scout in admin dashboard**: Server-side endpoint (needs Google Places API)
- **Inline styles cleanup**: Low priority — cosmetic, not business impact
- **Google Search Console**: Sitemap submitted 2026-04-05 — monitor indexing over next week
- **Cloudflare plan**: Upgraded to $5 Workers plan — premium audit now works
