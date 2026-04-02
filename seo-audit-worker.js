// LayerOps SEO & UX Audit Worker — Cloudflare Worker
// Automated SEO + UX audits for Canberra small businesses
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
      // SEO signals
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
      // UX signals
      hasNav: false,
      hasFooter: false,
      hasMain: false,
      hasHeader: false,
      ctaButtons: [],
      formCount: 0,
      formLabels: 0,
      formInputs: 0,
      ariaLandmarks: 0,
      ariaLabels: 0,
      hasSkipLink: false,
      linkTexts: [],
      buttonTexts: [],
      scriptCount: 0,
      stylesheetCount: 0,
      iframeCount: 0,
      hasContactInfo: false,
      hasTel: false,
      hasEmail: false,
      paragraphCount: 0,
      listCount: 0,
      videoCount: 0,
      // Content signals (for copy review)
      paragraphTexts: [],
      listItemTexts: [],
      // Design signals
      cssVariables: [],
      fontFamilies: [],
      googleFonts: [],
      colorValues: [],
      inlineStyleCount: 0,
      inlineStyleSamples: [],
      bgColors: [],
      textColors: [],
      fontSizes: [],
      borderRadiusValues: [],
      hasCustomProperties: false,
      styleTagContent: '',
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

    const rewriter = new HTMLRewriter()
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
      // <a> tags — internal vs external links + UX signals
      .on('a', {
        element(el) {
          const href = el.getAttribute('href') || '';

          // UX: contact detection
          if (href.startsWith('tel:')) {
            self.data.hasTel = true;
            self.data.hasContactInfo = true;
          }
          if (href.startsWith('mailto:')) {
            self.data.hasEmail = true;
            self.data.hasContactInfo = true;
          }

          // UX: CTA-like links (buttons styled as links)
          const cls = (el.getAttribute('class') || '').toLowerCase();
          if (cls.includes('btn') || cls.includes('cta') || cls.includes('button')) {
            self._currentElement = 'cta';
            self._collectText = true;
            self._textBuffer = '';
          } else if (self.data.linkTexts.length < 30) {
            // Collect link text for UX analysis (first 30 links)
            self._currentElement = 'linktext';
            self._collectText = true;
            self._textBuffer = '';
          }

          // SEO: internal vs external link counting
          if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            return;
          }
          try {
            const resolved = new URL(href, targetUrl);
            if (resolved.hostname === targetHost) {
              self.data.internalLinks++;
            } else {
              self.data.externalLinks++;
            }
          } catch {
            self.data.internalLinks++;
          }
        },
        text(text) {
          if (self._currentElement === 'linktext') {
            self._textBuffer += text.text;
            if (text.lastInTextNode) {
              const t = self._textBuffer.trim();
              if (t) self.data.linkTexts.push(t.substring(0, 60));
              self._collectText = false;
              self._currentElement = null;
            }
          }
          if (self._currentElement === 'cta') {
            self._textBuffer += text.text;
            if (text.lastInTextNode) {
              const t = self._textBuffer.trim();
              if (t) self.data.ctaButtons.push(t.substring(0, 80));
              self._collectText = false;
              self._currentElement = null;
            }
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
          self.data.scriptCount++;
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
      })
      // ─── UX signals ───────────────────────────────────────────────────
      // Semantic landmarks
      .on('nav', { element() { self.data.hasNav = true; } })
      .on('footer', { element() { self.data.hasFooter = true; } })
      .on('main', { element() { self.data.hasMain = true; } })
      .on('header', { element() { self.data.hasHeader = true; } })
      // Buttons & CTAs
      .on('button', {
        element(el) {
          self._currentElement = 'button';
          self._collectText = true;
          self._textBuffer = '';
          if (el.getAttribute('aria-label')) self.data.ariaLabels++;
        },
        text(text) {
          if (self._currentElement === 'button') {
            self._textBuffer += text.text;
            if (text.lastInTextNode) {
              const t = self._textBuffer.trim();
              if (t) self.data.buttonTexts.push(t.substring(0, 80));
              self._collectText = false;
              self._currentElement = null;
            }
          }
        },
      })
      // Forms & accessibility
      .on('form', { element() { self.data.formCount++; } })
      .on('label', { element() { self.data.formLabels++; } })
      .on('input', { element() { self.data.formInputs++; } })
      .on('textarea', { element() { self.data.formInputs++; } })
      .on('select', { element() { self.data.formInputs++; } })
      // Stylesheets (count via link element, check rel attribute + Google Fonts)
      .on('link', {
        element(el) {
          const rel = (el.getAttribute('rel') || '').toLowerCase();
          if (rel === 'stylesheet') {
            self.data.stylesheetCount++;
            const href = el.getAttribute('href') || '';
            if (href.includes('fonts.googleapis.com')) {
              const fontMatch = href.match(/family=([^&]+)/);
              if (fontMatch) {
                self.data.googleFonts.push(decodeURIComponent(fontMatch[1]).replace(/\+/g, ' ').split('&')[0]);
              }
            }
          }
        },
      })
      // Iframes & video
      .on('iframe', { element() { self.data.iframeCount++; } })
      .on('video', { element() { self.data.videoCount++; } })
      // Content density + text capture for copy review
      .on('p', {
        element() {
          self.data.paragraphCount++;
          if (self.data.paragraphTexts.length < 40) {
            self._currentElement = 'paragraph';
            self._collectText = true;
            self._textBuffer = '';
          }
        },
        text(text) {
          if (self._currentElement === 'paragraph') {
            self._textBuffer += text.text;
            if (text.lastInTextNode) {
              const t = self._textBuffer.trim();
              if (t && t.length > 10) self.data.paragraphTexts.push(t.substring(0, 300));
              self._collectText = false;
              self._currentElement = null;
            }
          }
        },
      })
      .on('li', {
        element() {
          if (self.data.listItemTexts.length < 30) {
            self._currentElement = 'listitem';
            self._collectText = true;
            self._textBuffer = '';
          }
        },
        text(text) {
          if (self._currentElement === 'listitem') {
            self._textBuffer += text.text;
            if (text.lastInTextNode) {
              const t = self._textBuffer.trim();
              if (t && t.length > 5) self.data.listItemTexts.push(t.substring(0, 200));
              self._collectText = false;
              self._currentElement = null;
            }
          }
        },
      })
      .on('ul', { element() { self.data.listCount++; } })
      .on('ol', { element() { self.data.listCount++; } })
      // ─── Design signals ────────────────────────────────────────────────
      // Extract <style> tag contents for CSS analysis
      .on('style', {
        element() {
          self._currentElement = 'style';
          self._collectText = true;
          self._textBuffer = '';
        },
        text(text) {
          if (self._currentElement === 'style') {
            self._textBuffer += text.text;
            if (text.lastInTextNode) {
              self.data.styleTagContent += self._textBuffer;
              self._collectText = false;
              self._currentElement = null;
            }
          }
        },
      })
      // Track inline styles + ARIA attributes on all elements
      .on('*', {
        element(el) {
          const style = el.getAttribute('style');
          if (style) {
            self.data.inlineStyleCount++;
            if (self.data.inlineStyleSamples.length < 20) {
              self.data.inlineStyleSamples.push(style.substring(0, 120));
            }
          }
          // ARIA detection
          if (el.getAttribute('role')) self.data.ariaLandmarks++;
          if (el.getAttribute('aria-label')) self.data.ariaLabels++;
        },
      })
      ;

    // Post-process: extract design tokens from collected CSS
    return rewriter;
  }

  // Extract design tokens from CSS after rewriting completes
  extractDesignTokens() {
    const css = this.data.styleTagContent;
    if (!css) return;

    // CSS custom properties (variables)
    const varMatches = css.matchAll(/--([a-zA-Z0-9-]+)\s*:\s*([^;]+)/g);
    for (const m of varMatches) {
      this.data.cssVariables.push({ name: `--${m[1]}`, value: m[2].trim() });
      this.data.hasCustomProperties = true;
    }

    // Font families
    const fontMatches = css.matchAll(/font-family\s*:\s*([^;]+)/g);
    const fontSet = new Set();
    for (const m of fontMatches) {
      const clean = m[1].trim().replace(/'/g, '').replace(/"/g, '');
      if (!fontSet.has(clean)) {
        fontSet.add(clean);
        this.data.fontFamilies.push(clean);
      }
    }

    // Color values (hex, rgb, hsl, named)
    const colorProps = ['color', 'background-color', 'background', 'border-color', 'border'];
    const hexPattern = /#[0-9a-fA-F]{3,8}/g;
    const rgbPattern = /rgba?\([^)]+\)/g;
    const hslPattern = /hsla?\([^)]+\)/g;
    const colorSet = new Set();

    // Extract hex colors
    for (const m of css.matchAll(hexPattern)) {
      colorSet.add(m[0]);
    }
    // Extract rgb/rgba
    for (const m of css.matchAll(rgbPattern)) {
      colorSet.add(m[0]);
    }
    // Extract hsl/hsla
    for (const m of css.matchAll(hslPattern)) {
      colorSet.add(m[0]);
    }
    this.data.colorValues = [...colorSet].slice(0, 30);

    // Separate bg and text colors from variables
    for (const v of this.data.cssVariables) {
      const name = v.name.toLowerCase();
      const val = v.value;
      if (name.includes('bg') || name.includes('background') || name.includes('cream') || name.includes('surface')) {
        this.data.bgColors.push({ name: v.name, value: val });
      }
      if (name.includes('text') || name.includes('charcoal') || name.includes('color') && !name.includes('bg')) {
        this.data.textColors.push({ name: v.name, value: val });
      }
    }

    // Font sizes
    const sizeMatches = css.matchAll(/font-size\s*:\s*([^;]+)/g);
    const sizeSet = new Set();
    for (const m of sizeMatches) {
      sizeSet.add(m[1].trim());
    }
    this.data.fontSizes = [...sizeSet].slice(0, 20);

    // Border radius values
    const radiusMatches = css.matchAll(/border-radius\s*:\s*([^;]+)/g);
    const radiusSet = new Set();
    for (const m of radiusMatches) {
      radiusSet.add(m[1].trim());
    }
    this.data.borderRadiusValues = [...radiusSet].slice(0, 10);
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

  // Post-process CSS design tokens
  extractor.extractDesignTokens();

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

const AUDIT_SYSTEM_PROMPT = `You are an expert SEO and UX consultant generating an audit report for an Australian small business, likely based in Canberra or the ACT region. You work for LayerOps, an AI implementation consultancy.

You will receive raw data extracted from a website including SEO signals and UX signals. Analyse it and return a JSON report with the following structure. Return ONLY valid JSON, no markdown fences, no explanation outside the JSON.

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
    },
    "accessibility": {
      "score": <number 0-100>,
      "issues": ["issue 1", "issue 2"]
    },
    "navigation_structure": {
      "score": <number 0-100>,
      "issues": ["issue 1", "issue 2"]
    },
    "trust_conversion": {
      "score": <number 0-100>,
      "issues": ["issue 1", "issue 2"]
    },
    "performance": {
      "score": <number 0-100>,
      "issues": ["issue 1", "issue 2"]
    },
    "design": {
      "score": <number 0-100>,
      "issues": ["issue 1", "issue 2"]
    }
  },
  "top_fixes": [
    {
      "priority": 1,
      "title": "Plain English title a business owner would understand — NO jargon",
      "description": "What's wrong, why it matters to their business (lost customers, lower Google ranking, etc), and what needs to happen to fix it. Written so a cafe owner or plumber would understand.",
      "impact": "high|medium|low",
      "category": "<one of the category keys above>"
    }
  ],
  "summary": "A 2-3 sentence plain English summary. No technical terms. Focus on business impact: are they losing customers? Hard to find on Google? Looking unprofessional? Write as if explaining to a friend who runs a small business.",
  "email_draft": "A warm, helpful outreach email from Jarek at LayerOps. Written in a friendly Australian tone — not salesy, genuinely helpful. Should mention 1-2 specific findings from the audit in plain English (NOT technical jargon). Sign off as Jarek Piotrowski, LayerOps. Include the line 'I ran a quick health check on your website and found a few things that could help you get more local customers.' Keep it under 150 words. End with an offer for a free 15-minute chat."
}

CRITICAL LANGUAGE RULE:
All issues, fix titles, fix descriptions, and the summary MUST be written in plain English that a non-technical small business owner can understand. NO jargon. NO acronyms without explanation. Instead of technical terms, explain the BUSINESS IMPACT.

Examples of BAD vs GOOD issue descriptions:
- BAD: "Missing canonical URL"
- GOOD: "Google might be seeing duplicate versions of your page, which can hurt your search ranking"
- BAD: "Add ARIA landmarks"
- GOOD: "Your site is harder to use for people with disabilities, which also affects your Google ranking"
- BAD: "No JSON-LD structured data"
- GOOD: "Google doesn't fully understand what your business does — adding business info helps you show up in local searches"
- BAD: "High inline style count suggests poor CSS organisation"
- GOOD: "Your site's code is messy under the hood — this makes it slower to update and can cause display issues"
- BAD: "Missing OG tags"
- GOOD: "When someone shares your site on Facebook or LinkedIn, it won't show a proper preview with your name and description"

Scoring guidelines (use these internally, but write issues in plain English):

SEO Categories:
- Technical SEO: Is the site secure (HTTPS)? Can Google properly understand the page? Is the page lightweight and fast? Does it tell Google what the business is?
- On-Page SEO: Does the page have a good title for Google search results? Is there a clear description? Is the page well-organised with headings? Do images have descriptions?
- Content: Is there enough content? Are there links between pages? Is the content well-structured and easy to scan?
- Mobile: Does the site work properly on phones?
- Social Sharing: When shared on Facebook/LinkedIn/Twitter, does it show a proper preview?

UX Categories:
- Accessibility: Can people with disabilities use the site? Are forms properly labelled? Can keyboard users navigate?
- Navigation & Structure: Is it easy to find things? Are there clear menus? Do links make sense?
- Trust & Conversion: Does the site make visitors want to get in touch? Is the phone number easy to find? Are there clear "call now" or "book now" buttons?
- Performance: Does the site load fast? Is it bloated with unnecessary code?

Design Category:
- Design & Visual: Does the site look professional? Are colours consistent? Are fonts readable? Does it look like a real business or a DIY job?

Be honest and specific. Focus on what matters to the business owner — will this issue cost them customers? The top_fixes array should have exactly 8 items, ordered by priority (most impactful first), mixing SEO, UX, and design fixes.`;

const COPY_REVIEW_PROMPT = `You are a direct-response copywriting expert reviewing a small business website. You work for LayerOps. Your job is to flag copy that over-promises, makes unsubstantiated claims, or could damage trust with potential customers.

IMPORTANT: You will receive ALL visible text from the page — headings, paragraphs, list items, buttons, and links. Read EVERYTHING carefully. Do not skip paragraph content or list items — these often contain the most important claims and promises.

Specifically check for:
- Specific number claims (hours saved, percentage improvements, counts) — do they have proof?
- Absolute guarantees ("never", "always", "every", "guaranteed") — are they realistic?
- Before/after claims — is there evidence?
- Results sections — are the numbers substantiated?
- Pricing claims — are they clear and honest?

You will receive the page's heading text, link text, button text, CTA text, and structural data. Analyse the copy and return a JSON report. Return ONLY valid JSON, no markdown fences.

{
  "overall_score": <number 0-100>,
  "categories": {
    "honesty": {
      "score": <number 0-100>,
      "issues": ["specific quote or paraphrase from the copy + why it's a problem"]
    },
    "proof": {
      "score": <number 0-100>,
      "issues": ["what claims need evidence and what kind of evidence would help"]
    },
    "clarity": {
      "score": <number 0-100>,
      "issues": ["vague or jargon-heavy copy that could confuse the target audience"]
    },
    "cta_quality": {
      "score": <number 0-100>,
      "issues": ["CTA text that's too aggressive, too vague, or mismatched with the offer"]
    },
    "tone_consistency": {
      "score": <number 0-100>,
      "issues": ["places where the tone shifts awkwardly or feels inconsistent"]
    }
  },
  "flagged_copy": [
    {
      "text": "the exact text or heading that's problematic",
      "problem": "over-promise|no-proof|vague|aggressive|inconsistent",
      "severity": "high|medium|low",
      "suggestion": "specific rewrite or recommendation"
    }
  ],
  "summary": "2-3 sentence plain English summary of the copy's strengths and weaknesses. Be direct — the site owner wants honest feedback, not flattery."
}

Scoring guidelines:
- Honesty: Does the copy make promises it can't back up? Are there implied guarantees? Claims like "save hours every week" need proof or should be softened to "can help save time"
- Proof: Are testimonials present? Case studies? Numbers? If the site says "don't take our word for it" but has no social proof, that's a major issue
- Clarity: Would a non-technical small business owner in Canberra understand every sentence? Flag jargon, buzzwords, and vague value props
- CTA Quality: Are CTAs clear about what happens next? Do they match the commitment level? "Book My Free 15-Min Call" is good. "Get Started Now" with no context is bad
- Tone: Is it consistent throughout? Does it match the positioning (friendly Canberra consultant, not Silicon Valley startup)?

Be brutally honest. This is an internal review, not a sales pitch. Flag anything that could make a skeptical business owner think "yeah right" or "what does that even mean?"`;

const VISUAL_REVIEW_PROMPT = `You are an expert web designer and UX consultant reviewing screenshots of a small business website. You work for LayerOps. You're looking at actual screenshots — desktop and mobile views.

Analyse what you SEE and return a JSON report. Return ONLY valid JSON, no markdown fences.

{
  "overall_score": <number 0-100>,
  "categories": {
    "visual_hierarchy": {
      "score": <number 0-100>,
      "issues": ["what draws the eye first? Is it the right thing? Is the hierarchy clear?"]
    },
    "color_contrast": {
      "score": <number 0-100>,
      "issues": ["can you read all text easily? Any low-contrast text? Do colors clash?"]
    },
    "typography": {
      "score": <number 0-100>,
      "issues": ["are fonts readable? Consistent sizing? Good line spacing? Professional choices?"]
    },
    "whitespace_layout": {
      "score": <number 0-100>,
      "issues": ["is there enough breathing room? Or is it cramped? Are sections clearly separated?"]
    },
    "mobile_experience": {
      "score": <number 0-100>,
      "issues": ["does the mobile view look good? Are buttons thumb-friendly? Is text readable without zooming?"]
    },
    "professionalism": {
      "score": <number 0-100>,
      "issues": ["overall impression — does this look like a real business or a DIY template? Would you trust this site with your money?"]
    },
    "cta_visibility": {
      "score": <number 0-100>,
      "issues": ["are call-to-action buttons visible and compelling? Do they stand out from the background?"]
    },
    "brand_consistency": {
      "score": <number 0-100>,
      "issues": ["are colors, fonts, and styling consistent throughout? Does it feel like one cohesive brand?"]
    }
  },
  "first_impression": "Describe your gut reaction in 1-2 sentences — what would a visitor think in the first 3 seconds?",
  "strongest_element": "What's the best visual element on the page?",
  "weakest_element": "What's the biggest visual problem?",
  "top_fixes": [
    {
      "priority": 1,
      "title": "Short title",
      "description": "Specific visual fix — what to change and why",
      "impact": "high|medium|low",
      "category": "<one of the category keys above>"
    }
  ],
  "summary": "2-3 sentence summary of the site's visual design quality, written for a business owner."
}

Scoring guidelines:
- Visual Hierarchy: Does the most important content (headline, CTA) stand out? Is there a clear flow top to bottom?
- Color & Contrast: WCAG AA requires 4.5:1 contrast for body text. Flag any text that's hard to read. Check button text contrast too.
- Typography: Professional sites use 1-2 font families, consistent sizes, adequate line height (1.5+). Flag tiny text, inconsistent sizing.
- Whitespace & Layout: Sections should have clear separation. Content shouldn't feel cramped. Max line width should be ~600-800px for readability.
- Mobile: Text should be 16px+ on mobile. Buttons should be 44px+ tap targets. No horizontal scrolling.
- Professionalism: Does this look trustworthy? Would you give this business your credit card? Flag anything that looks amateur.
- CTA Visibility: Primary CTAs should be the most visually prominent elements. They should contrast with their background.
- Brand Consistency: Colors, fonts, spacing patterns should be consistent page-wide.

The top_fixes array should have exactly 6 items. Be specific — "increase contrast on the green text" not "improve contrast".`;

// ─── Visual analysis with Browser Rendering ──────────────────────────────────

async function takeScreenshots(env, url) {
  const puppeteer = await import('@cloudflare/puppeteer');
  const browser = await puppeteer.default.launch(env.BROWSER);

  try {
    const page = await browser.newPage();

    // Desktop screenshot (viewport-sized, not full page — avoids 8000px limit)
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1500));
    // Scroll down to capture more content in a second screenshot
    const desktopTop = await page.screenshot({ type: 'png' });
    await page.evaluate(() => window.scrollTo(0, 1200));
    await new Promise((r) => setTimeout(r, 500));
    const desktopMid = await page.screenshot({ type: 'png' });

    // Mobile screenshot
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1500));
    const mobileScreenshot = await page.screenshot({ type: 'png' });

    await browser.close();

    return {
      desktopTop: Buffer.from(desktopTop).toString('base64'),
      desktopMid: Buffer.from(desktopMid).toString('base64'),
      mobile: Buffer.from(mobileScreenshot).toString('base64'),
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}

async function analyseVisual(env, url, screenshots) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: VISUAL_REVIEW_PROMPT,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Here are screenshots of ${url}. Image 1: desktop hero/top (1440x900). Image 2: desktop scrolled down (1440x900). Image 3: mobile view (390x844). Analyse the visual design across all views.`,
          },
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: screenshots.desktopTop },
          },
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: screenshots.desktopMid },
          },
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: screenshots.mobile },
          },
        ],
      }],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Claude vision API error (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  const text = data.content.filter((b) => b.type === 'text').map((b) => b.text).join('');

  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  return JSON.parse(cleaned);
}

// ─── Premium audit: adversarial synthesis ─────────────────────────────────────

const SYNTHESIS_PROMPT = `You are a senior web consultant doing a final adversarial review. You've received THREE separate audit reports for the same website:
1. Technical audit (SEO, accessibility, performance, design — from HTML analysis)
2. Copy review (messaging, honesty, proof, tone — from text analysis)
3. Visual audit (what the site actually looks like — from screenshots)

Your job is to:
1. Cross-check findings — flag contradictions between audits (e.g. technical says "has skip nav" but visual shows "nav not visible on mobile")
2. Create a UNIFIED score that weighs all three
3. Build a PRIORITISED ACTION PLAN — not just fixes, but a sequence (do this first, then this)
4. Recommend which LayerOps service tier to pitch

Return ONLY valid JSON:
{
  "unified_score": <number 0-100>,
  "grade": "A|B|C|D|F",
  "summary": "3-4 sentence executive summary in plain English. What's the site's biggest strength and biggest weakness? Would you trust this business based on the website?",
  "strongest": "The single best thing about this website",
  "weakest": "The single biggest problem costing them customers",
  "contradictions": ["Any conflicts between the 3 audits — e.g. technical says X but visual shows Y"],
  "action_plan": [
    {
      "step": 1,
      "action": "What to do first — plain English",
      "why": "Business impact — why this matters",
      "effort": "quick|medium|major",
      "estimated_impact": "How much this will improve their score/business"
    }
  ],
  "recommended_pitch": {
    "tier": "widget_only|quick_start|business|premium",
    "price": "The monthly price",
    "reason": "Why this tier fits their situation — 1-2 sentences",
    "opening_line": "The first thing to say on the sales call"
  },
  "talking_points": [
    "Key points to mention on a sales call — specific to this business, reference actual findings"
  ]
}

The action_plan should have 5-8 steps in priority order. Mix technical fixes, copy improvements, and visual changes.

Grading:
- A (90-100): Excellent — minor tweaks only
- B (75-89): Good — some clear improvements needed
- C (60-74): Average — significant issues affecting business
- D (40-59): Poor — major problems costing customers
- F (0-39): Critical — site is actively hurting the business

For the recommended pitch, use these LayerOps tiers:
Available services to recommend (pick one or combine):

One-off services:
- seo_fix ($299 one-off): Fix their top Google issues same-day. Best first step for any site scoring below 70.
- automation ($500+ one-off): Connect their tools and automate repetitive work.

Monthly services:
- chatbot ($49/month): Embed chatbot on their existing site. Good when site is decent (70+).
- chatbot_plus_care ($149/month): Chatbot + monthly SEO fixes + monitoring. For sites needing ongoing work.
- email_triage ($199/month): Morning briefings, email sorting, deadline reminders.
- content ($499/month): Blog posts, social media, newsletters done for them.

Packages (combine as appropriate):
- "Start with the $299 SEO fix, then add the chatbot at $49/month" — most common for sites scoring 50-70
- "Your site needs rebuilding — $299 setup + $49/month for a new landing page with chatbot" — for sites below 40

Always recommend the most appropriate combination. Don't oversell — if they just need a $299 fix, say that. The chatbot upsell comes after they see results.

Write everything in plain English. This report may be shown to the business owner.`;

async function synthesiseAudits(env, url, technical, copy, visual) {
  const input = {
    url,
    technical_audit: { score: technical.overall_score, categories: technical.categories, fixes: technical.top_fixes, summary: technical.summary },
    copy_review: { score: copy.overall_score, categories: copy.categories, flagged_copy: copy.flagged_copy, summary: copy.summary },
    visual_audit: visual ? { score: visual.overall_score, categories: visual.categories, fixes: visual.top_fixes, first_impression: visual.first_impression, strongest: visual.strongest_element, weakest: visual.weakest_element, summary: visual.summary } : null,
  };

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: SYNTHESIS_PROMPT,
      messages: [{ role: 'user', content: `Synthesise these three audit reports for ${url}:\n\n${JSON.stringify(input, null, 2)}` }],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Synthesis API error (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  const text = data.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  return JSON.parse(cleaned);
}

async function analyseWithClaude(env, url, seoData, mode = 'audit') {
  const systemPrompt = mode === 'copy' ? COPY_REVIEW_PROMPT : AUDIT_SYSTEM_PROMPT;
  const userMessage = mode === 'copy'
    ? `Here is the copy and structural data from ${url}:\n\n${JSON.stringify(seoData, null, 2)}`
    : `Here is the raw SEO and UX data extracted from ${url}:\n\n${JSON.stringify(seoData, null, 2)}`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
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

// ─── Lead capture + email notification ───────────────────────────────────────

async function handleLead(request, env) {
  const body = await request.json();
  const { email, url } = body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return corsJson({ error: 'Valid email is required' }, 400);
  }
  if (!url || typeof url !== 'string') {
    return corsJson({ error: 'Website URL is required' }, 400);
  }

  // Normalise URL
  let auditUrl = url.trim();
  if (!auditUrl.startsWith('http')) auditUrl = 'https://' + auditUrl;

  let parsedUrl;
  try {
    parsedUrl = new URL(auditUrl);
  } catch {
    return corsJson({ error: 'Invalid URL format' }, 400);
  }

  // Run the full audit
  let seoData, analysis;
  try {
    seoData = await fetchAndExtractSEO(auditUrl);
    analysis = await analyseWithClaude(env, auditUrl, seoData, 'audit');
  } catch (err) {
    return corsJson({ error: 'Failed to audit website: ' + err.message }, 500);
  }

  // Build lead record
  const leadId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const lead = {
    id: leadId,
    email: email.trim().toLowerCase(),
    url: auditUrl,
    overall_score: analysis.overall_score,
    categories: analysis.categories,
    top_fixes: analysis.top_fixes,
    summary: analysis.summary,
    created_at: new Date().toISOString(),
  };

  // Auto-sync to CRM
  if (env.CRM) {
    const crmEntry = {
      id: leadId,
      name: parsedUrl.hostname,
      email: lead.email,
      url: auditUrl,
      score: analysis.overall_score,
      status: 'lead',
      type: 'organic',
      subject: '',
      sentAt: null,
      openedAt: null,
      repliedAt: null,
      notes: 'Auto-captured from website audit form',
      revenue: 0,
      created_at: lead.created_at,
    };
    await env.CRM.put(`lead:${leadId}`, JSON.stringify(crmEntry), { expirationTtl: 60 * 60 * 24 * 365 });
    // Update the leads index
    const indexRaw = await env.CRM.get('index:leads');
    const index = indexRaw ? JSON.parse(indexRaw) : [];
    index.push(leadId);
    await env.CRM.put('index:leads', JSON.stringify(index));
  }

  // Store in KV
  if (env.LEADS) {
    await env.LEADS.put(leadId, JSON.stringify(lead), { expirationTtl: 60 * 60 * 24 * 90 }); // 90 days
    // Also store an index by email for lookups
    const emailKey = `email:${lead.email}`;
    const existing = await env.LEADS.get(emailKey);
    const ids = existing ? JSON.parse(existing) : [];
    ids.push(leadId);
    await env.LEADS.put(emailKey, JSON.stringify(ids), { expirationTtl: 60 * 60 * 24 * 90 });
  }

  // Send emails via Resend
  if (env.RESEND_API_KEY) {
    const catNames = {
      technical_seo: 'Google Basics', on_page_seo: 'Search Results', content: 'Content',
      mobile: 'Mobile', social_sharing: 'Social Sharing', accessibility: 'Ease of Use',
      navigation_structure: 'Navigation', trust_conversion: 'Trust & Conversion',
      performance: 'Speed', design: 'Design',
    };

    const allCategories = Object.entries(analysis.categories || {})
      .map(([k, v]) => `  ${catNames[k] || k}: ${v.score}/100`)
      .join('\n');

    const allCategoriesWithIssues = Object.entries(analysis.categories || {})
      .map(([k, v]) => `  ${catNames[k] || k}: ${v.score}/100${v.issues.length > 0 ? '\n    - ' + v.issues.join('\n    - ') : ''}`)
      .join('\n');

    const allFixes = (analysis.top_fixes || [])
      .map((f, i) => `${i + 1}. ${f.title} (${f.impact} impact) — ${f.description}`)
      .join('\n');

    const topFixTitles = (analysis.top_fixes || []).slice(0, 3)
      .map((f, i) => `${i + 1}. ${f.title}`)
      .join('\n');

    // 1. Email to Jarek — FULL report with everything
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'LayerOps Audit <audit@layerops.tech>',
          to: ['jarek@layerops.tech', 'jarekpiot@gmail.com'],
          subject: `New lead: ${lead.email} — Score ${analysis.overall_score}/100 — ${parsedUrl.hostname}`,
          text: `New website audit lead!\n\nEmail: ${lead.email}\nWebsite: ${auditUrl}\nOverall Score: ${analysis.overall_score}/100\nLead ID: ${leadId}\nDate: ${new Date().toISOString()}\n\n━━━ FULL CATEGORY BREAKDOWN ━━━\n${allCategoriesWithIssues}\n\n━━━ ALL FIXES (ordered by priority) ━━━\n${allFixes}\n\n━━━ SUMMARY ━━━\n${analysis.summary}\n\n━━━ FOLLOW UP ━━━\nThis person entered their website for a free audit. They can see their scores and top 3 fix titles, but NOT the fix instructions or issue details.\n\nReference their specific issues in your follow-up to show expertise.\n\n— LayerOps Audit Bot`,
        }),
      });
    } catch (emailErr) {
      console.error('Failed to send Jarek notification:', emailErr.message);
    }

    // 2. Email to visitor — TEASER with scores + fix titles only
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'LayerOps Audit <audit@layerops.tech>',
          to: [lead.email],
          subject: `Your website scored ${analysis.overall_score}/100 — ${parsedUrl.hostname}`,
          text: `G'day!\n\nThanks for running a free audit on ${auditUrl}. Here are your results:\n\n━━━ OVERALL SCORE: ${analysis.overall_score}/100 ━━━\n\n${allCategories}\n\n━━━ YOUR TOP 3 ISSUES ━━━\n${topFixTitles}\n\n━━━ SUMMARY ━━━\n${analysis.summary}\n\n━━━ WANT THE FULL FIX GUIDE? ━━━\nThis report shows what's wrong — but not how to fix it. I can walk you through the specific fixes for your site in a free 15-minute call.\n\nBook a time: https://cal.com/jarek-piotrowski-jay-j5oa4i/15min\nOr reply to this email — I read every one.\n\nCheers,\nJarek Piotrowski\nLayerOps — layerops.tech\n0404 003 240`,
        }),
      });
    } catch (emailErr) {
      console.error('Failed to send visitor report:', emailErr.message);
    }
  }

  // Return results to visitor (subset — don't give away everything for free)
  return corsJson({
    lead_id: leadId,
    url: auditUrl,
    overall_score: analysis.overall_score,
    categories: Object.fromEntries(
      Object.entries(analysis.categories).map(([k, v]) => [k, { score: v.score, issue_count: v.issues.length }])
    ),
    top_fixes: (analysis.top_fixes || []).slice(0, 3).map((f) => ({
      title: f.title,
      impact: f.impact,
      category: f.category,
    })),
    summary: analysis.summary,
    message: `Full report sent to ${lead.email}. We'll be in touch with personalised recommendations.`,
  });
}

// ─── Worker entry point ──────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const reqUrl = new URL(request.url);

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

    // CRM API — GET endpoints for dashboard
    if (request.method === 'GET' && reqUrl.pathname === '/crm/leads') {
      try {
        if (!env.CRM) return corsJson({ error: 'CRM not configured' }, 500);
        const indexRaw = await env.CRM.get('index:leads');
        const index = indexRaw ? JSON.parse(indexRaw) : [];
        const leads = [];
        for (const id of index.slice(-100)) {
          const raw = await env.CRM.get(`lead:${id}`);
          if (raw) leads.push(JSON.parse(raw));
        }
        return corsJson({ leads, count: leads.length });
      } catch (err) {
        return corsJson({ error: err.message }, 500);
      }
    }

    // CRM API — save audit results for a lead
    if (request.method === 'POST' && reqUrl.pathname === '/crm/save-audit') {
      try {
        if (!env.CRM) return corsJson({ error: 'CRM not configured' }, 500);
        const body = await request.json();
        const { url, type, data } = body;
        if (!url || !data) return corsJson({ error: 'Missing url or data' }, 400);
        const key = `audit:${type || 'standard'}:${url}`;
        await env.CRM.put(key, JSON.stringify({ ...data, saved_at: new Date().toISOString() }), { expirationTtl: 60 * 60 * 24 * 365 });
        return corsJson({ success: true, key });
      } catch (err) {
        return corsJson({ error: err.message }, 500);
      }
    }

    // CRM API — get saved audit results
    if (request.method === 'GET' && reqUrl.pathname === '/crm/get-audit') {
      try {
        if (!env.CRM) return corsJson({ error: 'CRM not configured' }, 500);
        const url = reqUrl.searchParams.get('url');
        const type = reqUrl.searchParams.get('type') || 'standard';
        if (!url) return corsJson({ error: 'Missing url param' }, 400);
        const key = `audit:${type}:${url}`;
        const raw = await env.CRM.get(key);
        if (!raw) return corsJson({ found: false });
        return corsJson({ found: true, data: JSON.parse(raw) });
      } catch (err) {
        return corsJson({ error: err.message }, 500);
      }
    }

    // CRM API — run follow-ups (server-side, has Resend key)
    if (request.method === 'POST' && reqUrl.pathname === '/crm/follow-ups') {
      try {
        if (!env.CRM || !env.RESEND_API_KEY) return corsJson({ error: 'CRM or Resend not configured' }, 500);
        const body = await request.json();
        const dryRun = body.dry_run !== false;

        const indexRaw = await env.CRM.get('index:leads');
        const index = indexRaw ? JSON.parse(indexRaw) : [];
        const results = [];

        const SCHEDULE = [
          { day: 3, id: 'followup-2', subjectFn: (h) => `re: ${h}`, body: (l) => `<p>Hi,</p><p>Just checking you saw my note about ${l.name || 'your website'}. I found some things that could help more customers find you online.</p><p>Happy to send through the full report if you're interested - no cost, no obligation.</p><p>Cheers,<br>Jarek Piotrowski<br><span style="color:#999;font-size:13px;">LayerOps &middot; <a href="https://layerops.tech" style="color:#2B6777;">layerops.tech</a> &middot; 0404 003 240</span></p>` },
          { day: 7, id: 'followup-3', subjectFn: (h) => `${h} - one more thing`, body: (l) => `<p>Hi,</p><p>One more thing I noticed about ${l.url ? new URL(l.url).hostname : 'your site'} - when someone shares it on Facebook or LinkedIn, it doesn't show a proper preview. That means you're missing out on word-of-mouth traffic.</p><p>That's one of the 8 things I found in the full audit. Want me to send it through?</p><p>Cheers,<br>Jarek Piotrowski<br><span style="color:#999;font-size:13px;">LayerOps &middot; <a href="https://layerops.tech" style="color:#2B6777;">layerops.tech</a> &middot; 0404 003 240</span></p>` },
          { day: 14, id: 'followup-4', subjectFn: (h) => `still happy to help - ${h}`, body: (l) => `<p>Hi,</p><p>I help Canberra businesses get found on Google and capture more customer enquiries. I ran a health check on your website and put together a report with specific fixes.</p><p>If you're interested, just reply and I'll send it over. If not, no worries at all.</p><p>Cheers,<br>Jarek Piotrowski<br><span style="color:#999;font-size:13px;">LayerOps &middot; <a href="https://layerops.tech" style="color:#2B6777;">layerops.tech</a> &middot; 0404 003 240</span></p>` },
          { day: 21, id: 'followup-final', subjectFn: () => 'last note from me', body: (l) => `<p>Hi,</p><p>Last note from me - I wanted to make sure you had the option to see the full website report I put together for ${l.name || 'your business'}.</p><p>If the timing isn't right, no problem. The report will be here whenever you're ready - just reply to this email.</p><p>All the best,<br>Jarek Piotrowski<br><span style="color:#999;font-size:13px;">LayerOps &middot; <a href="https://layerops.tech" style="color:#2B6777;">layerops.tech</a> &middot; 0404 003 240</span></p>` },
        ];

        for (const id of index) {
          const raw = await env.CRM.get(`lead:${id}`);
          if (!raw) continue;
          const lead = JSON.parse(raw);
          if (['replied','call','client','lost'].includes(lead.status)) continue;
          if (lead.type === 'friend') continue;
          if (!lead.email || !lead.sentAt) continue;

          const daysSince = Math.floor((Date.now() - new Date(lead.sentAt).getTime()) / (1000*60*60*24));
          const prevFollowUps = ((lead.notes || '').match(/\[followup-/g) || []).length;
          const next = SCHEDULE[prevFollowUps];
          if (!next || daysSince < next.day) {
            results.push({ name: lead.name, action: 'waiting', days: daysSince, nextDay: next?.day || 'done' });
            continue;
          }

          const hostname = lead.url ? new URL(lead.url).hostname : lead.name;
          const subject = next.subjectFn(hostname);
          const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;line-height:1.7;color:#333;">' + next.body(lead) + '</body></html>';

          if (dryRun) {
            results.push({ name: lead.name, action: 'would_send', subject, days: daysSince });
          } else {
            try {
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
                body: JSON.stringify({ from: 'Jarek Piotrowski <jarek@layerops.tech>', to: [lead.email], cc: ['jarekpiot@gmail.com'], subject, html, reply_to: 'jarek@layerops.tech' }),
              });
              lead.notes = (lead.notes || '') + ` [${next.id} sent ${new Date().toISOString().split('T')[0]}]`;
              await env.CRM.put(`lead:${id}`, JSON.stringify(lead), { expirationTtl: 60*60*24*365 });
              results.push({ name: lead.name, action: 'sent', subject, days: daysSince });
            } catch (err) {
              results.push({ name: lead.name, action: 'failed', error: err.message });
            }
          }
        }
        return corsJson({ dry_run: dryRun, results, count: results.length });
      } catch (err) {
        return corsJson({ error: err.message }, 500);
      }
    }

    // CRM API — update lead status
    if (request.method === 'POST' && reqUrl.pathname === '/crm/update') {
      try {
        if (!env.CRM) return corsJson({ error: 'CRM not configured' }, 500);
        const body = await request.json();
        const { id, status, notes, revenue } = body;
        const raw = await env.CRM.get(`lead:${id}`);
        if (!raw) return corsJson({ error: 'Lead not found' }, 404);
        const lead = JSON.parse(raw);
        if (status) {
          lead.status = status;
          if (status === 'opened' && !lead.openedAt) lead.openedAt = new Date().toISOString();
          if (status === 'replied' && !lead.repliedAt) lead.repliedAt = new Date().toISOString();
        }
        if (notes !== undefined) lead.notes = notes;
        if (revenue !== undefined) lead.revenue = revenue;
        await env.CRM.put(`lead:${id}`, JSON.stringify(lead), { expirationTtl: 60 * 60 * 24 * 365 });
        return corsJson({ success: true, lead });
      } catch (err) {
        return corsJson({ error: err.message }, 500);
      }
    }

    // CRM API — add lead manually
    if (request.method === 'POST' && reqUrl.pathname === '/crm/add') {
      try {
        if (!env.CRM) return corsJson({ error: 'CRM not configured' }, 500);
        const body = await request.json();
        const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
        const lead = { id, status: 'lead', created_at: new Date().toISOString(), openedAt: null, repliedAt: null, revenue: 0, ...body };
        await env.CRM.put(`lead:${id}`, JSON.stringify(lead), { expirationTtl: 60 * 60 * 24 * 365 });
        const indexRaw = await env.CRM.get('index:leads');
        const index = indexRaw ? JSON.parse(indexRaw) : [];
        index.push(id);
        await env.CRM.put('index:leads', JSON.stringify(index));
        return corsJson({ success: true, lead });
      } catch (err) {
        return corsJson({ error: err.message }, 500);
      }
    }

    // Resend webhook — auto-track opens, clicks, bounces
    if (reqUrl.pathname === '/webhook/resend') {
      // Accept GET for verification
      if (request.method === 'GET') return corsJson({ ok: true, endpoint: 'resend-webhook' });

      if (request.method !== 'POST') return corsJson({ ok: true });

      try {
        const rawBody = await request.text();
        console.log('Webhook received:', rawBody.substring(0, 500));
        const event = JSON.parse(rawBody);
        if (!env.CRM) return corsJson({ ok: true });

        // Resend sends: { type: "email.opened", data: { email_id, to: ["email"], ... } }
        const email = event.data?.to?.[0] || event.data?.to || event.data?.email;
        console.log('Webhook type:', event.type, 'email:', email);
        if (!email) return corsJson({ ok: true });

        // Find lead by email
        const indexRaw = await env.CRM.get('index:leads');
        const index = indexRaw ? JSON.parse(indexRaw) : [];
        for (const id of index) {
          const raw = await env.CRM.get(`lead:${id}`);
          if (!raw) continue;
          const lead = JSON.parse(raw);
          if (lead.email !== email) continue;

          if (event.type === 'email.delivered' && !lead.deliveredAt) {
            lead.deliveredAt = new Date().toISOString();
          }
          if (event.type === 'email.opened' && !lead.openedAt) {
            lead.openedAt = new Date().toISOString();
            if (['lead', 'contacted'].includes(lead.status)) lead.status = 'opened';
          }
          if (event.type === 'email.clicked') {
            if (!lead.openedAt) lead.openedAt = new Date().toISOString();
            if (['lead', 'contacted'].includes(lead.status)) lead.status = 'opened';
            lead.notes = (lead.notes || '') + ' [Clicked ' + new Date().toISOString().split('T')[0] + ']';
          }
          if (event.type === 'email.bounced') {
            lead.status = 'lost';
            lead.notes = (lead.notes || '') + ' [BOUNCED]';
          }

          await env.CRM.put(`lead:${id}`, JSON.stringify(lead), { expirationTtl: 60 * 60 * 24 * 365 });
          break;
        }
        return corsJson({ ok: true });
      } catch (err) {
        console.error('Webhook error:', err.message);
        return corsJson({ ok: true });
      }
    }

    if (request.method !== 'POST') {
      return corsJson({ error: 'Method not allowed. Send a POST with {"url": "https://example.com"}' }, 405);
    }

    // Lead capture endpoint
    if (reqUrl.pathname === '/lead') {
      if (!rateLimiter.check()) {
        return corsJson({ error: 'Rate limit exceeded. Try again later.', remaining: 0 }, 429);
      }
      try {
        return await handleLead(request, env);
      } catch (err) {
        console.error('Lead handler error:', err.message, err.stack);
        return corsJson({ error: 'Audit failed. Please try again.' }, 500);
      }
    }

    // Premium audit endpoint — 3-pass adversarial review + synthesis
    if (reqUrl.pathname === '/premium') {
      // Premium uses 3 rate limit slots
      if (!rateLimiter.check() || !rateLimiter.check() || !rateLimiter.check()) {
        return corsJson({ error: 'Rate limit exceeded. Premium audit uses 3 slots.', remaining: 0 }, 429);
      }
      try {
        const body = await request.json();
        const { url } = body;
        if (!url || typeof url !== 'string') {
          return corsJson({ error: 'Missing "url" parameter' }, 400);
        }

        let auditUrl = url.trim();
        if (!auditUrl.startsWith('http')) auditUrl = 'https://' + auditUrl;
        const hostname = new URL(auditUrl).hostname;

        // Pass 1: Full technical + UX + design audit
        const seoData = await fetchAndExtractSEO(auditUrl);
        const technicalAudit = await analyseWithClaude(env, auditUrl, seoData, 'audit');

        // Pass 2: Copy review
        const copyReview = await analyseWithClaude(env, auditUrl, seoData, 'copy');

        // Pass 3: Visual analysis (if browser available)
        let visualAudit = null;
        if (env.BROWSER) {
          try {
            const screenshots = await takeScreenshots(env, auditUrl);
            visualAudit = await analyseVisual(env, auditUrl, screenshots);
          } catch (vizErr) {
            console.error('Visual audit failed, continuing without:', vizErr.message);
          }
        }

        // Pass 4: Adversarial synthesis — cross-check all 3 audits
        const synthesis = await synthesiseAudits(env, auditUrl, technicalAudit, copyReview, visualAudit);

        // Build the premium report
        const report = {
          url: auditUrl,
          hostname,
          mode: 'premium',
          audit_date: new Date().toISOString().split('T')[0],
          unified_score: synthesis.unified_score,
          grade: synthesis.grade,
          summary: synthesis.summary,
          first_impression: visualAudit?.first_impression || null,
          strongest: synthesis.strongest,
          weakest: synthesis.weakest,
          action_plan: synthesis.action_plan,
          recommended_pitch: synthesis.recommended_pitch,
          talking_points: synthesis.talking_points,
          audits: {
            technical: {
              score: technicalAudit.overall_score,
              categories: technicalAudit.categories,
              fixes: technicalAudit.top_fixes,
            },
            copy: {
              score: copyReview.overall_score,
              categories: copyReview.categories,
              flagged: copyReview.flagged_copy,
            },
            visual: visualAudit ? {
              score: visualAudit.overall_score,
              categories: visualAudit.categories,
              fixes: visualAudit.top_fixes,
              strongest_element: visualAudit.strongest_element,
              weakest_element: visualAudit.weakest_element,
            } : null,
          },
          raw_data: {
            page_size_kb: seoData.pageSizeKB,
            images_total: seoData.totalImages,
            images_with_alt: seoData.imagesWithAlt,
            internal_links: seoData.internalLinks,
            external_links: seoData.externalLinks,
            google_fonts: seoData.googleFonts,
            color_palette: seoData.colorValues?.slice(0, 15),
            inline_style_count: seoData.inlineStyleCount,
          },
          rate_limit: { remaining: rateLimiter.remaining() },
        };

        return corsJson(report);
      } catch (err) {
        console.error('Premium audit error:', err.message, err.stack);
        return corsJson({ error: 'Premium audit failed: ' + err.message }, 500);
      }
    }

    // Visual analysis endpoint
    if (reqUrl.pathname === '/visual') {
      if (!rateLimiter.check()) {
        return corsJson({ error: 'Rate limit exceeded. Try again later.', remaining: 0 }, 429);
      }
      try {
        const body = await request.json();
        const { url } = body;
        if (!url || typeof url !== 'string') {
          return corsJson({ error: 'Missing "url" parameter' }, 400);
        }

        let auditUrl = url.trim();
        if (!auditUrl.startsWith('http')) auditUrl = 'https://' + auditUrl;

        if (!env.BROWSER) {
          return corsJson({ error: 'Browser rendering not available. Check worker configuration.' }, 500);
        }

        // Take screenshots
        const screenshots = await takeScreenshots(env, auditUrl);

        // Analyse with Claude vision
        const analysis = await analyseVisual(env, auditUrl, screenshots);

        return corsJson({
          url: auditUrl,
          mode: 'visual',
          audit_date: new Date().toISOString().split('T')[0],
          overall_score: analysis.overall_score,
          categories: analysis.categories,
          first_impression: analysis.first_impression,
          strongest_element: analysis.strongest_element,
          weakest_element: analysis.weakest_element,
          top_fixes: analysis.top_fixes,
          summary: analysis.summary,
          rate_limit: { remaining: rateLimiter.remaining() },
        });
      } catch (err) {
        console.error('Visual audit error:', err.message, err.stack);
        return corsJson({ error: 'Visual audit failed: ' + err.message }, 500);
      }
    }

    // Rate limiting for standard audit
    if (!rateLimiter.check()) {
      return corsJson({
        error: 'Rate limit exceeded. Maximum 10 audits per hour.',
        remaining: 0,
        retry_after_seconds: Math.ceil((rateLimiter.WINDOW_MS - (Date.now() - rateLimiter.windowStart)) / 1000),
      }, 429);
    }

    try {
      const body = await request.json();
      const { url, mode } = body;
      const auditMode = mode === 'copy' ? 'copy' : 'audit';

      if (!url || typeof url !== 'string') {
        return corsJson({ error: 'Missing or invalid "url" parameter. Send {"url": "https://example.com", "mode": "audit|copy"}' }, 400);
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
      const analysis = await analyseWithClaude(env, url, seoData, auditMode);

      // Step 3: Build the final report
      const report = {
        url: url,
        mode: auditMode,
        audit_date: new Date().toISOString().split('T')[0],
        overall_score: analysis.overall_score,
        categories: analysis.categories,
        ...(auditMode === 'copy'
          ? { flagged_copy: analysis.flagged_copy }
          : { top_fixes: analysis.top_fixes, email_draft: analysis.email_draft }),
        summary: analysis.summary,
        raw_data: {
          // SEO signals
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
          // UX signals
          has_nav: seoData.hasNav,
          has_header: seoData.hasHeader,
          has_footer: seoData.hasFooter,
          has_main: seoData.hasMain,
          button_texts: seoData.buttonTexts,
          cta_buttons: seoData.ctaButtons,
          form_count: seoData.formCount,
          form_labels: seoData.formLabels,
          form_inputs: seoData.formInputs,
          aria_landmarks: seoData.ariaLandmarks,
          aria_labels: seoData.ariaLabels,
          has_contact_info: seoData.hasContactInfo,
          has_phone: seoData.hasTel,
          has_email: seoData.hasEmail,
          link_texts: seoData.linkTexts,
          paragraph_count: seoData.paragraphCount,
          list_count: seoData.listCount,
          script_count: seoData.scriptCount,
          stylesheet_count: seoData.stylesheetCount,
          iframe_count: seoData.iframeCount,
          video_count: seoData.videoCount,
          // Content text for copy review
          paragraph_texts: seoData.paragraphTexts,
          list_item_texts: seoData.listItemTexts,
          // Design signals
          css_variables: seoData.cssVariables,
          has_design_system: seoData.hasCustomProperties,
          google_fonts: seoData.googleFonts,
          font_families: seoData.fontFamilies,
          font_sizes: seoData.fontSizes,
          color_palette: seoData.colorValues,
          bg_colors: seoData.bgColors,
          text_colors: seoData.textColors,
          border_radius_values: seoData.borderRadiusValues,
          inline_style_count: seoData.inlineStyleCount,
          inline_style_samples: seoData.inlineStyleSamples.slice(0, 10),
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
