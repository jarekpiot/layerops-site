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
      // Content density
      .on('p', { element() { self.data.paragraphCount++; } })
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
      // Track inline styles on all elements
      .on('*', {
        element(el) {
          const style = el.getAttribute('style');
          if (style) {
            self.data.inlineStyleCount++;
            if (self.data.inlineStyleSamples.length < 20) {
              self.data.inlineStyleSamples.push(style.substring(0, 120));
            }
          }
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
      "title": "Short title",
      "description": "Specific actionable instruction on how to fix this issue",
      "impact": "high|medium|low",
      "category": "<one of the category keys above>"
    }
  ],
  "summary": "A 2-3 sentence plain English summary of the site's SEO and UX health, suitable for a business owner who doesn't know technical jargon.",
  "email_draft": "A warm, helpful outreach email from Jarek at LayerOps. Written in a friendly Australian tone — not salesy, genuinely helpful. Should mention 1-2 specific findings from the audit (can be SEO or UX). Sign off as Jarek Piotrowski, LayerOps. Include the line 'I ran a quick SEO and UX health check on your website and found a few things that could help you get more local customers.' Keep it under 150 words. End with an offer for a free 15-minute chat."
}

Scoring guidelines:

SEO Categories:
- Technical SEO: HTTPS, canonical URL, robots meta, page size, JSON-LD/structured data, heading hierarchy
- On-Page SEO: Title tag (present, 50-60 chars ideal), meta description (present, 150-160 chars ideal), H1 (exactly one), heading structure, image alt text
- Content: H2 count (at least 2-3 for good structure), heading content quality, internal linking, paragraph density
- Mobile: Viewport meta tag present and correctly configured
- Social Sharing: Open Graph tags (og:title, og:description, og:image), Twitter Card tags

UX Categories:
- Accessibility: Image alt text coverage, form labels vs inputs (every input should have a label), ARIA landmarks and labels, semantic HTML elements (nav, main, header, footer), skip navigation link
- Navigation & Structure: Has <nav> element, has <header> and <footer>, clear heading hierarchy, sufficient internal links, descriptive link text (flag generic "click here" or "read more" links)
- Trust & Conversion: Clear CTAs (button text quality — specific action verbs beat generic "Submit"), contact info visible (phone/email links), forms present for lead capture, structured data for trust (LocalBusiness schema), social proof signals
- Performance: Page size (under 100KB is great, over 500KB is concerning), number of external scripts and stylesheets (fewer is better), iframe count (heavy embeds hurt load time)

Design Category:
- Design & Visual: Analyse the CSS variables, color palette, font choices, and styling patterns extracted from the page. Score based on:
  - **Color system**: Does the site use a consistent color palette via CSS variables? Are there too many one-off colors? Good sites use 3-5 brand colors + neutrals. Check contrast: light text on light backgrounds or dark on dark is bad.
  - **Typography**: Are professional web fonts used (Google Fonts is good)? Is there a clear type hierarchy with consistent sizing? Too many font sizes (>8) suggests inconsistency. Good sites use 2 font families max.
  - **Spacing & consistency**: Are border-radius values consistent (suggesting a design system) or random? Does the site use CSS custom properties (variables) — this indicates a well-structured design.
  - **Inline styles**: High inline style count (>30) suggests poor CSS organisation. Inline styles make sites harder to maintain and often indicate amateur design.
  - **Overall polish**: Based on the font choices, color palette, and CSS structure, does this feel like a professional design or a DIY template? Flag specific issues like: too many colors, inconsistent spacing, missing web fonts, no design system.

Be honest and specific. If something is good, say so. If something is missing, explain exactly what to add. The top_fixes array should have exactly 8 items, ordered by priority (most impactful first), mixing SEO, UX, and design fixes.`;

const COPY_REVIEW_PROMPT = `You are a direct-response copywriting expert reviewing a small business website. You work for LayerOps. Your job is to flag copy that over-promises, makes unsubstantiated claims, or could damage trust with potential customers.

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
      technical_seo: 'Technical SEO', on_page_seo: 'On-Page SEO', content: 'Content',
      mobile: 'Mobile', social_sharing: 'Social Sharing', accessibility: 'Accessibility',
      navigation_structure: 'Navigation', trust_conversion: 'Trust & Conversion',
      performance: 'Performance', design: 'Design',
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
          to: ['jarek@layerops.tech'],
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
