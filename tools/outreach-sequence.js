#!/usr/bin/env node

// LayerOps Outreach Sequence Runner
// Manages 5-email follow-up sequences with CRM tracking.
//
// Usage:
//   node tools/outreach-sequence.js --status           Show all leads and their sequence step
//   node tools/outreach-sequence.js --preview          Preview next emails to be sent
//   node tools/outreach-sequence.js --send             Send all due emails
//   node tools/outreach-sequence.js --send --dry-run   Preview what would be sent
//   node tools/outreach-sequence.js --reset            Reset all leads to step 0
//   node tools/outreach-sequence.js --add <file>       Import leads from a targets JSON file
//
// Requires: RESEND_API_KEY environment variable
// Optional: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID for CRM sync

const fs = require('fs');
const path = require('path');
const { buildSequence, toHtml } = require('./email-sequences.js');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const FROM = 'Jarek Piotrowski <jarek@layerops.tech>';
const SEQUENCE_FILE = path.join(__dirname, 'outreach-state.json');

// ─── State Management ───────────────────────────────────────────────────────

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(SEQUENCE_FILE, 'utf8'));
  } catch {
    return { leads: [] };
  }
}

function saveState(state) {
  fs.writeFileSync(SEQUENCE_FILE, JSON.stringify(state, null, 2));
}

function findLead(state, email) {
  return state.leads.find(l => l.email === email);
}

// ─── CRM Sync (write to Cloudflare KV via API) ─────────────────────────────

const CF_API = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const CRM_NAMESPACE = '8d44dabe6c484f30b8c5ac2d6d090280';

async function syncToCRM(lead) {
  if (!CF_API || !CF_ACCOUNT) return;

  const id = lead.crmId || lead.email.replace(/[^a-z0-9]/gi, '-');
  const crmLead = {
    id,
    name: lead.name,
    email: lead.email,
    url: lead.url,
    score: lead.score || null,
    type: lead.type || 'cold',
    status: lead.sequenceStep === 0 ? 'contacted' : 'sequence',
    subject: lead.lastSubject || '',
    deliveredAt: null,
    openedAt: null,
    repliedAt: null,
    notes: `Sequence step ${lead.sequenceStep}/5. Last sent: ${lead.lastSentAt || 'never'}`,
    revenue: 0,
    created_at: lead.createdAt || new Date().toISOString(),
    sequence_step: lead.sequenceStep,
    last_sent_at: lead.lastSentAt,
    next_send_at: lead.nextSendAt,
  };

  try {
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${CRM_NAMESPACE}/values/lead:${id}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${CF_API}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(crmLead),
      }
    );

    // Also update the index
    const indexResp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${CRM_NAMESPACE}/values/index:leads`,
      {
        headers: { 'Authorization': `Bearer ${CF_API}` },
      }
    );
    let index = [];
    if (indexResp.ok) {
      try { index = JSON.parse(await indexResp.text()); } catch {}
    }
    if (!index.includes(id)) {
      index.push(id);
      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${CRM_NAMESPACE}/values/index:leads`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${CF_API}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(index),
        }
      );
    }
  } catch (err) {
    console.error(`  CRM sync failed for ${lead.email}: ${err.message}`);
  }
}

// ─── Email Sending ──────────────────────────────────────────────────────────

async function sendEmail(to, subject, textBody) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would send: "${subject}" to ${to}`);
    return { id: 'dry-run' };
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      cc: ['jarek@layerops.tech'],
      subject,
      html: toHtml(textBody),
      text: textBody,
      reply_to: 'jarek@layerops.tech',
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Resend error (${resp.status}): ${err}`);
  }
  return resp.json();
}

// ─── Commands ───────────────────────────────────────────────────────────────

function showStatus(state) {
  console.log(`\nOutreach Sequence Status`);
  console.log(`═══════════════════════\n`);
  console.log(`Total leads: ${state.leads.length}\n`);

  if (state.leads.length === 0) {
    console.log('No leads loaded. Run: node tools/outreach-sequence.js --add tools/targets-fresh.json\n');
    return;
  }

  const byStep = [0, 0, 0, 0, 0, 0]; // steps 0-5 (5 = complete)
  state.leads.forEach(l => byStep[l.sequenceStep || 0]++);

  console.log('Pipeline:');
  console.log(`  Not started:  ${byStep[0]}`);
  console.log(`  Email 1 sent: ${byStep[1]}`);
  console.log(`  Email 2 sent: ${byStep[2]}`);
  console.log(`  Email 3 sent: ${byStep[3]}`);
  console.log(`  Email 4 sent: ${byStep[4]}`);
  console.log(`  Complete:     ${byStep[5]}\n`);

  console.log('Leads:');
  for (const lead of state.leads) {
    const step = lead.sequenceStep || 0;
    const status = step >= 5 ? 'DONE' : `step ${step}/5`;
    const next = lead.nextSendAt ? ` | next: ${lead.nextSendAt.split('T')[0]}` : '';
    const paused = lead.paused ? ' [PAUSED]' : '';
    console.log(`  ${lead.name} (${lead.industry || '?'}) — ${status}${next}${paused}`);
  }
  console.log();
}

function previewNext(state) {
  const now = new Date();
  console.log(`\nEmails due to send:\n`);

  let count = 0;
  for (const lead of state.leads) {
    if (lead.paused) continue;
    const step = lead.sequenceStep || 0;
    if (step >= 5) continue;

    // Check if it's time to send
    if (lead.nextSendAt && new Date(lead.nextSendAt) > now) {
      const days = Math.ceil((new Date(lead.nextSendAt) - now) / 86400000);
      console.log(`  ${lead.name} — email ${step + 1} due in ${days} day(s)`);
      continue;
    }

    const sequence = buildSequence(lead);
    const email = sequence[step];
    console.log(`  ${lead.name} — EMAIL ${step + 1} (ready now)`);
    console.log(`    Subject: ${email.subject}`);
    console.log(`    To: ${lead.email}`);
    console.log(`    ---`);
    console.log(`    ${email.text.split('\n').slice(0, 4).join('\n    ')}...`);
    console.log();
    count++;
  }

  if (count === 0) console.log('  No emails due right now.\n');
  else console.log(`${count} email(s) ready to send. Run with --send to send them.\n`);
}

async function sendDue(state) {
  const now = new Date();

  if (!RESEND_API_KEY && !DRY_RUN) {
    console.error('Set RESEND_API_KEY first: export RESEND_API_KEY=re_xxx');
    process.exit(1);
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Sending due emails...\n`);

  let sent = 0;
  let skipped = 0;

  for (const lead of state.leads) {
    if (lead.paused) { skipped++; continue; }
    const step = lead.sequenceStep || 0;
    if (step >= 5) { skipped++; continue; }

    // Check timing
    if (lead.nextSendAt && new Date(lead.nextSendAt) > now) {
      skipped++;
      continue;
    }

    const sequence = buildSequence(lead);
    const email = sequence[step];

    process.stdout.write(`  ${lead.name} — email ${step + 1}/5... `);

    try {
      const result = await sendEmail(lead.email, email.subject, email.text);
      console.log(`sent (${result.id})`);

      // Update state
      lead.sequenceStep = step + 1;
      lead.lastSentAt = now.toISOString();
      lead.lastSubject = email.subject;
      lead.lastResendId = result.id;

      // Calculate next send date
      if (step + 1 < 5) {
        const nextEmail = sequence[step + 1];
        const daysUntilNext = nextEmail.day - email.day;
        const nextDate = new Date(now);
        nextDate.setDate(nextDate.getDate() + daysUntilNext);
        // Send at 8am AEST
        nextDate.setUTCHours(22, 0, 0, 0); // 22:00 UTC = 8am AEST
        lead.nextSendAt = nextDate.toISOString();
      } else {
        lead.nextSendAt = null;
      }

      // Sync to CRM
      await syncToCRM(lead);

      sent++;
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }

    // 2 second delay between sends
    if (state.leads.indexOf(lead) < state.leads.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  saveState(state);
  console.log(`\nSent: ${sent} | Skipped: ${skipped}\n`);
}

function addLeads(state, file) {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const targets = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let added = 0;
  let dupes = 0;

  for (const t of targets) {
    // Need email to send outreach — check if we have one
    const email = t.email || null;
    if (!email) {
      console.log(`  Skipping ${t.name} — no email address`);
      continue;
    }

    if (findLead(state, email)) {
      dupes++;
      continue;
    }

    state.leads.push({
      name: t.name,
      email: t.email,
      url: t.url,
      industry: t.industry || 'default',
      city: t.city || 'Canberra',
      score: t.score || t.overall_score || null,
      topIssue: t.topIssue || t.top_issue || null,
      type: t.type || 'cold',
      firstName: t.firstName || t.first_name || 'there',
      sequenceStep: 0,
      lastSentAt: null,
      nextSendAt: null,
      lastSubject: null,
      lastResendId: null,
      paused: false,
      createdAt: new Date().toISOString(),
    });
    added++;
  }

  saveState(state);
  console.log(`\nAdded ${added} leads (${dupes} duplicates skipped). Total: ${state.leads.length}\n`);
}

function resetAll(state) {
  for (const lead of state.leads) {
    lead.sequenceStep = 0;
    lead.lastSentAt = null;
    lead.nextSendAt = null;
    lead.lastSubject = null;
    lead.lastResendId = null;
    lead.paused = false;
  }
  saveState(state);
  console.log(`\nReset ${state.leads.length} leads to step 0.\n`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const state = loadState();

  if (args.includes('--status')) return showStatus(state);
  if (args.includes('--preview')) return previewNext(state);
  if (args.includes('--send')) return sendDue(state);
  if (args.includes('--reset')) return resetAll(state);
  if (args.includes('--add')) {
    const fileIdx = args.indexOf('--add') + 1;
    if (!args[fileIdx]) {
      console.error('Usage: --add <targets-file.json>');
      process.exit(1);
    }
    return addLeads(state, args[fileIdx]);
  }

  console.log(`
LayerOps Outreach Sequence Runner
══════════════════════════════════

Commands:
  --status           Show all leads and their sequence step
  --preview          Preview next emails to be sent
  --send             Send all due emails
  --send --dry-run   Preview without sending
  --add <file>       Import leads from targets JSON
  --reset            Reset all leads to step 0

Setup:
  export RESEND_API_KEY=re_xxx

  Optional CRM sync (tracks opens/clicks via Resend webhooks):
  export CLOUDFLARE_API_TOKEN=xxx
  export CLOUDFLARE_ACCOUNT_ID=xxx

Workflow:
  1. Add leads:    node tools/outreach-sequence.js --add tools/targets-fresh.json
  2. Preview:      node tools/outreach-sequence.js --preview
  3. Send:         node tools/outreach-sequence.js --send
  4. Check status: node tools/outreach-sequence.js --status
  5. Run daily — sends next email when the timing is right
`);
}

main().catch(err => { console.error(err); process.exit(1); });
