// Inventory tool — lists which secret-bearing files exist on disk WITHOUT printing values
// Usage: node tools/check-secrets.js
const fs = require('fs');

const candidates = [
  'C:\\Users\\jarek\\AppData\\Roaming\\xdg.config\\.wrangler\\config\\default.toml',
  'C:\\Users\\jarek\\.claude\\.credentials.json',
  'C:\\krestel\\layerops-site\\.claude\\settings.local.json',
  'C:\\krestel\\layerops-site\\admin\\index.html',
  'C:\\krestel\\layerops-voice\\.dev.vars',
  'C:\\krestel\\layerops-voice\\wrangler.toml',
];

// Use precise patterns + context keywords to avoid false positives
const checks = [
  {
    name: 'Anthropic API key',
    test: (c) => /sk-ant-api03-[A-Za-z0-9_-]{50,}/.test(c),
  },
  {
    name: 'Resend API key',
    test: (c) => /re_[A-Za-z0-9]{8,}_[A-Za-z0-9]{20,}/.test(c),
  },
  {
    name: 'Cal.com API key',
    test: (c) => /cal_live_[a-f0-9]{20,}/.test(c),
  },
  {
    name: 'Twilio Account SID',
    test: (c) => /\bAC[a-f0-9]{32}\b/.test(c),
  },
  {
    name: 'Cloudflare API token',
    // Cloudflare tokens are 40 chars [A-Za-z0-9_-] BUT only flag if context mentions cloudflare
    test: (c) => /CLOUDFLARE_API_TOKEN\s*[=:]\s*['"]?[A-Za-z0-9_-]{40}/i.test(c)
              || /CF_API_TOKEN\s*[=:]\s*['"]?[A-Za-z0-9_-]{40}/i.test(c),
  },
  {
    name: 'Google OAuth refresh token',
    test: (c) => /1\/\/0[A-Za-z0-9_-]{50,}/.test(c) || /GOOGLE_REFRESH_TOKEN\s*[=:]\s*['"]?[A-Za-z0-9._\/-]{30,}/.test(c),
  },
];

for (const file of candidates) {
  if (!fs.existsSync(file)) {
    console.log(`[ MISSING ] ${file}`);
    continue;
  }
  const stat = fs.statSync(file);
  const content = fs.readFileSync(file, 'utf8');
  const found = checks.filter((c) => c.test(content)).map((c) => c.name);
  if (found.length > 0) {
    console.log(`[ FOUND ${found.length} ] ${file} (${stat.size}B)`);
    found.forEach((f) => console.log(`           - ${f}`));
  } else {
    console.log(`[  CLEAN  ] ${file} (${stat.size}B)`);
  }
}
