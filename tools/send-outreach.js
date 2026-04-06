#!/usr/bin/env node

// Send outreach emails via Resend API
// Usage: node tools/send-outreach.js [--dry-run]
//
// Requires: RESEND_API_KEY environment variable

const fs = require('fs');
const path = require('path');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const FROM = 'Jarek Piotrowski <jarek@layerops.tech>';
const CC = 'jarek@layerops.tech';

const emails = [
  {
    to: 'bookings@byronbayplatinumtransfers.com.au',
    subject: 'Ran a health check on your website — found a few things',
    file: 'outreach-byronbayplatinumtransfers.html',
    name: 'Byron Bay Platinum Transfers',
    type: 'friend',
  },
  {
    to: 'Thomas@nice-feilds.farm',
    subject: 'Ran a health check on nice-feilds.farm — some quick wins',
    file: 'outreach-nice-feilds-farm.html',
    name: 'Nice Feilds Farm',
    type: 'friend',
  },
  {
    to: 'info@civicgentledentalcare.com.au',
    subject: 'noticed something on your website',
    file: 'outreach-www-civicgentledentalcare-com-au.html',
    name: 'Civic Gentle Dental Care',
    type: 'cold',
  },
  {
    to: 'office@jmlplumbing.net.au',
    subject: 'your contact form might have an issue',
    file: 'outreach-jmlplumbing-net-au.html',
    name: 'JML Plumbing and Gas',
    type: 'cold',
  },
  {
    to: 'office@bluerainelectrical.com.au',
    subject: 'your photos aren\'t showing up on google',
    file: 'outreach-bluerainelectrical-com-au.html',
    name: 'Blue Rain Electrical',
    type: 'cold',
  },
  {
    to: 'care.dentalembassy@gmail.com',
    subject: 'quick thought about dentalembassy.com.au',
    file: 'outreach-dentalembassy-com-au.html',
    name: 'Dental Embassy',
    type: 'cold',
  },
  {
    to: 'plumbworksplumbing@outlook.com',
    subject: 'your site might be slow on mobile',
    file: 'outreach-www-canberraplumbworks-com-au.html',
    name: 'Plumbworks Canberra',
    type: 'cold',
  },
  {
    to: 'gardengigs@gmail.com',
    subject: 'typo on your google listing',
    file: 'outreach-gardengigs-net-au.html',
    name: 'Gardengigs',
    type: 'cold',
  },
];

async function sendEmail(entry) {
  const htmlPath = path.join(__dirname, 'outreach-html', entry.file);
  const html = fs.readFileSync(htmlPath, 'utf8');

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would send to ${entry.to}`);
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
      to: [entry.to],
      cc: [CC],
      subject: entry.subject,
      html: html,
      reply_to: 'jarek@layerops.tech',
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Resend error (${resp.status}): ${err}`);
  }

  return resp.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!RESEND_API_KEY && !DRY_RUN) {
    console.error('\n❌ RESEND_API_KEY not set.');
    console.error('Run: set RESEND_API_KEY=your_key_here\n');
    process.exit(1);
  }

  console.log(`\n📧 LayerOps Outreach Sender`);
  console.log(`══════════════════════════\n`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no emails sent)' : '🔴 LIVE — EMAILS WILL BE SENT'}`);
  console.log(`From: ${FROM}`);
  console.log(`CC: ${CC}`);
  console.log(`Emails: ${emails.length}\n`);

  if (!DRY_RUN) {
    console.log('Sending in 5 seconds... (Ctrl+C to cancel)\n');
    await sleep(5000);
  }

  let sent = 0;
  let failed = 0;

  for (const entry of emails) {
    process.stdout.write(`${entry.type === 'friend' ? '👋' : '📧'} ${entry.name} (${entry.to})... `);

    try {
      const result = await sendEmail(entry);
      console.log(`✅ Sent (${result.id})`);
      sent++;
    } catch (err) {
      console.log(`❌ Failed: ${err.message}`);
      failed++;
    }

    // 2 second delay between emails to avoid rate limiting
    if (emails.indexOf(entry) < emails.length - 1) {
      await sleep(2000);
    }
  }

  console.log(`\n══════════ DONE ══════════`);
  console.log(`Sent: ${sent} | Failed: ${failed}`);
  console.log(`All emails CC'd to ${CC}\n`);
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
