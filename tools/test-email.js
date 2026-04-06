#!/usr/bin/env node

// Quick test: send a single email to verify deliverability
// Usage: RESEND_API_KEY=re_xxx node tools/test-email.js

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error('Set RESEND_API_KEY first: export RESEND_API_KEY=re_xxx');
  process.exit(1);
}

const TO = 'jarekpiot@gmail.com';
const FROM = 'Jarek Piotrowski <jarek@layerops.tech>';

async function main() {
  console.log(`Sending test email to ${TO}...`);

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
      subject: 'Testing deliverability — ignore this',
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.7;color:#333;">
<p>Hey Jarek,</p>
<p>This is a test email sent via Resend from <strong>jarek@layerops.tech</strong> to check deliverability after the SPF/DKIM/DMARC fix.</p>
<p>If you're reading this in your <strong>inbox</strong> (not spam), we're good to go.</p>
<p>Check the email headers for:</p>
<ul>
<li>SPF: PASS</li>
<li>DKIM: PASS</li>
<li>DMARC: PASS</li>
</ul>
<p>Cheers,<br>Jarek<br><span style="color:#999;font-size:13px;">LayerOps · <a href="https://layerops.tech" style="color:#2B6777;">layerops.tech</a></span></p>
</body></html>`,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`Failed (${resp.status}): ${err}`);
    process.exit(1);
  }

  const data = await resp.json();
  console.log(`Sent! ID: ${data.id}`);
  console.log(`\nCheck jarekpiot@gmail.com — inbox or spam?`);
  console.log(`In Gmail: open the email → "Show original" to see SPF/DKIM/DMARC results.`);
}

main().catch(err => { console.error(err); process.exit(1); });
