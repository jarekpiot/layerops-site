// LayerOps SEO Audit Worker — Cloudflare Worker
// Automated SEO audits for Canberra small businesses
// Uses HTMLRewriter for parsing and Claude for analysis

// ─── Rate limiter (in-memory, resets on worker restart) ──────────────────────

const rateLimiter = {
  count: 0,
  windowStart: Date.now(),
  WINDOW_MS: 60 * 60 * 1000, // 1 hour
  MAX_REQUESTS: 10,

  check() {
    const now = Date.now();
    if (now - this.windowStart > this.WINDOW_MS) {
      this.count = 0;
      this.windowStart = now;
    }
    if (this.count >= this.MAX_REQUESTS) {
      return false;
    }
    this.count++;
    return true;
  },

  remaining() {
    const now = Date.now();
    if (now - this.windowStart > this.WINDOW_MS) {
      return this.MAX_REQUESTS;
    }
    return Math.max(0, this.MAX_REQUESTS - this.count);
  },
};

// ─── HTMLRewriter-based SEO data extractor ───────────────────────────────────

class SEOExtractor {
  constructor() {
    this.data = {
      title: null,
      metaDescription: null,
      h1s: [],
      h2s: [],
      h3s: [],
      ogTitle: null,
      ogDescription: null,
      ogImage: null,
      twitterCard: null,
      twitterTitle: null,
      twitterDescription: null,
      twitterImage: null,
      canonical: null,
      jsonLd: [],
      imagesWithAlt: 0,
      imagesWithoutAlt: 0,
      internalLinks: 0,
      externalLinks: 0,
      viewport: null,
      lang: null,
      hasRobotsMeta: false,
      robotsContent: null,
    };
    this._currentElement = null;
    this._collectText = false;
    this._textBuffer = '';
    this._targetUrl = '';
  }

  // Build an HTMLRewriter chain with all the handlers
  buildRewriter(targetUrl) {
    this._targetUrl = targetUrl;
    const self = this;
    let targetHost;
    try {
      targetHost = new URL(targetUrl).hostname;
    } catch {
      targetHost = '';
    }

    return new HTMLRewriter()
      // <html lang="...">
      .on('html', {
        element(el) {
          const lang = el.getAttribute('lang');
          if (lang) self.data.lang = lang;
        },
      })
      // <title>
      .on('title', {
        element() {
          self._currentElement = 'title';
          self._collectText = true;
          self._textBuffer = '';
        },
        text(text) {
          if (self._currentElement === 'title') {
            self._textBuffer += text.text;
            if (text.lastInTextNode) {
              self.data.title = self._textBuffer.trim();
              self._collectText = false;
              self._currentElement = null;
            }
          }
        },
      })
      // <meta> tags
      .on('meta', {
        element(el) {
          const name = (el.getAttribute('name') || '').toLowerCase();
          const property = (el.getAttribute('property') || '').toLowerCase();
          const content = el.getAttribute('content') || '';

          if (name === 'description') self.data.metaDescription = content;
          if (name === 'viewport') self.data.viewport = content;
          if (name === 'robots') {
            self.data.hasRobotsMeta = true;
            self.data.robotsContent = content;
          }

          // Open Graph
          if (property === 'og:title') self.data.ogTitle = content;
          if (property === 'og:description') self.data.ogDescription = content;
          if (property === 'og:image') self.data.ogImage = content;

          // Twitter Card
          if (name === 'twitter:card') self.data.twitterCard = content;
          if (name === 'twitter:title') self.data.twitterTitle = content;
          if (name === 'twitter:description') self.data.twitterDescription = content;
          if (name === 'twitter:image') self.data.twitterImage = content;
        },
      })
      // <link rel="canonical">
      .on('link', {
        element(el) {
          const rel = (el.getAttribute('rel') || '').toLowerCase();
          if (rel === 'canonical') {
            self.data.canonical = el.getAttribute('href') || null;
          }
        },
      })
      // <h1>, <h2>, <h3>
      .on('h1', createHeadingHandler(self, 'h1s'))
      .on('h2', createHeadingHandler(self, 'h2s'))
      .on('h3', createHeadingHandler(self, 'h3s'))
      // <img> tags — alt text coverage
      .on('img', {
        element(el) {
          const alt = el.getAttribute('alt');
          if (alt && alt.trim().length > 0) {
            self.data.imagesWithAlt++;
          } else {
            self.data.imagesWithoutAlt++;
          }
        },
      })
      // <a> tags — internal vs external links
      .on('a', {
        element(el) {
          const href = el.getAttribute('href') || '';
          if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            return;
          }
          try {
            // Resolve relative URLs
            const resolved = new URL(href, targetUrl);
            if (resolved.hostname === targetHost) {
              self.data.internalLinks++;
            } else {
              self.data.externalLinks++;
            }
          } catch {
            // Treat unparseable hrefs as internal (likely relative)
            self.data.internalLinks++;
          }
        },
      })
      // <script type="application/ld+json">
      .on('script', {
        element(el) {
          const type = (el.getAttribute('type') || '').toLowerCase();
          if (type === 'application/ld+json') {
            self._currentElement = 'jsonld';
            self._collectText = true;
            self._textBuffer = '';
          }
        },
        text(text) {
          if (self._currentElement === 'jsonld') {
            self._textBuffer += text.text;
            if (text.lastInTextNode) {
              try {
                const parsed = JSON.parse(self._textBuffer.trim());
                const types = extractSchemaTypes(parsed);
                self.data.jsonLd.push({ types, raw: self._textBuffer.trim().substring(0, 500) });
              } catch {
                self.data.jsonLd.push({ types: ['parse_error'], raw: self._textBuffer.trim().substring(0, 200) });
              }
              self._collectText = false;
              self._currentElement = null;
            }
          }
        },
      });
  }
}

function createHeadingHandler(extractor, arrayName) {
  return {
    element() {
      extractor._currentElement = arrayName;
      extractor._collectText = true;
      extractor._textBuffer = '';
    },
    text(text) {
      if (extractor._currentElement === arrayName) {
        extractor._textBuffer += text.text;
        if (text.lastInTextNode) {
          const content = extractor._textBuffer.trim();
          if (content) {
            extractor.data[arrayName].push(content);
          }
          extractor._collectText = false;
          extractor._currentElement = null;
        }
      }
    },
  };
}

function extractSchemaTypes(obj) {
  const types = [];
  if (obj['@type']) {
    types.push(Array.isArray(obj['@type']) ? obj['@type'].join(', ') : obj['@type']);
  }
  if (obj['@graph'] && Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      if (item['@type']) {
        types.push(Array.isArray(item['@type']) ? item['@type'].join(', ') : item['@type']);
      }
    }
  }
  return types.length > 0 ? types : ['unknown'];
}

// ─── Fetch and audit a URL ───────────────────────────────────────────────────

async function fetchAndExtractSEO(url) {
  const startTime = Date.now();

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'LayerOps-SEO-Audit/1.0 (Canberra, AU)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new Error(`URL does not return HTML (Content-Type: ${contentType})`);
  }

  const extractor = new SEOExtractor();
  const rewriter = extractor.buildRewriter(url);

  // HTMLRewriter processes the stream — we need to consume the output to trigger handlers
  const transformed = rewriter.transform(response);
  const htmlText = await transformed.text();

  const fetchTime = Date.now() - startTime;
  const isHttps = url.startsWith('https://');

  // Check heading hierarchy
  const headingHierarchy = checkHeadingHierarchy(extractor.data);

  return {
    ...extractor.data,
    isHttps,
    pageSizeBytes: htmlText.length,
    pageSizeKB: Math.round(htmlText.length / 1024),
    fetchTimeMs: fetchTime,
    headingHierarchy,
    totalImages: extractor.data.imagesWithAlt + extractor.data.imagesWithoutAlt,
    altTextCoverage: (extractor.data.imagesWithAlt + extractor.data.imagesWithoutAlt) > 0
      ? Math.round((extractor.data.imagesWithAlt / (extractor.data.imagesWithAlt + extractor.data.imagesWithoutAlt)) * 100)
      : null,
  };
}

function checkHeadingHierarchy(data) {
  const issues = [];
  if (data.h1s.length === 0) {
    issues.push('No H1 tag found');
  } else if (data.h1s.length > 1) {
    issues.push(`Multiple H1 tags found (${data.h1s.length}) — should have exactly one`);
  }
  if (data.h2s.length === 0 && data.h3s.length > 0) {
    issues.push('H3 tags found without any H2 tags — heading hierarchy is broken');
  }
  if (data.h1s.length === 0 && data.h2s.length > 0) {
    issues.push('H2 tags found without an H1 tag — heading hierarchy is broken');
  }
  return {
    isValid: issues.length === 0,
    issues,
    h1Count: data.h1s.length,
    h2Count: data.h2s.length,
    h3Count: data.h3s.length,
  };
}

// ─── Claude analysis ─────────────────────────────────────────────────────────

const SEO_SYSTEM_PROMPT = `You are an expert SEO consultant generating an audit report for an Australian small business, likely based in Canberra or the ACT region. You work for LayerOps, an AI implementation consultancy.

You will receive raw SEO data extracted from a website. Analyse it and return a JSON report with the following structure. Return ONLY valid JSON, no markdown fences, no explanation outside the JSON.

{
  "overall_score": <number 0-100>,
  "categories": {
    "technical_seo": {
      "score": <number 0-100>,
      "issues": ["issue 1", "issue 2"]
    },
    "on_page_seo": {
      "score": <number 0-100>,
      "issues": ["issue 1", "issue 2"]
    },
    "content": {
      "score": <number 0-100>,
      "issues": ["issue 1", "issue 2"]
    },
    "mobile": {
      "score": <number 0-100>,
      "issues": ["issue 1", "issue 2"]
    },
    "social_sharing": {
      "score": <number 0-100>,
      "issues": ["issue 1", "issue 2"]
    }
  },
  "top_fixes": [
    {
      "priority": 1,
      "title": "Short title",
      "description": "Specific actionable instruction on how to fix this issue",
      "impact": "high|medium|low",
      "category": "technical_seo|on_page_seo|content|mobile|social_sharing"
    }
  ],
  "summary": "A 2-3 sentence plain English summary of the site's SEO health, suitable for a business owner who doesn't know SEO jargon.",
  "email_draft": "A warm, helpful outreach email from Jarek at LayerOps. Written in a friendly Australian tone — not salesy, genuinely helpful. Should mention 1-2 specific findings from the audit. Sign off as Jarek Piotrowski, LayerOps. Include the line 'I ran a quick SEO health check on your website and found a few things that could help you get more local customers.' Keep it under 150 words. End with an offer for a free 15-minute chat."
}

Scoring guidelines:
- Technical SEO: HTTPS, canonical URL, robots meta, page size, JSON-LD/structured data, heading hierarchy
- On-Page SEO: Title tag (present, 50-60 chars ideal), meta description (present, 150-160 chars ideal), H1 (exactly one), heading structure, image alt text
- Content: H2 count (at least 2-3 for good structure), heading content quality, internal linking
- Mobile: Viewport meta tag present and correctly configured
- Social Sharing: Open Graph tags (og:title, og:description, og:image), Twitter Card tags

Be honest and specific. If something is good, say so. If something is missing, explain exactly what to add. The top_fixes array should have exactly 5 items, ordered by priority (most impactful first).`;

async function analyseWithClaude(env, url, seoData) {
  const userMessage = `Here is the raw SEO data extracted from ${url}:\n\n${JSON.stringify(seoData, null, 2)}`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: SEO_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Claude API error (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  const text = data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  // Parse the JSON from Claude's response — strip markdown fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Failed to parse Claude analysis as JSON: ${e.message}\nRaw: ${cleaned.substring(0, 500)}`);
  }
}

// ─── CORS helper ─────────────────────────────────────────────────────────────

function corsJson(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// ─── Worker entry point ──────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'POST') {
      return corsJson({ error: 'Method not allowed. Send a POST with {"url": "https://example.com"}' }, 405);
    }

    // Rate limiting
    if (!rateLimiter.check()) {
      return corsJson({
        error: 'Rate limit exceeded. Maximum 10 audits per hour.',
        remaining: 0,
        retry_after_seconds: Math.ceil((rateLimiter.WINDOW_MS - (Date.now() - rateLimiter.windowStart)) / 1000),
      }, 429);
    }

    try {
      const body = await request.json();
      const { url } = body;

      if (!url || typeof url !== 'string') {
        return corsJson({ error: 'Missing or invalid "url" parameter. Send {"url": "https://example.com"}' }, 400);
      }

      // Basic URL validation
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch {
        return corsJson({ error: 'Invalid URL format. Include the full URL with https://' }, 400);
      }

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return corsJson({ error: 'URL must use http:// or https://' }, 400);
      }

      // Step 1: Fetch and extract SEO data
      const seoData = await fetchAndExtractSEO(url);

      // Step 2: Send to Claude for analysis
      const analysis = await analyseWithClaude(env, url, seoData);

      // Step 3: Build the final report
      const report = {
        url: url,
        audit_date: new Date().toISOString().split('T')[0],
        overall_score: analysis.overall_score,
        categories: analysis.categories,
        top_fixes: analysis.top_fixes,
        summary: analysis.summary,
        email_draft: analysis.email_draft,
        raw_data: {
          title: seoData.title,
          meta_description: seoData.metaDescription,
          h1_tags: seoData.h1s,
          h2_tags: seoData.h2s,
          canonical: seoData.canonical,
          is_https: seoData.isHttps,
          has_viewport: !!seoData.viewport,
          lang: seoData.lang,
          images_total: seoData.totalImages,
          images_with_alt: seoData.imagesWithAlt,
          images_without_alt: seoData.imagesWithoutAlt,
          alt_text_coverage_percent: seoData.altTextCoverage,
          internal_links: seoData.internalLinks,
          external_links: seoData.externalLinks,
          has_og_tags: !!(seoData.ogTitle || seoData.ogDescription || seoData.ogImage),
          has_twitter_card: !!seoData.twitterCard,
          has_json_ld: seoData.jsonLd.length > 0,
          json_ld_types: seoData.jsonLd.flatMap((j) => j.types),
          page_size_kb: seoData.pageSizeKB,
          fetch_time_ms: seoData.fetchTimeMs,
          heading_hierarchy_valid: seoData.headingHierarchy.isValid,
        },
        rate_limit: {
          remaining: rateLimiter.remaining(),
        },
      };

      return corsJson(report);
    } catch (err) {
      console.error('SEO Audit Worker error:', err.message, err.stack);
      return corsJson({
        error: 'Audit failed',
        detail: err.message,
        rate_limit: { remaining: rateLimiter.remaining() },
      }, 500);
    }
  },
};
