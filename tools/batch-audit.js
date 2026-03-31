#!/usr/bin/env node

// LayerOps Batch SEO Audit Tool
// Audits multiple Canberra business websites and generates outreach emails.
// Usage: node tools/batch-audit.js [path-to-targets.json]

const fs = require('fs');
const path = require('path');

const AUDIT_ENDPOINT = 'https://audit.layerops.tech';
const DELAY_MS = 5000; // 5 seconds between requests

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadTargets(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');

  // Support both JSON array and CSV
  if (filePath.endsWith('.csv')) {
    const lines = raw.trim().split('\n');
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const nameIdx = header.indexOf('name');
    const urlIdx = header.indexOf('url');
    const industryIdx = header.indexOf('industry');

    if (urlIdx === -1) {
      throw new Error('CSV must have a "url" column');
    }

    return lines.slice(1).map((line) => {
      const cols = line.split(',').map((c) => c.trim());
      return {
        name: nameIdx >= 0 ? cols[nameIdx] : cols[urlIdx],
        url: cols[urlIdx],
        industry: industryIdx >= 0 ? cols[industryIdx] : 'unknown',
      };
    });
  }

  // JSON — accept array or { targets: [...] }
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : parsed.targets;
}

async function auditUrl(url) {
  const resp = await fetch(AUDIT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(data.error || data.detail || `HTTP ${resp.status}`);
  }

  return data;
}

// ─── Outreach email markdown generation ─────────────────────────────────────

function buildOutreachMarkdown(results) {
  // Filter to businesses scoring below 70, sort worst first
  const leads = results
    .filter((r) => r.result && r.result.overall_score < 70)
    .sort((a, b) => a.result.overall_score - b.result.overall_score);

  if (leads.length === 0) {
    return '# Outreach Emails\n\nNo businesses scored below 70 — no outreach emails generated.\n';
  }

  let md = '# LayerOps SEO Outreach Emails\n\n';
  md += `Generated: ${new Date().toISOString().split('T')[0]}\n\n`;
  md += `**${leads.length} businesses** scored below 70 and are included below (sorted worst-first).\n\n`;
  md += '---\n\n';

  for (const entry of leads) {
    const r = entry.result;
    const topIssues = (r.top_fixes || []).slice(0, 3);

    md += `## ${entry.name}\n\n`;
    md += `- **URL:** ${entry.url}\n`;
    md += `- **Industry:** ${entry.industry}\n`;
    md += `- **Overall Score:** ${r.overall_score}/100\n`;
    md += `- **Audit Date:** ${r.audit_date}\n\n`;

    if (topIssues.length > 0) {
      md += '### Top Issues\n\n';
      for (const issue of topIssues) {
        md += `${issue.priority}. **${issue.title}** (${issue.impact} impact) — ${issue.description}\n`;
      }
      md += '\n';
    }

    if (r.email_draft) {
      md += '### Draft Outreach Email\n\n';
      md += '```\n';
      md += r.email_draft;
      md += '\n```\n\n';
    }

    md += '---\n\n';
  }

  return md;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const targetsPath = process.argv[2] || path.join(__dirname, 'targets.json');
  const outputDir = path.dirname(targetsPath);

  console.log(`\nLayerOps Batch SEO Audit`);
  console.log(`========================\n`);

  // Load targets
  let targets;
  try {
    targets = loadTargets(targetsPath);
    console.log(`Loaded ${targets.length} targets from ${targetsPath}\n`);
  } catch (err) {
    console.error(`Failed to load targets: ${err.message}`);
    process.exit(1);
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const num = i + 1;
    process.stdout.write(`Auditing ${num}/${targets.length}: ${target.name}... `);

    try {
      const result = await auditUrl(target.url);
      results.push({
        name: target.name,
        url: target.url,
        industry: target.industry,
        status: 'success',
        result,
      });
      console.log(`Score: ${result.overall_score}/100`);
      successCount++;
    } catch (err) {
      results.push({
        name: target.name,
        url: target.url,
        industry: target.industry,
        status: 'error',
        error: err.message,
        result: null,
      });
      console.log(`FAILED — ${err.message}`);
      failCount++;
    }

    // Delay between requests (skip after last one)
    if (i < targets.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // ─── Save results JSON ──────────────────────────────────────────────────

  const resultsPath = path.join(outputDir, 'audit-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${resultsPath}`);

  // ─── Generate outreach emails markdown ──────────────────────────────────

  const outreachPath = path.join(outputDir, 'outreach-emails.md');
  const outreachMd = buildOutreachMarkdown(results);
  fs.writeFileSync(outreachPath, outreachMd);
  console.log(`Outreach emails saved to ${outreachPath}`);

  // ─── Summary stats ──────────────────────────────────────────────────────

  const successful = results.filter((r) => r.status === 'success');
  const scores = successful.map((r) => r.result.overall_score);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const below70 = scores.filter((s) => s < 70).length;
  const below50 = scores.filter((s) => s < 50).length;

  console.log(`\n========== SUMMARY ==========`);
  console.log(`Total businesses audited:  ${successCount} of ${targets.length} (${failCount} failed)`);
  console.log(`Average score:             ${avgScore}/100`);
  console.log(`Scoring below 70 (leads):  ${below70}`);
  console.log(`Scoring below 50 (critical): ${below50}`);
  console.log(`==============================\n`);
}

main().catch((err) => {
  console.error(`\nFatal error: ${err.message}`);
  process.exit(1);
});
