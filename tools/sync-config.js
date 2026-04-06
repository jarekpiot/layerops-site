#!/usr/bin/env node

// LayerOps Config Sync
// Reads config/services.json and updates chatbot system prompts in all workers.
//
// Usage:
//   node tools/sync-config.js           Preview changes
//   node tools/sync-config.js --apply   Apply changes to worker files
//
// After running with --apply, deploy the workers:
//   npx wrangler deploy -c wrangler-chat.toml
//   npx wrangler deploy -c wrangler-audit.toml

const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'services.json');

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

// ─── Generate chatbot system prompt pricing block ────────────────────────────

function buildChatbotPricing(config) {
  let out = '';

  out += 'PRICING — memorise this exactly. Do NOT make up extras or add-ons that aren\'t listed here:\n\n';

  for (const tier of config.tiers) {
    out += `${tier.name} — ${tier.price_display} (${tier.setup}, ${tier.lock_in ? 'lock-in applies' : 'no lock-in'}):\n`;
    out += `INCLUDES: ${tier.includes.join(', ')}.\n`;
    if (tier.does_not_include.length > 0) {
      out += `DOES NOT INCLUDE: ${tier.does_not_include.join(', ')}.\n`;
    }
    if (tier.recommended) out += 'This is the most popular tier.\n';
    out += '\n';
  }

  out += 'One-off services:\n';
  for (const svc of config.oneoff_services) {
    out += `- ${svc.name}: ${svc.price_display} — ${svc.description}\n`;
  }

  out += `\nAutomation add-ons (optional, on top of any tier):\n`;
  out += `- ${config.automation_addons.price_display}. ${config.automation_addons.minimum_term} minimum.\n`;
  out += `- Choose from: ${config.automation_addons.options.join(', ')}.\n`;
  out += '- Only mention add-ons if someone asks about specific automation beyond what their tier includes.\n';

  out += '\nIMPORTANT RULES for quoting pricing:\n';
  for (const rule of config.chatbot_rules) {
    out += `- ${rule}\n`;
  }
  out += `- ${config.gst_note}.\n`;

  return out;
}

// ─── Generate audit worker pricing block ─────────────────────────────────────

function buildAuditPricing(config) {
  let out = 'For the recommended pitch, use these LayerOps tiers:\n\n';

  out += 'Monthly AI Receptionist (no lock-in, free setup):\n';
  for (const tier of config.tiers) {
    out += `- ${tier.name} (${tier.price_display}): ${tier.includes.slice(0, 4).join(', ')}.\n`;
  }

  out += '\nOne-off services:\n';
  for (const svc of config.oneoff_services) {
    out += `- ${svc.name} (${svc.price_display}): ${svc.description}\n`;
  }

  out += `\nAutomation add-ons (${config.automation_addons.price_display}):\n`;
  out += `- Pick from: ${config.automation_addons.options.join(', ')}.\n`;

  out += '\nPackages (combine as appropriate):\n';
  out += `- "Start with the $${config.oneoff_services[0].price} SEO fix, then add the Starter chatbot at $${config.tiers[0].price}/month" — most common for sites scoring 50-70\n`;
  out += `- "For a business missing calls, the Professional at $${config.tiers[1].price}/month pays for itself with one extra job a week"\n`;
  out += '\nAlways recommend the most appropriate tier. Don\'t oversell — if they just need a SEO fix, say that.';

  return out;
}

// ─── Update a file by replacing content between markers ──────────────────────

function updateBetweenMarkers(filePath, startMarker, endMarker, newContent) {
  const content = fs.readFileSync(filePath, 'utf8');
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    return { changed: false, reason: 'markers not found' };
  }

  const before = content.substring(0, startIdx + startMarker.length);
  const after = content.substring(endIdx);
  const newFile = before + '\n' + newContent + '\n' + after;

  if (newFile === content) {
    return { changed: false, reason: 'already up to date' };
  }

  if (APPLY) {
    fs.writeFileSync(filePath, newFile);
  }
  return { changed: true };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const config = loadConfig();

  console.log(`\nLayerOps Config Sync`);
  console.log(`════════════════════\n`);
  console.log(`Config: ${CONFIG_PATH}`);
  console.log(`Last updated: ${config.last_updated}`);
  console.log(`Tiers: ${config.tiers.map(t => `${t.name} $${t.price}`).join(', ')}`);
  console.log(`Mode: ${APPLY ? 'APPLY' : 'PREVIEW (run with --apply to write changes)'}\n`);

  // Show generated prompts
  console.log('─── Chatbot Prompt Block ───');
  console.log(buildChatbotPricing(config));
  console.log('─── Audit Prompt Block ───');
  console.log(buildAuditPricing(config));

  // Summary
  console.log('\n─── Files to update ───');
  console.log('1. layerops-worker.js (main chatbot)');
  console.log('2. seo-audit-worker.js (audit bot)');
  console.log('3. tools/call-prep.js (call prep tool)');
  console.log('\nAfter applying, deploy:');
  console.log('  npx wrangler deploy -c wrangler-chat.toml');
  console.log('  npx wrangler deploy -c wrangler-audit.toml\n');

  if (!APPLY) {
    console.log('Run with --apply to update the files.\n');
  } else {
    console.log('Files updated. Now deploy the workers.\n');
  }
}

main();
