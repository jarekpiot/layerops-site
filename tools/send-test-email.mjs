// Test send — verifies the new signature renders correctly AND the Resend
// webhook flow lands open/click events at audit.layerops.tech.
//
// Usage:
//   RESEND_API_KEY=... node tools/send-test-email.js
//   RESEND_API_KEY=... node tools/send-test-email.js --to other@example.com
//
// After sending, the message ID is printed. To verify the webhook flow:
//   1. Open the email in your inbox
//   2. Click the link in the body (to test click tracking)
//   3. Tell Claude — we'll then check audit.layerops.tech / CRM KV for the
//      delivered/opened/clicked events tied to this message ID

import { signatureHtml, signatureText } from './email-signature.mjs';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) { console.error('Missing RESEND_API_KEY'); process.exit(1); }

const toIdx = process.argv.indexOf('--to');
const TO = toIdx >= 0 ? process.argv[toIdx + 1] : 'jarekpiot@gmail.com';

const now = new Date();
const stamp = now.toISOString().slice(0, 19).replace('T', ' ');

const bodyText = `Hey Jarek,

This is a test email from the LayerOps outbound stack — sent at ${stamp} UTC.

It exists for two reasons:

1. To verify the new HTML email signature renders cleanly across mail clients (this email and the Veurr one had bare-text signatures that looked unprofessional).

2. To test the Resend webhook flow end-to-end. Open this email, then click the link below — that should trigger email.opened and email.clicked events that land at audit.layerops.tech/webhooks/resend and write to the CRM KV namespace.

Click this link to test click tracking: https://layerops.tech/

If both events make it to the audit worker, the outbound email pipeline is fully observable going forward — every send to a customer or prospect can be tracked from delivery → open → click without any extra work per send.

If neither event arrives, check:
  - Resend dashboard → Domains → layerops.tech → Open Tracking + Click Tracking are ON
  - Resend dashboard → Webhooks → endpoint https://audit.layerops.tech/webhooks/resend is registered
  - Subscribed events include email.delivered, email.opened, email.clicked

Cheers,`;

const bodyHtml = `
<div style="font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;max-width:640px;color:#374151;line-height:1.55;font-size:15px">
  <p>Hey Jarek,</p>
  <p>This is a test email from the LayerOps outbound stack &mdash; sent at <strong>${stamp} UTC</strong>.</p>
  <p>It exists for two reasons:</p>
  <ol>
    <li>To verify the new HTML email signature renders cleanly across mail clients (this email and the V&eacute;urr one had bare-text signatures that looked unprofessional).</li>
    <li>To test the Resend webhook flow end-to-end. Open this email, then click the link below &mdash; that should trigger <code>email.opened</code> and <code>email.clicked</code> events that land at <code>audit.layerops.tech/webhooks/resend</code> and write to the CRM KV namespace.</li>
  </ol>
  <p style="margin:24px 0;text-align:center">
    <a href="https://layerops.tech/" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">Click to test click tracking</a>
  </p>
  <p>If both events make it to the audit worker, the outbound email pipeline is fully observable going forward &mdash; every send to a customer or prospect can be tracked from delivery &rarr; open &rarr; click without any extra work per send.</p>
  <p style="color:#6b7280;font-size:13px">If neither event arrives, check:</p>
  <ul style="color:#6b7280;font-size:13px">
    <li>Resend dashboard &rarr; Domains &rarr; layerops.tech &rarr; Open Tracking + Click Tracking are ON</li>
    <li>Resend dashboard &rarr; Webhooks &rarr; endpoint <code>https://audit.layerops.tech/webhooks/resend</code> is registered</li>
    <li>Subscribed events include <code>email.delivered</code>, <code>email.opened</code>, <code>email.clicked</code></li>
  </ul>
  <p>Cheers,</p>
</div>
${signatureHtml}
`;

(async () => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Jarek Piotrowski <jarek@layerops.tech>',
      to: [TO],
      reply_to: 'jarek@layerops.tech',
      subject: `LayerOps signature + webhook test (${stamp})`,
      text: bodyText + '\n\n' + signatureText,
      html: bodyHtml,
      tags: [
        { name: 'category', value: 'test' },
        { name: 'purpose', value: 'signature-and-webhook-test' },
      ],
    }),
  });
  const body = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', body);
  if (!res.ok) process.exit(2);
  try {
    const parsed = JSON.parse(body);
    console.log('');
    console.log('✅ Sent. Resend message ID:', parsed.id);
    console.log('   To:', TO);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Open your inbox and check the signature renders correctly');
    console.log('  2. Click the blue button in the email body');
    console.log('  3. Tell Claude — we\'ll verify the webhook events landed');
  } catch {}
})();
