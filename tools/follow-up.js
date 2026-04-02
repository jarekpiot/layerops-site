#!/usr/bin/env node

// LayerOps Follow-Up Email Automation
// Checks CRM for leads that need follow-ups and sends them.
//
// Usage:
//   node tools/follow-up.js              (dry run — shows what would be sent)
//   node tools/follow-up.js --send       (actually sends the emails)
//   node tools/follow-up.js --send --all (includes friends, not just cold)
//
// Requires: RESEND_API_KEY environment variable

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CRM_API = 'https://audit.layerops.tech/crm';
const DRY_RUN = !process.argv.includes('--send');
const INCLUDE_FRIENDS = process.argv.includes('--all');

const FROM = 'Jarek Piotrowski <jarek@layerops.tech>';
const BCC = 'jarekpiot@gmail.com';

// Follow-up schedule: days since first email
const SCHEDULE = [
  { day: 3, id: 'followup-2', subject: (name) => `re: ${name}`, template: followUp2 },
  { day: 7, id: 'followup-3', subject: (name) => `${name} — one more thing`, template: followUp3 },
  { day: 14, id: 'followup-4', subject: (name) => `still happy to help — ${name}`, template: followUp4 },
  { day: 21, id: 'followup-final', subject: (name) => `last note from me`, template: followUpFinal },
];

// ─── Email templates ─────────────────────────────────────────────────────────

function followUp2(lead) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.7;color:#333;">
<p>Hi,</p>
<p>Just checking you saw my note about ${lead.name || 'your website'}. I found some things that could help more customers find you online.</p>
<p>Happy to send through the full report if you're interested — no cost, no obligation.</p>
<p>Cheers,<br>Jarek Piotrowski<br><span style="color:#999;font-size:13px;">LayerOps &middot; <a href="https://layerops.tech" style="color:#2B6777;">layerops.tech</a> &middot; 0404 003 240</span></p>
</body></html>`;
}

function followUp3(lead) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.7;color:#333;">
<p>Hi,</p>
<p>One more thing I noticed about ${lead.url ? new URL(lead.url).hostname : 'your site'} — when someone shares it on Facebook or LinkedIn, it doesn't show a proper preview. That means you're missing out on word-of-mouth traffic.</p>
<p>That's one of the 8 things I found in the full audit. Want me to send it through?</p>
<p>Cheers,<br>Jarek Piotrowski<br><span style="color:#999;font-size:13px;">LayerOps &middot; <a href="https://layerops.tech" style="color:#2B6777;">layerops.tech</a> &middot; 0404 003 240</span></p>
</body></html>`;
}

function followUp4(lead) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.7;color:#333;">
<p>Hi,</p>
<p>I help Canberra businesses get found on Google and capture more customer enquiries. I ran a health check on your website and put together a report with specific fixes.</p>
<p>If you're interested, just reply and I'll send it over. If not, no worries at all.</p>
<p>Cheers,<br>Jarek Piotrowski<br><span style="color:#999;font-size:13px;">LayerOps &middot; <a href="https://layerops.tech" style="color:#2B6777;">layerops.tech</a> &middot; 0404 003 240</span></p>
</body></html>`;
}

function followUpFinal(lead) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.7;color:#333;">
<p>Hi,</p>
<p>Last note from me — I wanted to make sure you had the option to see the full website report I put together for ${lead.name || 'your business'}.</p>
<p>If the timing isn't right, no problem. The report will be here whenever you're ready — just reply to this email.</p>
<p>All the best,<br>Jarek Piotrowski<br><span style="color:#999;font-size:13px;">LayerOps &middot; <a href="https://layerops.tech" style="color:#2B6777;">layerops.tech</a> &middot; 0404 003 240</span></p>
</body></html>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysSince(dateStr) {
  if (!dateStr) return 999;
  const sent = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - sent) / (1000 * 60 * 60 * 24));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendEmail(to, subject, html) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to: [to], bcc: [BCC], subject, html, reply_to: 'jarek@layerops.tech' }),
  });
  if (!resp.ok) throw new Error(`Resend error: ${await resp.text()}`);
  return resp.json();
}

async function updateCRM(id, notes) {
  await fetch(`${CRM_API}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, notes }),
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📧 LayerOps Follow-Up Automation`);
  console.log(`════════════════════════════════\n`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no emails sent)' : '🔴 LIVE'}`);
  console.log(`Include friends: ${INCLUDE_FRIENDS ? 'Yes' : 'No (cold only)'}\n`);

  // Fetch all leads from CRM
  const resp = await fetch(`${CRM_API}/leads`);
  const data = await resp.json();
  const allLeads = data.leads || [];

  console.log(`Total leads in CRM: ${allLeads.length}\n`);

  // Filter to leads that need follow-ups
  const eligible = allLeads.filter((l) => {
    // Skip if already replied, on a call, client, or lost
    if (['replied', 'call', 'client', 'lost'].includes(l.status)) return false;
    // Skip friends unless --all
    if (l.type === 'friend' && !INCLUDE_FRIENDS) return false;
    // Must have been contacted and have a sent date
    if (!l.sentAt && l.status !== 'contacted' && l.status !== 'opened') return false;
    // Must have an email
    if (!l.email) return false;
    return true;
  });

  console.log(`Eligible for follow-up: ${eligible.length}\n`);

  let sent = 0;
  let skipped = 0;

  for (const lead of eligible) {
    const days = daysSince(lead.sentAt || lead.created_at);
    const previousFollowUps = (lead.notes || '').match(/\[followup-/g) || [];
    const followUpCount = previousFollowUps.length;

    // Find the next follow-up to send
    const nextFollowUp = SCHEDULE[followUpCount];
    if (!nextFollowUp) {
      console.log(`  ⏭️  ${lead.name} — all follow-ups sent already`);
      skipped++;
      continue;
    }

    if (days < nextFollowUp.day) {
      console.log(`  ⏳ ${lead.name} — day ${days}, next follow-up on day ${nextFollowUp.day}`);
      skipped++;
      continue;
    }

    // Time to send
    const hostname = lead.url ? new URL(lead.url).hostname : lead.name;
    const subject = nextFollowUp.subject(hostname);
    const html = nextFollowUp.template(lead);

    if (DRY_RUN) {
      console.log(`  📝 ${lead.name} (day ${days}) — WOULD send "${subject}"`);
    } else {
      process.stdout.write(`  📧 ${lead.name} (day ${days}) — "${subject}"... `);
      try {
        await sendEmail(lead.email, subject, html);
        const newNotes = (lead.notes || '') + ` [${nextFollowUp.id} sent ${new Date().toISOString().split('T')[0]}]`;
        await updateCRM(lead.id, newNotes);
        console.log('✅');
        sent++;
      } catch (err) {
        console.log('❌ ' + err.message);
      }
      await sleep(2000);
    }
  }

  console.log(`\n════════════════════════════════`);
  console.log(`${DRY_RUN ? 'Would send' : 'Sent'}: ${DRY_RUN ? eligible.filter(l => {
    const days = daysSince(l.sentAt || l.created_at);
    const count = ((l.notes || '').match(/\[followup-/g) || []).length;
    const next = SCHEDULE[count];
    return next && days >= next.day;
  }).length : sent}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`\nRun with --send to actually send emails.`);
}

main().catch((err) => {
  console.error(`\n❌ Error: ${err.message}`);
  process.exit(1);
});
