// LayerOps — reusable email signature
//
// Single source of truth for outbound email signatures so every send-*.js
// script renders Jarek's contact info the same way. No logo asset, no ABN
// (Jarek doesn't have one yet — add later if/when registered).
//
// Usage:
//   import { signatureHtml, signatureText } from './email-signature.js';
//   ...
//   const html = bodyHtml + signatureHtml;
//   const text = bodyText + signatureText;

const PHONE_DISPLAY = '0404 003 240';
const PHONE_TEL     = '+61404003240';
const KESTREL_DEMO  = '(02) 5941 6608';
const KESTREL_TEL   = '+61259416608';
const EMAIL         = 'jarek@layerops.tech';
const WEBSITE       = 'https://layerops.tech';
const WEBSITE_TEXT  = 'layerops.tech';
const NAME          = 'Jarek Piotrowski';
const TITLE         = 'Founder, LayerOps';
const LOCATION      = 'Canberra, Australia';

export const signatureHtml = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#374151;border-top:1px solid #e5e7eb;padding-top:16px">
  <tr>
    <td>
      <div style="font-weight:600;color:#111827;font-size:15px">${NAME}</div>
      <div style="color:#6b7280;font-size:13px;margin-bottom:8px">${TITLE} &middot; ${LOCATION}</div>
      <div style="margin-top:6px">
        <a href="mailto:${EMAIL}" style="color:#2563eb;text-decoration:none">${EMAIL}</a>
        &nbsp;&middot;&nbsp;
        <a href="${WEBSITE}" style="color:#2563eb;text-decoration:none">${WEBSITE_TEXT}</a>
        &nbsp;&middot;&nbsp;
        <a href="tel:${PHONE_TEL}" style="color:#2563eb;text-decoration:none">${PHONE_DISPLAY}</a>
      </div>
      <div style="margin-top:14px;padding:10px 14px;background:#f9fafb;border-left:3px solid #2563eb;border-radius:3px;font-size:13px;color:#4b5563">
        <strong style="color:#111827">Want to hear what an AI receptionist sounds like?</strong><br>
        Call our demo line: <a href="tel:${KESTREL_TEL}" style="color:#2563eb;text-decoration:none;font-weight:600">${KESTREL_DEMO}</a>
      </div>
    </td>
  </tr>
</table>
`.trim();

export const signatureText = `
--
${NAME}
${TITLE} · ${LOCATION}
${EMAIL} · ${WEBSITE_TEXT} · ${PHONE_DISPLAY}

Want to hear what an AI receptionist sounds like? Call our demo line: ${KESTREL_DEMO}
`.trim();
