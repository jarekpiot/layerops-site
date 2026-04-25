#!/usr/bin/env node
// One-shot script to fix nav across all HTML pages:
// 1. Add white-space: nowrap to .nav-links a + .nav-cta + .header-phone
// 2. Add margin-left to .header-phone for breathing room from logo
// 3. Reduce .nav-links gap from 32px to 22px
// 4. Add AI Visibility link after Automation
// 5. Drop About + Demo from main nav
// 6. Shorten "Book a Strategy Call" / "Book a Chat" to "Book a Call"

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

function findHtmlFiles(dir, list = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.wrangler' || entry === '.git' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) findHtmlFiles(full, list);
    else if (entry.endsWith('.html')) list.push(full);
  }
  return list;
}

const files = findHtmlFiles(ROOT);
let touched = 0;

for (const file of files) {
  let src = readFileSync(file, 'utf8');
  const original = src;

  // Skip files without the nav structure
  if (!src.includes('class="nav-links"') && !src.includes("class='nav-links'")) continue;

  // 1. white-space: nowrap on .nav-links a (preserve existing transition rules)
  src = src.replace(
    /(\.nav-links a \{[^}]*?transition:\s*color[^;]*;)(\s*\})/,
    (m, body, close) => body.includes('white-space') ? m : `${body} white-space: nowrap;${close}`
  );

  // 2. .nav-links gap reduction (32px → 22px). Be careful: only inside .nav-links rule.
  src = src.replace(
    /(\.nav-links \{[^}]*?gap:\s*)32px/,
    '$122px'
  );

  // 3. .nav-cta white-space + .header-phone improvements
  src = src.replace(
    /(\.header-phone \{[^}]*?font-size:[^;]*;)(\s*\})/,
    (m, body, close) => body.includes('white-space') ? m : `${body} white-space: nowrap; margin-left: 18px;${close}`
  );

  // Add .nav-cta nowrap if .nav-cta exists and doesn't already have it
  if (src.includes('.nav-cta') && !src.match(/\.nav-cta\s*\{[^}]*white-space/)) {
    src = src.replace(
      /(\.nav-cta\s*\{[^}]*?border-radius:[^;]*;)(\s*\})/,
      '$1 white-space: nowrap;$2'
    );
  }

  // 4. Add AI Visibility link after Automation if missing
  if (!src.includes('/ai-visibility-audit')) {
    src = src.replace(
      /(<li><a href="\/automation"[^>]*>Automation<\/a><\/li>)/,
      '$1\n        <li><a href="/ai-visibility-audit">AI Visibility</a></li>'
    );
  }

  // 5. Remove About link (only the homepage anchor #about and /#about variants)
  src = src.replace(
    /\s*<li><a href="\/?#about">About<\/a><\/li>/g,
    ''
  );

  // 6. Remove Demo link
  src = src.replace(
    /\s*<li><a href="\/demo\/">Demo<\/a><\/li>/g,
    ''
  );

  // 7. Shorten CTA text
  src = src.replace(
    /(class="nav-cta"[^>]*>)Book a Strategy Call(<\/a>)/g,
    '$1Book a Call$2'
  );
  src = src.replace(
    /(class="nav-cta"[^>]*>)Book a Chat(<\/a>)/g,
    '$1Book a Call$2'
  );

  if (src !== original) {
    writeFileSync(file, src);
    touched++;
    const rel = file.replace(ROOT + '\\', '').replace(ROOT + '/', '');
    console.log(`✓ ${rel}`);
  }
}

console.log(`\nDone. Touched ${touched} of ${files.length} HTML files.`);
