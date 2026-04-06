// LayerOps Market Intelligence Worker — Dynamic Edition
// Pulls live data from KV (CRM, leads, clients) + competitor checks
// Deploy: npx wrangler deploy -c workers/market-intel/wrangler-intel.toml

const COMPETITORS = [
  { name: 'CBR AI', url: 'https://cbrai.com.au/', priceRange: '$390–$790/mo' },
  { name: 'Canberra AI', url: 'https://canberrai.com/', priceRange: 'Not public' },
  { name: 'Sophiie AI', url: 'https://www.sophiie.ai/', priceRange: '~$300/mo + $800 setup' },
  { name: 'ChatBot.net.au', url: 'https://chatbot.net.au/', priceRange: '$99/mo' },
  { name: 'SmartBot AI', url: 'https://smartbotai.agency/', priceRange: '$499–$1,799/mo' },
  { name: 'TradieBots', url: 'https://tradiebots.com.au/', priceRange: 'Not public' },
];

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendReport(env));
  },
  async fetch(request, env) {
    if (request.method === 'GET') {
      await sendReport(env);
      return new Response('Report sent.', { status: 200 });
    }
    return new Response('GET to trigger report', { status: 405 });
  },
};

// ─── Data Collection ────────────────────────────────────────────────────────

async function getCRMStats(env) {
  const stats = { total: 0, open: 0, delivered: 0, bounced: 0, replied: 0, leads: [] };
  try {
    const raw = await env.CRM.get('index:leads');
    if (!raw) return stats;
    const ids = JSON.parse(raw);
    stats.total = ids.length;

    // Sample up to 50 most recent leads for engagement stats
    const sample = ids.slice(-50);
    for (const id of sample) {
      const data = await env.CRM.get(`lead:${id}`);
      if (!data) continue;
      const lead = JSON.parse(data);
      if (lead.openedAt) stats.open++;
      if (lead.deliveredAt) stats.delivered++;
      if (lead.repliedAt) stats.replied++;
      if (lead.status === 'bounced' || (lead.notes && lead.notes.includes('bounce'))) stats.bounced++;
      stats.leads.push(lead);
    }
  } catch (err) {
    console.error('CRM stats error:', err);
  }
  return stats;
}

async function getClientStats(env) {
  const stats = { totalLeads: 0, totalBookings: 0, clients: [] };
  try {
    // Check known client slugs
    const slugs = ['byron', 'demo', 'nicefeilds'];
    for (const slug of slugs) {
      const leadsRaw = await env.CLIENTS.get(`leads:${slug}`);
      const bookingsRaw = await env.CLIENTS.get(`bookings:${slug}`);
      const leads = leadsRaw ? JSON.parse(leadsRaw) : [];
      const bookings = bookingsRaw ? JSON.parse(bookingsRaw) : [];
      if (leads.length || bookings.length) {
        stats.clients.push({ slug, leads: leads.length, bookings: bookings.length });
        stats.totalLeads += leads.length;
        stats.totalBookings += bookings.length;
      }
    }
  } catch (err) {
    console.error('Client stats error:', err);
  }
  return stats;
}

async function checkCompetitors() {
  const results = [];
  for (const comp of COMPETITORS) {
    try {
      const resp = await fetch(comp.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LayerOps/1.0)' },
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });
      results.push({
        ...comp,
        status: resp.status,
        online: resp.ok,
      });
    } catch {
      results.push({ ...comp, status: 0, online: false });
    }
  }
  return results;
}

async function getAuditLeadStats(env) {
  const stats = { totalAudits: 0, avgScore: 0, hotLeads: 0, warmLeads: 0, scores: [] };
  try {
    // List recent leads from LEADS namespace
    const list = await env.LEADS.list({ limit: 100 });
    for (const key of list.keys) {
      if (key.name.startsWith('limit:') || key.name.startsWith('email:')) continue;
      try {
        const raw = await env.LEADS.get(key.name);
        if (!raw) continue;
        const lead = JSON.parse(raw);
        if (lead.overall_score !== undefined) {
          stats.totalAudits++;
          stats.scores.push(lead.overall_score);
          if (lead.overall_score < 50) stats.hotLeads++;
          else if (lead.overall_score < 70) stats.warmLeads++;
        }
      } catch { /* skip malformed */ }
    }
    if (stats.scores.length) {
      stats.avgScore = Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length);
    }
  } catch (err) {
    console.error('Audit stats error:', err);
  }
  return stats;
}

// ─── Report Builder ─────────────────────────────────────────────────────────

function buildReport({ crm, clients, competitors, audits }) {
  const now = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Australia/Sydney',
  });

  const openRate = crm.delivered > 0 ? Math.round((crm.open / crm.delivered) * 100) : 0;
  const replyRate = crm.delivered > 0 ? Math.round((crm.replied / crm.delivered) * 100) : 0;

  const competitorRows = competitors.map(c => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;"><strong>${c.name}</strong></td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${c.priceRange}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${c.online ? '<span style="color:#2d7d3a;">Online</span>' : '<span style="color:#c00;">Down/Changed</span>'}</td>
    </tr>`).join('');

  const clientRows = clients.clients.length > 0
    ? clients.clients.map(c => `<tr><td style="padding:6px 0;color:#666;">${c.slug}</td><td style="padding:6px 0;font-weight:600;text-align:right;">${c.leads} leads, ${c.bookings} bookings</td></tr>`).join('')
    : '<tr><td style="padding:6px 0;color:#999;" colspan="2">No client activity yet</td></tr>';

  // Dynamic recommendations based on data
  const recs = [];

  if (openRate < 20 && crm.delivered > 0) {
    recs.push({ color: '#c00', bg: '#fff0f0', title: 'Low open rate', text: `Only ${openRate}% of delivered emails opened. Test new subject lines — try leading with a specific finding ("your homepage is missing X") rather than generic hooks.` });
  } else if (crm.delivered > 0) {
    recs.push({ color: '#2d7d3a', bg: '#f0f7f0', title: `Open rate: ${openRate}%`, text: `${crm.open} of ${crm.delivered} delivered emails opened. ${openRate >= 40 ? 'Strong performance — keep the current subject line style.' : 'Room to improve. Try more specific, personalized subjects.'}` });
  }

  if (crm.bounced > 0) {
    recs.push({ color: '#c8a200', bg: '#fff8e6', title: `${crm.bounced} bounced emails`, text: 'Remove bounced addresses from future sends. Repeated bounces hurt sender reputation.' });
  }

  if (audits.hotLeads > 0) {
    recs.push({ color: '#2d7d3a', bg: '#f0f7f0', title: `${audits.hotLeads} hot leads (score < 50)`, text: 'These businesses have serious website issues. Prioritize outreach to them — they have the most to gain and are most likely to convert.' });
  }

  if (clients.totalBookings > 0) {
    recs.push({ color: '#2d7d3a', bg: '#f0f7f0', title: `${clients.totalBookings} bookings captured`, text: `Your client chatbots have captured ${clients.totalBookings} bookings. Use this as social proof in outreach: "Our AI chatbot has already booked ${clients.totalBookings}+ appointments for local businesses."` });
  }

  // Always include these strategic recs
  recs.push({ color: '#2d7d3a', bg: '#f0f7f0', title: 'Lead with missed-calls stat', text: '"62% of calls to small businesses go unanswered — 85% never call back." Best stat for selling Professional tier ($299/mo).' });
  recs.push({ color: '#c8a200', bg: '#fff8e6', title: 'Underserved niches to scout', text: 'Byron Bay hospitality, pest control, fencing, pool maintenance, arborists, cleaning services. Run: node tools/scout.js "pest control Canberra" --audit' });

  const recsHtml = recs.map(r => `
    <div style="background:${r.bg};border-left:4px solid ${r.color};padding:12px 16px;margin:12px 0;border-radius:0 4px 4px 0;">
      <strong style="color:${r.color};">${r.title}</strong>
      <p style="margin:6px 0 0;font-size:13px;">${r.text}</p>
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.7;color:#333;background:#f5f5f5;">
<div style="max-width:640px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

<div style="background:#1a1a2e;color:#fff;padding:24px 32px;">
  <h1 style="margin:0 0 4px;font-size:20px;font-weight:600;">LayerOps Market Intelligence</h1>
  <p style="margin:0;opacity:0.7;font-size:13px;">${now}</p>
</div>

<div style="padding:24px 32px;">

<h2 style="color:#1a1a2e;font-size:16px;border-bottom:2px solid #eee;padding-bottom:8px;">Pipeline — Live Stats</h2>
<table style="width:100%;border-collapse:collapse;margin:12px 0 20px;">
  <tr><td style="padding:6px 0;color:#666;">CRM leads (total)</td><td style="padding:6px 0;font-weight:600;text-align:right;">${crm.total}</td></tr>
  <tr><td style="padding:6px 0;color:#666;">Emails delivered</td><td style="padding:6px 0;font-weight:600;text-align:right;">${crm.delivered}</td></tr>
  <tr><td style="padding:6px 0;color:#666;">Opened</td><td style="padding:6px 0;font-weight:600;text-align:right;">${crm.open} (${openRate}%)</td></tr>
  <tr><td style="padding:6px 0;color:#666;">Replied</td><td style="padding:6px 0;font-weight:600;text-align:right;">${crm.replied} (${replyRate}%)</td></tr>
  <tr><td style="padding:6px 0;color:#666;">Bounced</td><td style="padding:6px 0;font-weight:600;text-align:right;">${crm.bounced}</td></tr>
</table>

<h2 style="color:#1a1a2e;font-size:16px;border-bottom:2px solid #eee;padding-bottom:8px;">Audit Funnel</h2>
<table style="width:100%;border-collapse:collapse;margin:12px 0 20px;">
  <tr><td style="padding:6px 0;color:#666;">Website audits run</td><td style="padding:6px 0;font-weight:600;text-align:right;">${audits.totalAudits}</td></tr>
  <tr><td style="padding:6px 0;color:#666;">Average score</td><td style="padding:6px 0;font-weight:600;text-align:right;">${audits.avgScore}/100</td></tr>
  <tr><td style="padding:6px 0;color:#666;">Hot leads (score &lt; 50)</td><td style="padding:6px 0;font-weight:600;text-align:right;color:#c00;">${audits.hotLeads}</td></tr>
  <tr><td style="padding:6px 0;color:#666;">Warm leads (score &lt; 70)</td><td style="padding:6px 0;font-weight:600;text-align:right;color:#c8a200;">${audits.warmLeads}</td></tr>
</table>

<h2 style="color:#1a1a2e;font-size:16px;border-bottom:2px solid #eee;padding-bottom:8px;">Client Chatbots</h2>
<table style="width:100%;border-collapse:collapse;margin:12px 0 20px;">
  ${clientRows}
  <tr style="border-top:2px solid #eee;"><td style="padding:8px 0;font-weight:600;">Total</td><td style="padding:8px 0;font-weight:600;text-align:right;">${clients.totalLeads} leads, ${clients.totalBookings} bookings</td></tr>
</table>

<h2 style="color:#1a1a2e;font-size:16px;border-bottom:2px solid #eee;padding-bottom:8px;">Competitor Watch</h2>
<table style="width:100%;border-collapse:collapse;margin:12px 0 4px;font-size:13px;">
  <tr style="background:#f8f8f8;"><th style="padding:8px;text-align:left;">Competitor</th><th style="padding:8px;text-align:left;">Pricing</th><th style="padding:8px;text-align:left;">Status</th></tr>
  ${competitorRows}
</table>
<p style="font-size:12px;color:#999;margin:4px 0 20px;">Sites marked "Down/Changed" may have changed URLs or gone offline — worth investigating.</p>

<h2 style="color:#1a1a2e;font-size:16px;border-bottom:2px solid #eee;padding-bottom:8px;">Recommendations</h2>
${recsHtml}

<div style="background:#f8f8f8;padding:16px;border-radius:4px;margin:20px 0 0;font-size:12px;color:#666;">
  <p style="margin:0;">Live data from CRM, audit, and client KV namespaces. Competitor sites pinged at report time.<br>
  Manual trigger: <code>curl https://intel.layerops.tech</code><br>
  Edit: <code>workers/market-intel/worker.js</code> → <code>npx wrangler deploy -c workers/market-intel/wrangler-intel.toml</code></p>
</div>

</div>
</div>
</body></html>`;
}

// ─── Send ───────────────────────────────────────────────────────────────────

async function sendReport(env) {
  // Collect all data in parallel
  const [crm, clients, competitors, audits] = await Promise.all([
    getCRMStats(env),
    getClientStats(env),
    checkCompetitors(),
    getAuditLeadStats(env),
  ]);

  const html = buildReport({ crm, clients, competitors, audits });
  const now = new Date().toLocaleDateString('en-AU', { month: 'short', day: 'numeric', timeZone: 'Australia/Sydney' });

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'LayerOps Intel <jarek@layerops.tech>',
      to: ['jarekpiot@gmail.com'],
      reply_to: 'jarek@layerops.tech',
      subject: `Market Intel — ${now}`,
      html,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`Resend error (${resp.status}): ${err}`);
    throw new Error(`Email failed: ${resp.status}`);
  }

  const data = await resp.json();
  console.log(`Market intel sent: ${data.id} | CRM: ${crm.total} leads | Audits: ${audits.totalAudits} | Clients: ${clients.clients.length}`);
}
