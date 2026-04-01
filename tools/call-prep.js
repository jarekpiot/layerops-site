#!/usr/bin/env node

// LayerOps Call Prep Sheet Generator
// Generates a one-page briefing for a sales call based on audit results.
//
// Usage:
//   node tools/call-prep.js "https://gardengigs.net.au"
//   node tools/call-prep.js "https://gardengigs.net.au" --html

const fs = require('fs');
const path = require('path');

const AUDIT_ENDPOINT = 'https://audit.layerops.tech';

async function runAudit(url, mode = 'audit') {
  const resp = await fetch(AUDIT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, mode }),
  });
  if (!resp.ok) throw new Error(`Audit failed: HTTP ${resp.status}`);
  return resp.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function scoreColor(score) {
  if (score >= 80) return '#34C759';
  if (score >= 60) return '#D4A853';
  return '#E6533C';
}

function scoreLabel(score) {
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Needs work';
  return 'Poor';
}

function recommendPath(score) {
  if (score < 50) return { tier: 'New Site + Chatbot', price: '$499-999', reason: 'Site has deep structural issues — easier to rebuild than fix' };
  if (score < 70) return { tier: 'SEO Fixes + Chatbot Embed', price: '$299 + $199/month', reason: 'Site is salvageable — fix the SEO issues, embed the chatbot' };
  return { tier: 'Chatbot Embed Only', price: '$199/month', reason: 'Site is solid — just add the chatbot for 24/7 customer engagement' };
}

const CAT_NAMES = {
  technical_seo: 'Google Basics',
  on_page_seo: 'Search Results',
  content: 'Content',
  mobile: 'Mobile',
  social_sharing: 'Social Sharing',
  accessibility: 'Ease of Use',
  navigation_structure: 'Navigation',
  trust_conversion: 'Trust & Conversion',
  performance: 'Speed',
  design: 'Design',
};

async function main() {
  const args = process.argv.slice(2);
  let url = args.find((a) => !a.startsWith('--'));
  const htmlMode = args.includes('--html');

  if (!url) {
    console.log('\nUsage: node tools/call-prep.js "https://example.com" [--html]\n');
    process.exit(0);
  }

  if (!url.startsWith('http')) url = 'https://' + url;
  const hostname = new URL(url).hostname;

  console.log(`\nPreparing call sheet for ${hostname}...\n`);

  // Run both audit and copy review in sequence
  console.log('Running website audit...');
  const audit = await runAudit(url, 'audit');
  console.log(`Score: ${audit.overall_score}/100`);

  await sleep(2000);

  console.log('Running copy review...');
  const copy = await runAudit(url, 'copy');
  console.log(`Copy score: ${copy.overall_score}/100`);

  const rec = recommendPath(audit.overall_score);

  if (htmlMode) {
    const html = generateHTML(url, hostname, audit, copy, rec);
    const outFile = path.join(__dirname, `call-prep-${hostname.replace(/\./g, '-')}.html`);
    fs.writeFileSync(outFile, html);
    console.log(`\nCall prep sheet saved to ${outFile}`);
    try { require('child_process').execSync(`start ${outFile}`); } catch {}
  } else {
    printConsole(url, hostname, audit, copy, rec);
  }
}

function printConsole(url, hostname, audit, copy, rec) {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  CALL PREP SHEET — ${hostname.padEnd(40)}║
╠══════════════════════════════════════════════════════════════╣
║  Website:  ${url.padEnd(49)}║
║  Score:    ${(audit.overall_score + '/100 — ' + scoreLabel(audit.overall_score)).padEnd(49)}║
║  Copy:     ${(copy.overall_score + '/100 — ' + scoreLabel(copy.overall_score)).padEnd(49)}║
╠══════════════════════════════════════════════════════════════╣
║  RECOMMENDED PITCH                                          ║
║  ${rec.tier.padEnd(58)}║
║  Price: ${rec.price.padEnd(52)}║
║  Why: ${rec.reason.substring(0, 54).padEnd(54)}║
╚══════════════════════════════════════════════════════════════╝
`);

  console.log('CATEGORY SCORES:');
  Object.entries(audit.categories || {}).forEach(([k, v]) => {
    const name = (CAT_NAMES[k] || k).padEnd(20);
    const bar = '█'.repeat(Math.round(v.score / 5)) + '░'.repeat(20 - Math.round(v.score / 5));
    console.log(`  ${name} ${bar} ${v.score}/100`);
  });

  console.log('\nTOP ISSUES TO MENTION ON THE CALL:');
  (audit.top_fixes || []).forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.title}`);
    if (f.description) console.log(`     → ${f.description.substring(0, 100)}`);
  });

  console.log('\nCOPY PROBLEMS:');
  (copy.flagged_copy || []).forEach((f) => {
    console.log(`  [${f.severity}] "${f.text}"`);
    console.log(`     → ${f.suggestion}`);
  });

  console.log('\nTALKING POINTS:');
  console.log(`  - Their site scores ${audit.overall_score}/100 — ${audit.overall_score < 70 ? "below average for their industry" : "decent but room to improve"}`);
  console.log(`  - ${(audit.top_fixes || [])[0]?.title || 'Multiple issues found'} is the biggest quick win`);
  console.log(`  - Copy score is ${copy.overall_score}/100 — ${copy.overall_score < 70 ? "messaging needs work" : "messaging is reasonable"}`);
  console.log(`  - Recommend: ${rec.tier} at ${rec.price}`);
  if (audit.overall_score >= 50) {
    console.log(`  - Chatbot embed: "Your site is good — let's add a chatbot that handles enquiries 24/7"`);
    console.log(`  - Embed code: <script src="https://{slug}.layerops.tech/widget/{slug}"></script>`);
  }
  console.log(`  - Show them the demo: https://demo.layerops.tech`);
  console.log(`  - Run a live audit on the call to demonstrate value`);
  console.log('');
}

function generateHTML(url, hostname, audit, copy, rec) {
  const catRows = Object.entries(audit.categories || {})
    .map(([k, v]) => {
      const name = CAT_NAMES[k] || k;
      const color = scoreColor(v.score);
      const width = v.score;
      return `<tr>
        <td style="padding:8px 12px;font-size:13px;color:#3D3D3D;">${name}</td>
        <td style="padding:8px 12px;width:200px;">
          <div style="background:#F5EDE0;border-radius:4px;height:8px;overflow:hidden;">
            <div style="background:${color};height:100%;width:${width}%;border-radius:4px;"></div>
          </div>
        </td>
        <td style="padding:8px 12px;font-weight:600;color:${color};font-size:13px;text-align:right;">${v.score}</td>
      </tr>`;
    }).join('');

  const fixRows = (audit.top_fixes || []).map((f, i) => `
    <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:12px;">
      <div style="background:${f.impact === 'high' ? '#E6533C' : f.impact === 'medium' ? '#D4A853' : '#34C759'};color:white;border-radius:50%;min-width:24px;height:24px;text-align:center;line-height:24px;font-size:12px;font-weight:700;">${i + 1}</div>
      <div>
        <div style="font-weight:600;color:#2A2A2A;font-size:13px;">${f.title}</div>
        <div style="color:#5C5C5C;font-size:12px;line-height:1.5;margin-top:2px;">${f.description || ''}</div>
      </div>
    </div>`).join('');

  const copyFlags = (copy.flagged_copy || []).map((f) => `
    <div style="background:${f.severity === 'high' ? '#FFF0EE' : '#FFF8F0'};border-radius:8px;padding:10px 14px;margin-bottom:8px;">
      <div style="font-size:12px;font-weight:600;color:${f.severity === 'high' ? '#E6533C' : '#D4A853'};text-transform:uppercase;margin-bottom:2px;">${f.severity} — ${f.problem}</div>
      <div style="font-size:13px;color:#3D3D3D;">"${f.text}"</div>
      <div style="font-size:12px;color:#5C5C5C;margin-top:4px;">→ ${f.suggestion}</div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Call Prep — ${hostname}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f5f1eb; padding:24px; color:#3D3D3D; }
    .sheet { max-width:800px; margin:0 auto; }
    .header { background:linear-gradient(135deg,#2B6777,#3d8a9c); color:white; border-radius:16px 16px 0 0; padding:32px; }
    .header h1 { font-size:20px; margin-bottom:4px; }
    .header p { opacity:0.8; font-size:14px; }
    .scores { display:flex; gap:16px; margin-top:20px; }
    .score-box { background:rgba(255,255,255,0.15); border-radius:10px; padding:16px 24px; text-align:center; }
    .score-num { font-size:36px; font-weight:700; }
    .score-label { font-size:11px; text-transform:uppercase; letter-spacing:1px; opacity:0.8; }
    .rec { background:#1e4a56; border-radius:10px; padding:16px 20px; margin-top:16px; }
    .rec-title { font-size:13px; font-weight:600; color:#D4A853; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
    .rec-pitch { font-size:16px; font-weight:600; }
    .rec-price { font-size:14px; opacity:0.8; margin-top:2px; }
    .card { background:white; padding:28px 32px; border-bottom:1px solid #F5EDE0; }
    .card:last-child { border-radius:0 0 16px 16px; border-bottom:none; }
    .card h2 { font-size:15px; color:#2B6777; margin-bottom:16px; text-transform:uppercase; letter-spacing:0.5px; }
    table { width:100%; border-collapse:collapse; }
    .talking { background:#FDFAF5; }
    .talking li { padding:6px 0; font-size:14px; line-height:1.6; }
    .talking li strong { color:#2B6777; }
    @media print { body { padding:0; background:white; } .sheet { max-width:100%; } }
  </style>
</head>
<body>
  <div class="sheet">

    <div class="header">
      <h1>${hostname}</h1>
      <p>${url} · Prepared ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <div class="scores">
        <div class="score-box">
          <div class="score-num">${audit.overall_score}</div>
          <div class="score-label">Website Score</div>
        </div>
        <div class="score-box">
          <div class="score-num">${copy.overall_score}</div>
          <div class="score-label">Copy Score</div>
        </div>
      </div>
      <div class="rec">
        <div class="rec-title">Recommended Pitch</div>
        <div class="rec-pitch">${rec.tier}</div>
        <div class="rec-price">${rec.price} · ${rec.reason}</div>
      </div>
    </div>

    <div class="card">
      <h2>Category Breakdown</h2>
      <table>${catRows}</table>
    </div>

    <div class="card">
      <h2>Issues to Discuss (${(audit.top_fixes || []).length} found)</h2>
      ${fixRows}
    </div>

    ${copyFlags ? `<div class="card">
      <h2>Copy Problems</h2>
      ${copyFlags}
    </div>` : ''}

    <div class="card talking">
      <h2>Talking Points</h2>
      <ul style="padding-left:20px;">
        <li>Their site scores <strong>${audit.overall_score}/100</strong> — ${audit.overall_score < 70 ? 'below average, real opportunity to help' : 'decent but clear room to improve'}</li>
        <li><strong>${(audit.top_fixes || [])[0]?.title || 'Multiple issues'}</strong> is the biggest quick win</li>
        <li>Copy scores <strong>${copy.overall_score}/100</strong> — ${copy.overall_score < 70 ? 'messaging needs tightening' : 'messaging is reasonable'}</li>
        <li>Recommended: <strong>${rec.tier}</strong> at <strong>${rec.price}</strong></li>
        ${audit.overall_score >= 50 ? '<li>"Your site is good — let\'s add a chatbot that handles enquiries while you\'re on the tools"</li>' : '<li>"Your site needs structural work — let me build you something that actually converts"</li>'}
        <li>Show them the demo: <strong>demo.layerops.tech</strong></li>
        <li>Run a live audit on the call to demonstrate value</li>
        <li>Embed code: <code>&lt;script src="https://{slug}.layerops.tech/widget/{slug}"&gt;&lt;/script&gt;</code></li>
      </ul>
    </div>

  </div>
</body>
</html>`;
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
