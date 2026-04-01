#!/usr/bin/env node

// LayerOps Client Onboarding Tool
// Creates a new client config in Cloudflare KV
// Usage: node tools/onboard.js

const readline = require('readline');
const { execSync } = require('child_process');

const KV_NAMESPACE_BINDING = 'CLIENTS';
const WRANGLER_CONFIG = 'workers/client-chat/wrangler-clients.toml';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question, defaultVal) {
  return new Promise((resolve) => {
    const prompt = defaultVal ? `${question} [${defaultVal}]: ` : `${question}: `;
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultVal || '');
    });
  });
}

function askMulti(question, hint) {
  return new Promise((resolve) => {
    console.log(`${question} ${hint || '(enter empty line to finish)'}`);
    const items = [];
    const askLine = () => {
      rl.question('  > ', (line) => {
        if (!line.trim()) {
          resolve(items);
          return;
        }
        items.push(line.trim());
        askLine();
      });
    };
    askLine();
  });
}

async function askServices() {
  console.log('\nServices (enter each service, empty line to finish):');
  const services = [];
  let more = true;
  while (more) {
    const name = await ask('  Service name (empty to finish)');
    if (!name) { more = false; break; }
    const price = await ask('  Price (e.g. "From $80/hr", optional)');
    const desc = await ask('  Short description (optional)');
    services.push({ name, ...(price && { price }), ...(desc && { description: desc }) });
    console.log(`  ✓ Added: ${name}`);
  }
  return services;
}

async function askFAQ() {
  console.log('\nFAQs (enter each Q&A, empty question to finish):');
  const faq = [];
  let more = true;
  while (more) {
    const q = await ask('  Question (empty to finish)');
    if (!q) { more = false; break; }
    const a = await ask('  Answer');
    if (a) faq.push({ q, a });
  }
  return faq;
}

async function main() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║  LayerOps Client Onboarding          ║');
  console.log('╚══════════════════════════════════════╝\n');

  // Basic info
  const business_name = await ask('Business name');
  const slug = await ask('URL slug (e.g. "smithplumbing")', business_name.toLowerCase().replace(/[^a-z0-9]+/g, ''));
  const industry = await ask('Industry (e.g. "Plumber", "Dentist", "Cafe")');
  const location = await ask('Location (e.g. "Canberra, ACT")');
  const service_area = await askMulti('Service areas', '(one per line, empty to finish)');
  const phone = await ask('Phone number');
  const email = await ask('Email');
  const hours = await ask('Business hours (e.g. "Mon-Fri 7am-5pm")', '');

  // Branding
  const brand_color = await ask('Brand color (hex)', '#2B6777');

  // Content
  const tagline = await ask('Tagline/headline', `Welcome to ${business_name}`);
  const description = await ask('Short description', `${business_name} — your local ${industry.toLowerCase()} in ${location}.`);
  const chat_greeting = await ask('Chat greeting message', `Hi! I'm the ${business_name} assistant. How can I help you today?`);
  const custom_instructions = await ask('Custom AI instructions (optional)', '');

  // Services & FAQ
  const services = await askServices();
  const faq = await askFAQ();

  // Calendar (optional)
  const calendar_link = await ask('Booking link (Cal.com, Calendly, etc — optional)', '');
  const cal_api_key = await ask('Cal.com API key (optional, for in-chat booking)', '');
  const cal_event_type_id = await ask('Cal.com event type ID (optional)', '');

  // Team members (optional)
  const addTeam = await ask('Add team members? (y/n)', 'n');
  const team = [];
  if (addTeam.toLowerCase() === 'y') {
    console.log('\nTeam Members (enter empty name to finish):');
    let addMore = true;
    while (addMore) {
      const memberName = await ask('  Team member name (empty to finish)');
      if (!memberName) { addMore = false; break; }
      const memberRole = await ask('  Role/title (e.g. "Senior Plumber", "Dr - Orthodontics")');
      const memberEmail = await ask('  Email (for lead notifications)');
      const memberSpecialties = await ask('  Specialties (comma-separated, e.g. "blocked drains, hot water")', '');
      const memberCalKey = await ask('  Cal.com API key (optional)', '');
      const memberCalEventId = await ask('  Cal.com event type ID (optional)', '');
      const memberCalendar = await ask('  Booking link (optional)', '');

      const member = {
        name: memberName,
        role: memberRole,
        email: memberEmail,
      };
      if (memberSpecialties) member.specialties = memberSpecialties.split(',').map((s) => s.trim());
      if (memberCalKey) member.cal_api_key = memberCalKey;
      if (memberCalEventId) member.cal_event_type_id = memberCalEventId;
      if (memberCalendar) member.calendar = memberCalendar;

      team.push(member);
      console.log(`  ✓ Added: ${memberName} (${memberRole})`);
    }
  }

  // Build config
  const config = {
    business_name,
    slug,
    industry,
    location,
    service_area,
    phone,
    email,
    hours,
    brand_color,
    tagline,
    description,
    chat_greeting,
    custom_instructions,
    services,
    faq,
    calendar_link,
    cal_api_key,
    cal_event_type_id,
    ...(team.length > 0 && { team }),
    created_at: new Date().toISOString(),
  };

  // Remove empty optional fields
  for (const key of Object.keys(config)) {
    if (config[key] === '' || (Array.isArray(config[key]) && config[key].length === 0)) {
      delete config[key];
    }
  }
  // Keep required fields even if empty
  config.business_name = business_name;
  config.slug = slug;

  console.log('\n─── Config Preview ───');
  console.log(JSON.stringify(config, null, 2));

  const confirm = await ask('\nDeploy this config? (y/n)', 'y');
  if (confirm.toLowerCase() !== 'y') {
    console.log('Cancelled.');
    rl.close();
    return;
  }

  // Write to KV via wrangler
  console.log('\nWriting to Cloudflare KV...');
  try {
    const configJson = JSON.stringify(config);
    // Use wrangler kv:key put to write the config
    execSync(
      `npx wrangler kv key put "${slug}" '${configJson.replace(/'/g, "\\'")}' --binding=${KV_NAMESPACE_BINDING} -c ${WRANGLER_CONFIG}`,
      { stdio: 'inherit' }
    );

    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║  ✅ Client deployed!                              ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Landing page: https://${slug}.layerops.tech`);
    console.log(`║  Embed widget: <script src="https://clients.layerops.tech/widget/${slug}"></script>`);
    console.log(`║  Chat API:     POST https://${slug}.layerops.tech`);
    console.log('╚══════════════════════════════════════════════════╝');

    // Generate confirmation email
    console.log('\n─── Confirmation Email for Client ───\n');
    console.log(`Subject: Your AI chatbot is live — ${business_name}\n`);
    console.log(`G'day!\n`);
    console.log(`Great news — your AI chatbot for ${business_name} is now live!\n`);
    console.log(`Here's what's set up:`);
    console.log(`• Your landing page: https://${slug}.layerops.tech`);
    console.log(`• Chat widget for your existing site — just paste this before </body>:`);
    console.log(`  <script src="https://clients.layerops.tech/widget/${slug}"></script>`);
    console.log(`\nThe chatbot knows about your services${services.length > 0 ? ` (${services.map(s => s.name).join(', ')})` : ''}, location, and contact details. It'll answer customer questions 24/7 and encourage them to call or book.\n`);
    console.log(`Give it a try — visit the landing page and start a chat. Let me know if you'd like any adjustments to the responses.\n`);
    console.log(`Cheers,`);
    console.log(`Jarek Piotrowski`);
    console.log(`LayerOps — layerops.tech`);
    console.log(`─────────────────────────────────────\n`);

  } catch (err) {
    console.error('\nFailed to write to KV:', err.message);
    console.log('\nYou can manually write the config with:');
    console.log(`npx wrangler kv key put "${slug}" '${JSON.stringify(config)}' --binding=${KV_NAMESPACE_BINDING} -c ${WRANGLER_CONFIG}`);
  }

  rl.close();
}

main().catch((err) => {
  console.error('\nError:', err.message);
  rl.close();
  process.exit(1);
});
