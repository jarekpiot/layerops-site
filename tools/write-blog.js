#!/usr/bin/env node

// LayerOps Blog Writer
// Generates SEO-optimised blog posts using Claude, matching the site's template.
//
// Usage:
//   node tools/write-blog.js "why every Canberra plumber needs a website chatbot"
//   node tools/write-blog.js "AI automation for Byron Bay businesses" --publish
//
// Requires: ANTHROPIC_API_KEY environment variable

const fs = require('fs');
const path = require('path');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const BLOG_DIR = path.join(__dirname, '..', 'blog');

const SYSTEM_PROMPT = `You are a blog writer for LayerOps, an AI automation consultancy based in Canberra and Byron Bay, Australia. Founded by Jarek Piotrowski.

Write a blog post that:
1. Is genuinely helpful for Australian small business owners (tradies, dentists, cafes, etc.)
2. Uses plain English — no jargon, no buzzwords, write at a Year 10 reading level
3. Focuses on OUTCOMES not technology — "save time" not "implement AI solutions"
4. Is 600-900 words — long enough to rank on Google, short enough to read in 4 minutes
5. Includes practical examples relevant to Australian businesses
6. Mentions Canberra and/or Byron Bay naturally for local SEO
7. Has a warm, honest, no-BS tone — like advice from a mate who knows tech
8. Ends with a soft CTA (not salesy) — suggest booking a free chat or trying the free audit

Return ONLY valid JSON with this structure:
{
  "title": "Blog post title (50-65 chars, outcome-focused)",
  "slug": "url-friendly-slug-with-dashes",
  "meta_description": "155 char description mentioning Canberra or Byron Bay",
  "og_description": "Shorter OG description, 100 chars max",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "content": "Full blog post in HTML. Use <h2> for sections, <p> for paragraphs, <strong> for emphasis. No <h1> (that's added separately). Include 4-6 sections with h2 headings. Add <ul><li> lists where appropriate.",
  "cta_title": "CTA heading at the end",
  "cta_text": "CTA paragraph text",
  "estimated_read_time": "X min read"
}`;

async function generatePost(topic) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Write a blog post about: ${topic}` }],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Claude API error (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  const text = data.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  return JSON.parse(cleaned);
}

function buildHTML(post) {
  const today = new Date().toISOString().split('T')[0];
  const dateFormatted = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

  // Read the template from an existing blog post
  const templatePath = path.join(BLOG_DIR, '5-ways-ai-saves-small-business-time.html');
  let template = fs.readFileSync(templatePath, 'utf8');

  // Extract everything before <article> and after </article>
  const beforeArticle = template.split('<article>')[0];
  const afterArticle = template.split('</article>')[1];

  // Replace meta tags in the before section
  let before = beforeArticle
    .replace(/<title>[^<]+<\/title>/, `<title>${post.title} | LayerOps Blog</title>`)
    .replace(/name="description" content="[^"]+"/, `name="description" content="${post.meta_description}"`)
    .replace(/og:title" content="[^"]+"/, `og:title" content="${post.title}"`)
    .replace(/og:description" content="[^"]+"/, `og:description" content="${post.og_description}"`)
    .replace(/og:url" content="[^"]+"/, `og:url" content="https://layerops.tech/blog/${post.slug}.html"`)
    .replace(/twitter:title" content="[^"]+"/, `twitter:title" content="${post.title}"`)
    .replace(/twitter:description" content="[^"]+"/, `twitter:description" content="${post.og_description}"`)
    .replace(/article:published_time" content="[^"]+"/, `article:published_time" content="${today}"`)
    .replace(/"datePublished": "[^"]+"/, `"datePublished": "${today}"`)
    .replace(/"headline": "[^"]+"/, `"headline": "${post.title}"`)
    .replace(/"description": "[^"]+"/, `"description": "${post.meta_description}"`)
    .replace(/"keywords": \[[^\]]+\]/, `"keywords": ${JSON.stringify(post.keywords)}`)
    .replace(/"@id": "https:\/\/layerops\.tech\/blog\/[^"]+"/, `"@id": "https://layerops.tech/blog/${post.slug}.html"`)
    .replace(/Written by Kestrel AI<\/span>/, `Written by Kestrel AI</span>`)
    .replace(/<span>28 March 2026<\/span>/, `<span>${dateFormatted}</span>`);

  const articleContent = `<article>
      <h1>${post.title}</h1>

${post.content}

      <div class="article-cta">
        <h3>${post.cta_title}</h3>
        <p>${post.cta_text}</p>
        <a href="/#contact" class="btn-primary">Book My Free 15-Min Call &rarr;</a>
      </div>
    </article>`;

  return before + articleContent + afterArticle;
}

function updateBlogIndex(post) {
  const indexPath = path.join(BLOG_DIR, 'index.html');
  let index = fs.readFileSync(indexPath, 'utf8');

  const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

  // Find the blog grid and add new post at the top
  const newCard = `
        <a href="/blog/${post.slug}.html" class="blog-card">
          <div class="blog-date">${today}</div>
          <h3>${post.title}</h3>
          <p>${post.meta_description.substring(0, 120)}...</p>
          <span class="blog-read">${post.estimated_read_time} &rarr;</span>
        </a>`;

  // Insert after the first blog-card opening or after blog-grid
  const gridMarker = 'class="blog-grid">';
  if (index.includes(gridMarker)) {
    index = index.replace(gridMarker, gridMarker + newCard);
  }

  fs.writeFileSync(indexPath, index);
}

async function main() {
  const args = process.argv.slice(2);
  const topic = args.find((a) => !a.startsWith('--'));
  const doPublish = args.includes('--publish');

  if (!topic) {
    console.log(`
LayerOps Blog Writer
═══════════════════

Usage:
  node tools/write-blog.js "topic or title idea"
  node tools/write-blog.js "topic" --publish    (also updates blog index)

Examples:
  node tools/write-blog.js "why every Canberra plumber needs a chatbot on their website"
  node tools/write-blog.js "5 signs your small business needs automation"
  node tools/write-blog.js "AI for Byron Bay hospitality businesses" --publish

Requires: ANTHROPIC_API_KEY environment variable
`);
    process.exit(0);
  }

  if (!ANTHROPIC_API_KEY) {
    console.error('\n❌ ANTHROPIC_API_KEY not set.');
    console.error('Run: set ANTHROPIC_API_KEY=your_key_here\n');
    process.exit(1);
  }

  console.log(`\n✍️  LayerOps Blog Writer`);
  console.log(`═══════════════════════\n`);
  console.log(`Topic: "${topic}"`);
  console.log(`Publishing: ${doPublish ? 'Yes' : 'No (preview only)'}\n`);

  console.log('Generating blog post with Claude...');
  const post = await generatePost(topic);

  console.log(`\nTitle: ${post.title}`);
  console.log(`Slug: ${post.slug}`);
  console.log(`Read time: ${post.estimated_read_time}`);
  console.log(`Keywords: ${post.keywords.join(', ')}`);
  console.log(`Meta: ${post.meta_description}\n`);

  // Build the full HTML page
  const html = buildHTML(post);
  const outputPath = path.join(BLOG_DIR, `${post.slug}.html`);
  fs.writeFileSync(outputPath, html);
  console.log(`📄 Blog post saved to: blog/${post.slug}.html`);

  // Save the raw post data for reference
  const dataPath = path.join(__dirname, `blog-${post.slug}.json`);
  fs.writeFileSync(dataPath, JSON.stringify(post, null, 2));
  console.log(`📄 Post data saved to: tools/blog-${post.slug}.json`);

  if (doPublish) {
    updateBlogIndex(post);
    console.log(`📄 Blog index updated`);
    console.log(`\n✅ Published! View at: https://layerops.tech/blog/${post.slug}.html`);
    console.log(`\nDon't forget to:`);
    console.log(`  git add blog/ && git commit -m "new blog post: ${post.title}" && git push`);
  } else {
    console.log(`\nPreview the post by opening: blog/${post.slug}.html`);
    console.log(`To publish, run again with --publish flag.`);
  }
}

main().catch((err) => {
  console.error(`\n❌ Error: ${err.message}`);
  process.exit(1);
});
