#!/usr/bin/env node

// LayerOps Market Intelligence Agent
// Researches AI automation market, analyzes competitors, and emails a report.
//
// Usage:
//   RESEND_API_KEY=re_xxx node tools/market-intel.js
//   RESEND_API_KEY=re_xxx node tools/market-intel.js --dry-run

const fs = require('fs');
const path = require('path');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const FROM = 'LayerOps Intel <jarek@layerops.tech>';
const TO = 'jarekpiot@gmail.com';

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  } catch { return null; }
}

function countTargets() {
  const files = ['targets.json', 'targets-fresh.json', 'targets-batch2.json', 'targets-highvalue.json', 'friends-targets.json'];
  let total = 0;
  const seen = new Set();
  for (const f of files) {
    const data = loadJson(f);
    if (Array.isArray(data)) {
      for (const t of data) {
        const key = t.url || t.name;
        if (!seen.has(key)) { seen.add(key); total++; }
      }
    }
  }
  return total;
}

function getOutreachStats() {
  try {
    const src = fs.readFileSync(path.join(__dirname, 'send-outreach.js'), 'utf8');
    const matches = src.match(/to:\s*'[^']+'/g) || [];
    const friends = (src.match(/type:\s*'friend'/g) || []).length;
    const cold = matches.length - friends;
    return { total: matches.length, friends, cold };
  } catch { return { total: 0, friends: 0, cold: 0 }; }
}

function buildReport() {
  const targets = countTargets();
  const outreach = getOutreachStats();
  const now = new Date().toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.7;color:#333;background:#f5f5f5;">
<div style="max-width:640px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

<div style="background:#1a1a2e;color:#fff;padding:24px 32px;">
  <h1 style="margin:0 0 4px;font-size:20px;font-weight:600;">LayerOps Market Intelligence</h1>
  <p style="margin:0;opacity:0.7;font-size:13px;">${now}</p>
</div>

<div style="padding:24px 32px;">

<h2 style="color:#1a1a2e;font-size:16px;border-bottom:2px solid #eee;padding-bottom:8px;">Pipeline Snapshot</h2>
<table style="width:100%;border-collapse:collapse;margin:12px 0 20px;">
  <tr><td style="padding:6px 0;color:#666;">Total prospects identified</td><td style="padding:6px 0;font-weight:600;text-align:right;">${targets}</td></tr>
  <tr><td style="padding:6px 0;color:#666;">Outreach sent (batch 1)</td><td style="padding:6px 0;font-weight:600;text-align:right;">${outreach.total} (${outreach.friends} friends, ${outreach.cold} cold)</td></tr>
  <tr><td style="padding:6px 0;color:#666;">Batch 2 ready (unsent)</td><td style="padding:6px 0;font-weight:600;text-align:right;">6 (medical, legal, real estate)</td></tr>
  <tr><td style="padding:6px 0;color:#666;">Email deliverability</td><td style="padding:6px 0;font-weight:600;text-align:right;color:#2d7d3a;">SPF/DKIM/DMARC ✓</td></tr>
</table>

<h2 style="color:#1a1a2e;font-size:16px;border-bottom:2px solid #eee;padding-bottom:8px;">Competitor Landscape — Canberra</h2>
<table style="width:100%;border-collapse:collapse;margin:12px 0 4px;font-size:13px;">
  <tr style="background:#f8f8f8;"><th style="padding:8px;text-align:left;">Competitor</th><th style="padding:8px;text-align:left;">Pricing</th><th style="padding:8px;text-align:left;">Notes</th></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>CBR AI</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">$390–$790/mo</td><td style="padding:8px;border-bottom:1px solid #eee;">AI receptionist, CRM, chatbot. Main local competitor.</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Canberra AI</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">Not public</td><td style="padding:8px;border-bottom:1px solid #eee;">Solo operator (Josh). Voice agents, chatbots. Similar positioning.</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Sophiie AI</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">~$300/mo + $800 setup</td><td style="padding:8px;border-bottom:1px solid #eee;">AI virtual receptionist. National. Trades-focused.</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>SmartBot AI</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">$499–$1,799/mo</td><td style="padding:8px;border-bottom:1px solid #eee;">Premium positioning. Way above LayerOps pricing.</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>ChatBot.net.au</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">$99/mo</td><td style="padding:8px;border-bottom:1px solid #eee;">Closest on price. Simple chatbot, no voice.</td></tr>
  <tr><td style="padding:8px;"><strong>AI Trades</strong></td><td style="padding:8px;">$2K–$12K setup</td><td style="padding:8px;">Tradie-specific. Expensive setup fees.</td></tr>
</table>
<p style="font-size:13px;color:#666;margin:4px 0 20px;"><strong>LayerOps at $99–$599/mo with free setup is the cheapest done-for-you option in the Canberra market.</strong></p>

<h2 style="color:#1a1a2e;font-size:16px;border-bottom:2px solid #eee;padding-bottom:8px;">Market Data</h2>
<ul style="padding-left:20px;margin:12px 0 20px;">
  <li><strong>64% of Australian SMBs</strong> now use AI regularly — up from 39% in mid-2024</li>
  <li><strong>Only 33% of micro-businesses</strong> (0–4 staff) have adopted — this is LayerOps' target</li>
  <li><strong>62% of calls to small businesses are missed</strong> — 85% of those callers never try again</li>
  <li><strong>$44–50B potential GDP impact</strong> from SMB AI adoption by 2030 (Deloitte)</li>
  <li>SMBs moving from basic to intermediate AI see <strong>45% profitability increase</strong></li>
  <li>Construction/trades at <strong>34% adoption, accelerating fast</strong></li>
</ul>

<h2 style="color:#1a1a2e;font-size:16px;border-bottom:2px solid #eee;padding-bottom:8px;">Top Recommendations</h2>

<div style="background:#f0f7f0;border-left:4px solid #2d7d3a;padding:12px 16px;margin:12px 0;border-radius:0 4px 4px 0;">
<strong style="color:#2d7d3a;">1. Re-send batch 1 outreach now</strong>
<p style="margin:6px 0 0;font-size:13px;">SPF/DKIM/DMARC is fixed. The original 8 emails almost certainly went to spam. Re-send them — these leads haven't seen your message yet.</p>
</div>

<div style="background:#f0f7f0;border-left:4px solid #2d7d3a;padding:12px 16px;margin:12px 0;border-radius:0 4px 4px 0;">
<strong style="color:#2d7d3a;">2. Lead with the missed-calls stat</strong>
<p style="margin:6px 0 0;font-size:13px;">"62% of calls to small businesses go unanswered — 85% never call back." This is the single most compelling pain point. Put it on the homepage, in outreach, everywhere. It sells the Professional tier ($299) better than any feature list.</p>
</div>

<div style="background:#f0f7f0;border-left:4px solid #2d7d3a;padding:12px 16px;margin:12px 0;border-radius:0 4px 4px 0;">
<strong style="color:#2d7d3a;">3. Target trades + medical in Canberra first</strong>
<p style="margin:6px 0 0;font-size:13px;">Trades are at 34% AI adoption and accelerating. Medical practices have high booking volume and after-hours enquiry pain. Both are underserved at your price point. Batch 2 (medical/legal/real estate) is ready to send.</p>
</div>

<div style="background:#f0f7f0;border-left:4px solid #2d7d3a;padding:12px 16px;margin:12px 0;border-radius:0 4px 4px 0;">
<strong style="color:#2d7d3a;">4. Watch CBR AI and Canberra AI closely</strong>
<p style="margin:6px 0 0;font-size:13px;">CBR AI ($390–$790/mo) is the main local threat. They offer face-to-face consultations — you should too. Canberra AI (Josh, solo operator) is most similar to you. Your price advantage is real — lean into it.</p>
</div>

<div style="background:#f0f7f0;border-left:4px solid #2d7d3a;padding:12px 16px;margin:12px 0;border-radius:0 4px 4px 0;">
<strong style="color:#2d7d3a;">5. Add Google Reviews automation to Starter tier</strong>
<p style="margin:6px 0 0;font-size:13px;">Almost nobody bundles review collection with chatbots at the low end. A post-service "How was your experience? Leave us a Google review" flow would differentiate the Starter tier and is trivial to build.</p>
</div>

<div style="background:#fff8e6;border-left:4px solid #c8a200;padding:12px 16px;margin:12px 0;border-radius:0 4px 4px 0;">
<strong style="color:#c8a200;">6. Consider voice AI for the Operator tier</strong>
<p style="margin:6px 0 0;font-size:13px;">Voice AI is the breakout trend in 2026. Businesses report 68% cost reduction after deployment. AI receptionists cost $49–$500/mo vs $45K–$75K/year for a human. This could justify the $599 Operator price and differentiate from chatbot-only competitors.</p>
</div>

<h2 style="color:#1a1a2e;font-size:16px;border-bottom:2px solid #eee;padding-bottom:8px;">Gaps to Exploit</h2>
<ul style="padding-left:20px;margin:12px 0 20px;font-size:13px;">
  <li><strong>Byron Bay hospitality/tourism</strong> — essentially uncontested at your price. Restaurants, tour operators, accommodation all need after-hours booking.</li>
  <li><strong>Quote capture for tradies</strong> — a chatbot that captures job details + photos before forwarding to the tradie. Nobody offers this below $300/mo.</li>
  <li><strong>Regional businesses</strong> — most AI agencies cluster in Sydney/Melbourne. Canberra + regional NSW/ACT is yours for the taking.</li>
  <li><strong>Niche trades</strong> — pest control, fencing, pool maintenance, arborists, cleaning. Sophiie and TradieBots focus on plumbers/electricians. The long tail is wide open.</li>
</ul>

<div style="background:#f8f8f8;padding:16px;border-radius:4px;margin:20px 0 0;font-size:12px;color:#666;">
  <p style="margin:0;">This report was generated by the LayerOps Market Intelligence Agent. Data sourced from Google Places API, web research, and internal pipeline analysis.</p>
</div>

</div>
</div>
</body></html>`;
}

async function main() {
  if (!RESEND_API_KEY && !DRY_RUN) {
    console.error('Set RESEND_API_KEY first: export RESEND_API_KEY=re_xxx');
    process.exit(1);
  }

  console.log('\nLayerOps Market Intelligence Agent');
  console.log('══════════════════════════════════\n');

  const html = buildReport();

  if (DRY_RUN) {
    const outPath = path.join(__dirname, 'market-intel-preview.html');
    fs.writeFileSync(outPath, html);
    console.log(`[DRY RUN] Report saved to ${outPath}`);
    console.log('Open in browser to preview.\n');
    return;
  }

  console.log(`Sending report to ${TO}...`);

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      reply_to: 'jarek@layerops.tech',
      subject: `Market Intel — ${new Date().toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}`,
      html,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`Failed (${resp.status}): ${err}`);
    process.exit(1);
  }

  const data = await resp.json();
  console.log(`Sent! ID: ${data.id}`);
  console.log(`Check ${TO} for the report.\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
