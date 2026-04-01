#!/usr/bin/env node

// LayerOps Business Scout
// Finds local businesses via Google Places API, audits their websites,
// and generates outreach emails.
//
// Setup: set GOOGLE_PLACES_API_KEY environment variable
//   Get one at: https://console.cloud.google.com/apis/credentials
//   Enable "Places API (New)" in your Google Cloud project
//   Free tier: $200/month credit (~40,000 searches)
//
// Usage:
//   node tools/scout.js "plumber Canberra"
//   node tools/scout.js "cafe Belconnen" --limit 20
//   node tools/scout.js "dentist Woden" --audit
//   node tools/scout.js "electrician Canberra" --audit --outreach

const fs = require('fs');
const path = require('path');

const PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const AUDIT_ENDPOINT = 'https://audit.layerops.tech';
const DELAY_MS = 5000;

// ─── Google Places API ───────────────────────────────────────────────────────

async function searchPlaces(apiKey, query, limit = 10) {
  const resp = await fetch(PLACES_TEXT_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.websiteUri,places.formattedAddress,places.nationalPhoneNumber,places.googleMapsUri,places.rating,places.userRatingCount,places.types',
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: Math.min(limit, 20),
      languageCode: 'en-AU',
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google Places API error (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  return (data.places || []).map((p) => ({
    name: p.displayName?.text || 'Unknown',
    url: p.websiteUri || null,
    address: p.formattedAddress || null,
    phone: p.nationalPhoneNumber || null,
    maps_url: p.googleMapsUri || null,
    rating: p.rating || null,
    review_count: p.userRatingCount || 0,
    types: (p.types || []).slice(0, 3),
  }));
}

// ─── Audit a single URL ──────────────────────────────────────────────────────

async function auditUrl(url) {
  const resp = await fetch(AUDIT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const query = args.find((a) => !a.startsWith('--'));
  const limit = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '10');
  const doAudit = args.includes('--audit');
  const doOutreach = args.includes('--outreach');
  const outputDir = path.join(__dirname);

  if (!query) {
    console.log(`
LayerOps Business Scout
═══════════════════════

Usage:
  node tools/scout.js "plumber Canberra"
  node tools/scout.js "cafe Belconnen" --limit=20
  node tools/scout.js "dentist Woden" --audit
  node tools/scout.js "electrician Canberra" --audit --outreach

Options:
  --limit=N     Max results (default 10, max 20)
  --audit       Run website audit on each business
  --outreach    Generate outreach emails (requires --audit)

Setup:
  Set GOOGLE_PLACES_API_KEY environment variable
  Get one at: https://console.cloud.google.com/apis/credentials
`);
    process.exit(0);
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('\n❌ GOOGLE_PLACES_API_KEY not set.');
    console.error('Get one at: https://console.cloud.google.com/apis/credentials');
    console.error('Then: set GOOGLE_PLACES_API_KEY=your_key_here\n');
    process.exit(1);
  }

  console.log(`\n🔍 LayerOps Business Scout`);
  console.log(`══════════════════════════\n`);
  console.log(`Query: "${query}"`);
  console.log(`Limit: ${limit}`);
  console.log(`Audit: ${doAudit ? 'Yes' : 'No'}`);
  console.log(`Outreach: ${doOutreach ? 'Yes' : 'No'}\n`);

  // 1. Find businesses
  console.log('Searching Google Places...');
  let businesses;
  try {
    businesses = await searchPlaces(apiKey, query, limit);
  } catch (err) {
    console.error(`❌ Search failed: ${err.message}`);
    process.exit(1);
  }

  console.log(`Found ${businesses.length} businesses\n`);

  // Filter to ones with websites
  const withWebsite = businesses.filter((b) => b.url);
  const withoutWebsite = businesses.filter((b) => !b.url);

  if (withoutWebsite.length > 0) {
    console.log(`⚠️  ${withoutWebsite.length} businesses have no website:`);
    withoutWebsite.forEach((b) => console.log(`   - ${b.name} (${b.phone || 'no phone'})`));
    console.log(`   → These are potential clients who need a website!\n`);
  }

  console.log(`${withWebsite.length} businesses with websites:\n`);
  withWebsite.forEach((b, i) => {
    console.log(`${i + 1}. ${b.name}`);
    console.log(`   ${b.url}`);
    console.log(`   ${b.address || ''}`);
    if (b.phone) console.log(`   📞 ${b.phone}`);
    if (b.rating) console.log(`   ⭐ ${b.rating}/5 (${b.review_count} reviews)`);
    console.log();
  });

  // Save as targets.json
  const industry = query.split(' ')[0] || 'unknown';
  const targets = withWebsite.map((b) => ({
    name: b.name,
    url: b.url,
    industry,
    phone: b.phone,
    address: b.address,
    rating: b.rating,
    review_count: b.review_count,
  }));

  const targetsFile = path.join(outputDir, `scout-${industry.toLowerCase()}-targets.json`);
  fs.writeFileSync(targetsFile, JSON.stringify(targets, null, 2));
  console.log(`📄 Targets saved to ${targetsFile}\n`);

  // Also save the no-website businesses as potential leads
  if (withoutWebsite.length > 0) {
    const noWebLeads = withoutWebsite.map((b) => ({
      name: b.name,
      phone: b.phone,
      address: b.address,
      rating: b.rating,
      review_count: b.review_count,
      maps_url: b.maps_url,
      opportunity: 'No website — needs one built',
    }));
    const noWebFile = path.join(outputDir, `scout-${industry.toLowerCase()}-no-website.json`);
    fs.writeFileSync(noWebFile, JSON.stringify(noWebLeads, null, 2));
    console.log(`📄 No-website leads saved to ${noWebFile}`);
    console.log(`   These businesses need a website — pitch AI Landing Pages ($1,500+)\n`);
  }

  // 2. Run audits (if requested)
  if (!doAudit) {
    console.log('Run again with --audit to audit these websites.\n');
    return;
  }

  console.log(`\n🔍 Auditing ${withWebsite.length} websites...\n`);

  const results = [];
  for (let i = 0; i < withWebsite.length; i++) {
    const biz = withWebsite[i];
    process.stdout.write(`${i + 1}/${withWebsite.length} ${biz.name}... `);

    try {
      const audit = await auditUrl(biz.url);
      results.push({
        ...biz,
        status: 'success',
        overall_score: audit.overall_score,
        categories: audit.categories,
        top_fixes: audit.top_fixes,
        summary: audit.summary,
        email_draft: audit.email_draft,
      });
      console.log(`Score: ${audit.overall_score}/100`);
    } catch (err) {
      results.push({ ...biz, status: 'error', error: err.message });
      console.log(`FAILED — ${err.message}`);
    }

    if (i < withWebsite.length - 1) await sleep(DELAY_MS);
  }

  // Save results
  const resultsFile = path.join(outputDir, `scout-${industry.toLowerCase()}-results.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n📄 Audit results saved to ${resultsFile}`);

  // 3. Summary
  const successful = results.filter((r) => r.status === 'success');
  const scores = successful.map((r) => r.overall_score);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const below70 = successful.filter((r) => r.overall_score < 70);
  const below50 = successful.filter((r) => r.overall_score < 50);

  console.log(`\n══════════ SUMMARY ══════════`);
  console.log(`Businesses found:     ${businesses.length}`);
  console.log(`With website:         ${withWebsite.length}`);
  console.log(`Without website:      ${withoutWebsite.length} (need a site built!)`);
  console.log(`Audited:              ${successful.length}`);
  console.log(`Average score:        ${avgScore}/100`);
  console.log(`Scoring below 70:     ${below70.length} (warm leads)`);
  console.log(`Scoring below 50:     ${below50.length} (hot leads)`);
  console.log(`════════════════════════════\n`);

  // 4. Generate outreach (if requested)
  if (!doOutreach || below70.length === 0) {
    if (below70.length > 0) {
      console.log('Run again with --outreach to generate outreach emails.\n');
    } else {
      console.log('All businesses scored above 70 — no outreach needed.\n');
    }
    return;
  }

  console.log(`\n📧 Generating outreach emails for ${below70.length} leads...\n`);

  let outreach = `# LayerOps Outreach Emails\n\n`;
  outreach += `Generated: ${new Date().toISOString().split('T')[0]}\n`;
  outreach += `Query: "${query}"\n`;
  outreach += `**${below70.length} businesses** scored below 70 (sorted worst-first)\n\n---\n\n`;

  const sorted = below70.sort((a, b) => a.overall_score - b.overall_score);

  for (const biz of sorted) {
    const topFixes = (biz.top_fixes || []).slice(0, 3);

    outreach += `## ${biz.name}\n\n`;
    outreach += `- **URL:** ${biz.url}\n`;
    outreach += `- **Score:** ${biz.overall_score}/100\n`;
    outreach += `- **Phone:** ${biz.phone || 'Unknown'}\n`;
    outreach += `- **Address:** ${biz.address || 'Unknown'}\n`;
    if (biz.rating) outreach += `- **Google Rating:** ${biz.rating}/5 (${biz.review_count} reviews)\n`;
    outreach += `\n`;

    if (topFixes.length > 0) {
      outreach += `### Top Issues\n\n`;
      topFixes.forEach((f, i) => {
        outreach += `${i + 1}. **${f.title}** (${f.impact}) — ${f.description}\n`;
      });
      outreach += `\n`;
    }

    if (biz.email_draft) {
      outreach += `### Draft Email\n\n`;
      outreach += `\`\`\`\n${biz.email_draft}\n\`\`\`\n\n`;
    }

    outreach += `---\n\n`;
  }

  const outreachFile = path.join(outputDir, `scout-${industry.toLowerCase()}-outreach.md`);
  fs.writeFileSync(outreachFile, outreach);
  console.log(`📄 Outreach emails saved to ${outreachFile}\n`);

  // Print the hottest lead
  if (sorted.length > 0) {
    const hottest = sorted[0];
    console.log(`🔥 HOTTEST LEAD: ${hottest.name} (${hottest.overall_score}/100)`);
    console.log(`   ${hottest.url}`);
    if (hottest.phone) console.log(`   📞 ${hottest.phone}`);
    console.log(`   Send the outreach email first!\n`);
  }
}

main().catch((err) => {
  console.error(`\n❌ Fatal error: ${err.message}`);
  process.exit(1);
});
