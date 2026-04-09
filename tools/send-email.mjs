// LayerOps — generic outbound email sender
//
// Reusable command-line tool for sending one-off emails through Resend with
// the standard LayerOps signature applied automatically. Body is read from a
// markdown file so you can write naturally and review before sending.
//
// Usage:
//   RESEND_API_KEY=... node tools/send-email.mjs \
//     --to maciej@veurr.com.au \
//     --subject "Quick follow-up on AI for Véurr" \
//     --body-file drafts/veurr-followup-2026-04-12.md
//
// Options:
//   --to <email>          REQUIRED. Primary recipient email address.
//   --cc <email>          Optional. Repeatable. CC recipient(s) — for proper Reply-All etiquette.
//   --bcc <email>         Optional. Repeatable. BCC recipient(s).
//   --subject <string>    REQUIRED. Email subject line. Quote if it has spaces.
//   --body-file <path>    REQUIRED. Path to a markdown file with the email body.
//   --reply-to <email>    Optional. Defaults to jarek@layerops.tech.
//   --from <string>       Optional. Defaults to "Jarek Piotrowski <jarek@layerops.tech>".
//   --tag k=v             Optional. Repeatable. Adds Resend tags for filtering events.
//   --dry-run             Print the rendered HTML + text without sending.
//
// The body file is plain markdown. Supported elements:
//   # H1, ## H2, ### H3 → heading tags
//   **bold** → <strong>
//   *italic* → <em>
//   [text](url) → <a>
//   - bullet → <ul><li>
//   1. ordered → <ol><li>
//   `code` → <code>
//   blank line → paragraph break
//   --- → <hr>

import fs from 'fs';
import { signatureHtml, signatureText } from './email-signature.mjs';

// ─── Argument parsing ───────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { tags: [], cc: [], bcc: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--to') opts.to = args[++i];
    else if (a === '--cc') opts.cc.push(args[++i]);
    else if (a === '--bcc') opts.bcc.push(args[++i]);
    else if (a === '--subject') opts.subject = args[++i];
    else if (a === '--body-file') opts.bodyFile = args[++i];
    else if (a === '--reply-to') opts.replyTo = args[++i];
    else if (a === '--from') opts.from = args[++i];
    else if (a === '--tag') {
      const [k, v] = (args[++i] || '').split('=');
      if (k && v) opts.tags.push({ name: k, value: v });
    }
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--help' || a === '-h') opts.help = true;
  }
  return opts;
}

function showHelpAndExit(code = 0) {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).join('\n'));
  process.exit(code);
}

// ─── Tiny markdown → HTML / plain-text helpers ──────────────────────────────
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineHtml(s) {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code style="background:#f3f4f6;padding:1px 5px;border-radius:3px;font-size:13px">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<![*])\*([^*\n]+)\*(?![*])/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#2563eb;text-decoration:underline">$1</a>');
}

function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let inUl = false, inOl = false;
  const closeLists = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      closeLists();
      const lvl = h[1].length;
      const sizes = { 1: '22px', 2: '18px', 3: '16px' };
      out.push(`<h${lvl} style="font-size:${sizes[lvl]};margin:24px 0 10px 0;color:#111827">${inlineHtml(h[2])}</h${lvl}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (line.trim() === '---') {
      closeLists();
      out.push('<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">');
      i++;
      continue;
    }

    // Unordered list
    const ul = line.match(/^[-*]\s+(.+)$/);
    if (ul) {
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inUl) { out.push('<ul style="margin:8px 0 12px 20px;padding:0">'); inUl = true; }
      out.push(`<li style="margin:4px 0;line-height:1.55">${inlineHtml(ul[1])}</li>`);
      i++;
      continue;
    }

    // Ordered list
    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (!inOl) { out.push('<ol style="margin:8px 0 12px 24px;padding:0">'); inOl = true; }
      out.push(`<li style="margin:4px 0;line-height:1.55">${inlineHtml(ol[1])}</li>`);
      i++;
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      closeLists();
      i++;
      continue;
    }

    // Paragraph — collect consecutive non-empty, non-special lines
    closeLists();
    const para = [line];
    while (
      i + 1 < lines.length &&
      lines[i + 1].trim() !== '' &&
      !lines[i + 1].match(/^(#{1,3}\s|[-*]\s|\d+\.\s|---$)/)
    ) {
      i++;
      para.push(lines[i]);
    }
    out.push(`<p style="margin:10px 0;line-height:1.55;font-size:15px;color:#374151">${inlineHtml(para.join(' '))}</p>`);
    i++;
  }
  closeLists();
  return out.join('\n');
}

function markdownToText(md) {
  // Plain-text version: strip the markdown markers but keep structure
  return md
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<![*])\*([^*\n]+)\*(?![*])/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^---$/gm, '────────')
    .trim();
}

// ─── Main ───────────────────────────────────────────────────────────────────
const opts = parseArgs();
if (opts.help) showHelpAndExit(0);
if (!opts.to || !opts.subject || !opts.bodyFile) {
  console.error('❌ Missing required arg. Need --to, --subject, --body-file');
  console.error('   Run with --help for full usage.');
  process.exit(1);
}
if (!fs.existsSync(opts.bodyFile)) {
  console.error(`❌ Body file not found: ${opts.bodyFile}`);
  process.exit(1);
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY && !opts.dryRun) {
  console.error('❌ RESEND_API_KEY not set (use --dry-run to preview without sending)');
  process.exit(1);
}

const md = fs.readFileSync(opts.bodyFile, 'utf8');
const bodyHtml = markdownToHtml(md);
const bodyText = markdownToText(md);

const html = `<div style="font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;max-width:640px;color:#374151;padding:8px">${bodyHtml}</div>${signatureHtml}`;
const text = bodyText + '\n\n' + signatureText;

const from = opts.from || 'Jarek Piotrowski <jarek@layerops.tech>';
const replyTo = opts.replyTo || 'jarek@layerops.tech';

if (opts.dryRun) {
  console.log('━━━ DRY RUN — would send ━━━');
  console.log('From:    ', from);
  console.log('To:      ', opts.to);
  if (opts.cc.length) console.log('CC:      ', opts.cc.join(', '));
  if (opts.bcc.length) console.log('BCC:     ', opts.bcc.join(', '));
  console.log('Reply-to:', replyTo);
  console.log('Subject: ', opts.subject);
  console.log('Tags:    ', opts.tags.length ? JSON.stringify(opts.tags) : '(none)');
  console.log('Body file:', opts.bodyFile, `(${md.length} chars markdown)`);
  console.log('');
  console.log('━━━ TEXT VERSION ━━━');
  console.log(text);
  console.log('');
  console.log('━━━ HTML VERSION (length: ' + html.length + ' chars) ━━━');
  console.log(html.slice(0, 800) + (html.length > 800 ? '\n... [truncated, ' + (html.length - 800) + ' more chars]' : ''));
  process.exit(0);
}

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from,
    to: [opts.to],
    ...(opts.cc.length ? { cc: opts.cc } : {}),
    ...(opts.bcc.length ? { bcc: opts.bcc } : {}),
    reply_to: replyTo,
    subject: opts.subject,
    text,
    html,
    ...(opts.tags.length ? { tags: opts.tags } : {}),
  }),
});
const respBody = await res.text();
console.log('Status:', res.status);
console.log('Body:  ', respBody);
if (!res.ok) process.exit(2);

try {
  const parsed = JSON.parse(respBody);
  console.log('');
  console.log('✅ Sent. Resend message ID:', parsed.id);
  console.log('   To:     ', opts.to);
  if (opts.cc.length) console.log('   CC:     ', opts.cc.join(', '));
  if (opts.bcc.length) console.log('   BCC:    ', opts.bcc.join(', '));
  console.log('   Subject:', opts.subject);
} catch {}
