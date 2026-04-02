#!/usr/bin/env node

// Generates industry-tailored outreach emails for all leads from audit results
// Now uses vertical-specific templates for different industries
// Usage: node tools/generate-outreach-html.js [path-to-audit-results.json]

const fs = require('fs');
const path = require('path');
const { generateOutreachEmail } = require('./verticals');

const resultsPath = process.argv[2] || path.join(__dirname, 'audit-results.json');
const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

const leads = results
  .filter((r) => r.status === 'success' && r.result && r.result.overall_score < 70)
  .sort((a, b) => a.result.overall_score - b.result.overall_score);

if (leads.length === 0) {
  console.log('No leads scoring below 70.');
  process.exit(0);
}

console.log(`Generating HTML emails for ${leads.length} leads...\n`);

function scoreColor(s) {
  if (s >= 80) return '#34C759';
  if (s >= 60) return '#D4A853';
  return '#E6533C';
}

function generateEmail(lead) {
  const r = lead.result;
  const name = lead.name;
  const url = lead.url;
  const hostname = new URL(url).hostname;
  const score = r.overall_score;
  const fixes = (r.top_fixes || []).slice(0, 3);
  const totalFixes = (r.top_fixes || []).length;
  const remaining = totalFixes - 3;

  const fixRows = fixes.map((f) => `
      <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:16px;">
        <div style="background:${f.impact === 'high' ? '#E6533C' : f.impact === 'medium' ? '#D4A853' : '#34C759'};color:white;border-radius:50%;min-width:28px;height:28px;text-align:center;line-height:28px;font-size:13px;font-weight:700;">${f.impact === 'high' ? '!' : '~'}</div>
        <div>
          <div style="font-weight:600;color:#2A2A2A;font-size:14px;margin-bottom:2px;">${f.title}</div>
          <div style="color:#5C5C5C;font-size:13px;line-height:1.6;">${f.description || ''}</div>
        </div>
      </div>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Outreach — ${name}</title></head>
<body style="margin:0;padding:0;background:#f5f1eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">

  <div style="text-align:center;padding:20px 0 24px;">
    <div style="display:inline-block;background:linear-gradient(135deg,#2B6777,#3d8a9c);color:white;padding:8px 20px;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:0.5px;">LAYEROPS</div>
  </div>

  <div style="background:white;border-radius:16px;padding:40px 32px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

    <p style="color:#3D3D3D;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi,</p>

    <p style="color:#3D3D3D;font-size:15px;line-height:1.7;margin:0 0 16px;">I'm Jarek Piotrowski, a Canberra-based web consultant. I came across <strong>${hostname}</strong> and ran a quick health check on your website.</p>

    <p style="color:#3D3D3D;font-size:15px;line-height:1.7;margin:0 0 8px;">I found <strong>${totalFixes} issues</strong> — here are the 3 most important:</p>

    <div style="text-align:center;margin:20px 0 28px;">
      <div style="display:inline-block;background:${score < 50 ? '#FFF0EE' : '#FFF8F0'};border:2px solid ${scoreColor(score)};border-radius:12px;padding:16px 32px;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#5C5C5C;margin-bottom:4px;">Your website health score</div>
        <div style="font-size:42px;font-weight:700;color:${scoreColor(score)};">${score}<span style="font-size:18px;color:#5C5C5C;">/100</span></div>
      </div>
    </div>

    <div style="margin:0 0 12px;">
${fixRows}
    </div>

    ${remaining > 0 ? `<p style="color:#5C5C5C;font-size:13px;margin:0 0 24px;">+ ${remaining} more issues in the full report</p>` : ''}

    <div style="border-top:1px solid #F5EDE0;margin:24px 0;"></div>

    <p style="color:#3D3D3D;font-size:15px;line-height:1.7;margin:0 0 20px;">These are all fixable. I'd be happy to walk through the full report on a quick call — no obligation.</p>

    <div style="text-align:center;margin:0 0 24px;">
      <a href="https://cal.com/jarek-piotrowski-jay-j5oa4i/15min" style="display:inline-block;background:#2B6777;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">Book a Free 15-Min Chat →</a>
    </div>

    <p style="color:#5C5C5C;font-size:13px;line-height:1.6;margin:0;">Or just reply to this email — I read every one.</p>
  </div>

  <div style="text-align:center;padding:24px 0;color:#5C5C5C;font-size:13px;line-height:1.6;">
    <p style="margin:0 0 4px;"><strong>Jarek Piotrowski</strong></p>
    <p style="margin:0 0 4px;">LayerOps — AI automation for local businesses</p>
    <p style="margin:0 0 4px;">
      <a href="https://layerops.tech" style="color:#2B6777;text-decoration:none;">layerops.tech</a> ·
      <a href="tel:0404003240" style="color:#2B6777;text-decoration:none;">0404 003 240</a> ·
      <a href="mailto:jarek@layerops.tech" style="color:#2B6777;text-decoration:none;">jarek@layerops.tech</a>
    </p>
    <p style="margin:12px 0 0;font-size:11px;color:#999;">You're receiving this because I audited your public website. No further emails will be sent unless you reply.</p>
  </div>

</div>
</body>
</html>`;
}

// Generate all emails
const outputDir = path.join(__dirname, 'outreach-html');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

// Also generate an index page to preview all emails
let index = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Outreach Emails Preview</title>
<style>
  body{font-family:-apple-system,sans-serif;background:#f5f1eb;padding:32px;color:#3D3D3D;}
  .container{max-width:700px;margin:0 auto;}
  h1{color:#2B6777;font-size:20px;margin-bottom:24px;}
  .lead{background:white;border-radius:12px;padding:20px 24px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;}
  .lead-info h3{margin:0 0 4px;font-size:15px;}
  .lead-info p{margin:0;color:#5C5C5C;font-size:13px;}
  .lead-score{font-size:28px;font-weight:700;}
  a.btn{display:inline-block;background:#2B6777;color:white;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;}
</style></head><body><div class="container">
<h1>Outreach Emails — ${leads.length} Leads</h1>\n`;

for (const lead of leads) {
  const hostname = new URL(lead.url).hostname;
  const slug = hostname.replace(/\./g, '-');
  const filename = `outreach-${slug}.html`;
  const score = lead.result.overall_score;

  // Write email HTML
  const html = generateEmail(lead);
  fs.writeFileSync(path.join(outputDir, filename), html);

  // Add to index
  index += `<div class="lead">
  <div class="lead-info">
    <h3>${lead.name}</h3>
    <p>${lead.url}</p>
  </div>
  <div style="display:flex;align-items:center;gap:16px;">
    <div class="lead-score" style="color:${scoreColor(score)};">${score}</div>
    <a class="btn" href="${filename}" target="_blank">View Email</a>
  </div>
</div>\n`;

  console.log(`✅ ${lead.name} (${score}/100) → ${filename}`);
}

index += '</div></body></html>';
fs.writeFileSync(path.join(outputDir, 'index.html'), index);

console.log(`\n📄 All emails saved to tools/outreach-html/`);
console.log(`📄 Open tools/outreach-html/index.html to preview all emails\n`);
