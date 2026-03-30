---
name: LayerOps Project State
description: Current state of the LayerOps site, workers, services, and what's deployed vs pending
type: project
---

## LayerOps — Project State (as of 2026-03-31)

### Live Infrastructure
- **Site**: Cloudflare Pages at `layerops.jarekpiot.workers.dev` (GitHub auto-deploy from jarekpiot/layerops-site master)
- **Chat Worker**: `layerops-chat.jarekpiot.workers.dev` — Kestrel chatbot proxy to Anthropic API
- **Audit Worker**: `layerops-audit.jarekpiot.workers.dev` — automated SEO audit tool
- **GitHub Repo**: jarekpiot/layerops-site (public)
- **Cal.com**: Connected, event type ID 5192245 (15 min meeting), username jarek-piotrowski-jay-j5oa4i

### Kestrel Chatbot — What's Working
- Answers questions about LayerOps services
- Cal.com booking integration — checks real availability, books appointments in-chat
- Multi-turn conversation history
- Rich text rendering (bold, links) in chat bubbles

### Kestrel Chatbot — Email Assistant (code ready, NOT configured)
- check_emails, send_email, search_emails tools built into worker
- Needs: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN secrets
- User hasn't created a dedicated Gmail account yet — considering layerops.kestrel@gmail.com or a Workspace email later

### Website Services (5 total)
1. AI Landing Pages & Funnels — from $1,500
2. Automation Builds — from $2,000
3. AI Content Systems — from $2,000/month
4. Kestrel AI Employee — Pilot Available
5. SEO Quick Fix — from $299 (NEW)

### SEO Status
- JSON-LD schema: LocalBusiness, 5x Service, FAQPage
- OG tags + Twitter Card tags
- Proper heading hierarchy (h1 > h2 > h3)
- robots.txt + sitemap.xml with blog URLs
- lang="en-AU", geo tags for Canberra
- FAQ section with 6 questions (accordion)
- Blog: 3 posts by Kestrel AI

### Blog Posts Live
1. /blog/5-ways-ai-saves-small-business-time.html
2. /blog/what-is-workflow-automation.html
3. /blog/ai-vs-hiring-when-to-automate.html

### Batch Audit Tool
- `node tools/batch-audit.js` — crawls target businesses, generates SEO reports + outreach emails
- 10 real Canberra businesses in tools/targets.json
- Outputs: tools/audit-results.json + tools/outreach-emails.md

### Domain — NOT YET PURCHASED
- Considering: layerops.solutions (preferred) or layerops.com.au
- OG tags and sitemap currently reference layerops.solutions
- Site still served from workers.dev subdomain

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

### Competitive Assessment Score: 6.3/10
- Strengths: Copy (8/10), Pricing transparency (9/10)
- Weaknesses: Trust signals (3/10 — no testimonials), Content depth (2.5/10 — improving with blog)
- Key gap: Need real client testimonials and case studies

### Pending Items
- Purchase domain (layerops.solutions)
- Set up dedicated email (Gmail or Workspace)
- Configure Gmail API OAuth for Kestrel email assistant
- Run batch audit on Canberra businesses for lead gen
- Get first client testimonials
- Jarek founder photo on site
- Create OG image as PNG (SVG exists but some platforms need PNG)
- Google Business Profile for local SEO
- Individual service pages for deeper SEO targeting
- More blog posts (target 10-20 for organic traffic)
