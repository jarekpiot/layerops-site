# LayerOps Website — Deployment Guide

## What You're Deploying
- `index.html` → Your website (Cloudflare Pages)
- `worker.js` → AI chatbot proxy (Cloudflare Worker)

---

## Step 1: Push to GitHub

1. Go to github.com → New Repository → name it `layerops-site`
2. Make it private (your API proxy code is in there)
3. Upload `index.html` to the repo (drag and drop on GitHub works)
4. Keep `worker.js` separate — you'll paste it into Cloudflare directly

---

## Step 2: Deploy Website to Cloudflare Pages

1. Go to dash.cloudflare.com → sign up if you haven't
2. Click **Workers & Pages** in the left sidebar
3. Click **Create** → **Pages** → **Connect to Git**
4. Authorize GitHub, select your `layerops-site` repo
5. Build settings:
   - Build command: (leave blank)
   - Build output directory: `/`
6. Click **Save and Deploy**
7. Your site will be live at something like `layerops-site.pages.dev`

---

## Step 3: Add Custom Domain

1. In Cloudflare, click **Websites** → **Add a site** → enter `layerops.com.au`
2. Select the **Free** plan
3. Cloudflare will give you 2 nameservers (e.g., `ann.ns.cloudflare.com`)
4. Go to your domain registrar (where you bought layerops.com.au)
5. Change the nameservers to the Cloudflare ones
6. Wait for propagation (usually 15 min to a few hours)
7. Back in Cloudflare Pages → your project → **Custom domains** → Add `layerops.com.au`
8. Cloudflare handles SSL automatically

---

## Step 4: Deploy the Chatbot Worker

1. In Cloudflare dashboard → **Workers & Pages** → **Create** → **Worker**
2. Name it `layerops-chat`
3. Click **Edit code**
4. Delete the default code, paste the contents of `worker.js`
5. Click **Deploy**

### Add your API key as a secret:
1. Go to your Worker → **Settings** → **Variables and Secrets**
2. Click **Add** under **Secrets**
3. Name: `ANTHROPIC_API_KEY`
4. Value: (paste your Anthropic API key)
5. Click **Save**

### Add a custom route (optional but cleaner):
1. Go to your Worker → **Settings** → **Triggers** → **Custom Domains**
2. Add: `api.layerops.com.au`
3. This means the chatbot calls `https://api.layerops.com.au/chat`

OR just use the default worker URL like `https://layerops-chat.YOUR-SUBDOMAIN.workers.dev`

### Update the website:
In `index.html`, find this line:
```
const PROXY_URL = 'https://api.layerops.com.au/chat';
```
Replace with your actual Worker URL (either the custom domain or the workers.dev URL).

Push the change to GitHub — Cloudflare Pages auto-deploys.

---

## Step 5: Set Up Google Workspace (optional but recommended)

1. Go to workspace.google.com → Start
2. Enter your business name: LayerOps
3. Domain: layerops.com.au
4. Create jarek@layerops.com.au
5. Google will ask you to verify domain — since DNS is on Cloudflare:
   - Go to Cloudflare DNS → Add TXT record Google gives you
   - Add MX records Google provides
6. Update the website contact email from jarekpiot@gmail.com to jarek@layerops.com.au
7. Update Calendly to use the new email

---

## Step 6: Set Up Calendly

1. Go to calendly.com → Sign up with jarek@layerops.com.au
2. Create one event type: "15-Minute Chat" 
3. Set availability (evenings/weekends since you work 9:30-4:30)
4. Copy your Calendly link
5. In `index.html`, replace `https://calendly.com` with your actual link
6. Push to GitHub

---

## Cost Summary
- layerops.com.au domain: ~$24/year
- Cloudflare Pages: FREE
- Cloudflare Worker: FREE (100,000 requests/day)
- Google Workspace: $7.20 AUD/month
- Calendly: FREE (1 event type)
- Anthropic API (chatbot): ~$5-15/month depending on traffic

**Total: ~$10-25/month + $24/year for domain**

---

## Files
- `index.html` — Full website with integrated chatbot
- `worker.js` — Cloudflare Worker proxy (keeps API key server-side)
- `DEPLOY.md` — This file
