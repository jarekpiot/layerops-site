// Dynamic landing page template for client sites
// All content populated from KV config

export function LANDING_HTML(config) {
  const c = config;
  const primary = c.brand_color || '#2B6777';
  const primaryLight = c.brand_color_light || lighten(primary);
  const primaryDark = c.brand_color_dark || darken(primary);
  const name = esc(c.business_name || 'Business');
  const phone = esc(c.phone || '');
  const email = esc(c.email || '');
  const location = esc(c.location || '');
  const areas = Array.isArray(c.service_area) ? c.service_area.map(esc).join(', ') : esc(c.service_area || '');
  const hours = esc(c.hours || '');
  const tagline = esc(c.tagline || `Welcome to ${c.business_name}`);
  const description = esc(c.description || `Get in touch with ${c.business_name} today.`);
  const whatsapp = esc(c.whatsapp || '');
  const slug = c.slug || '';
  const chatEndpoint = `https://${slug}.layerops.tech`;
  const greeting = esc(c.chat_greeting || `Hi! I'm the ${c.business_name} assistant. How can I help you today?`);

  const servicesHtml = (c.services || []).map((s) => `
    <div class="service-card">
      <h3>${esc(s.name)}</h3>
      ${s.price ? `<div class="service-price">${esc(s.price)}</div>` : ''}
      ${s.description ? `<p>${esc(s.description)}</p>` : ''}
    </div>`).join('');

  const faqHtml = (c.faq || []).map((f) => `
    <details class="faq-item">
      <summary>${esc(f.q)}</summary>
      <p>${esc(f.a)}</p>
    </details>`).join('');

  return `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="https://${slug}.layerops.tech/">
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${name}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="https://${slug}.layerops.tech/">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: ${primary};
      --primary-light: ${primaryLight};
      --primary-dark: ${primaryDark};
      --cream: #FDFAF5;
      --cream-dark: #F5EDE0;
      --charcoal: #2A2A2A;
      --text: #3D3D3D;
      --text-light: #6B6B6B;
      --green: #34C759;
      --radius: 12px;
      --radius-lg: 20px;
      --shadow: 0 2px 12px rgba(0,0,0,0.06);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'DM Sans', -apple-system, sans-serif;
      color: var(--text);
      background: var(--cream);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    .container { max-width: 800px; margin: 0 auto; padding: 0 20px; }

    /* Header */
    .site-header {
      background: white;
      border-bottom: 1px solid var(--cream-dark);
      padding: 16px 0;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .header-inner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 800px;
      margin: 0 auto;
      padding: 0 20px;
    }
    .site-name {
      font-size: 1.3rem;
      font-weight: 700;
      color: var(--primary);
    }
    .header-cta {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .btn-call {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--primary);
      color: white;
      padding: 10px 20px;
      border-radius: var(--radius);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
      transition: background 0.2s;
    }
    .btn-call:hover { background: var(--primary-dark); }

    /* Hero */
    .hero {
      padding: 60px 0 40px;
      text-align: center;
    }
    .hero h1 {
      font-size: 2rem;
      color: var(--charcoal);
      margin-bottom: 16px;
      line-height: 1.3;
    }
    .hero p {
      font-size: 1.1rem;
      color: var(--text-light);
      max-width: 560px;
      margin: 0 auto 32px;
    }
    .hero-buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--primary);
      color: white;
      padding: 14px 28px;
      border-radius: var(--radius);
      text-decoration: none;
      font-weight: 600;
      font-size: 1rem;
      transition: all 0.2s;
      border: none;
      cursor: pointer;
    }
    .btn-primary:hover { background: var(--primary-dark); transform: translateY(-1px); }
    .btn-secondary {
      display: inline-flex;
      align-items: center;
      background: white;
      color: var(--primary);
      padding: 14px 28px;
      border-radius: var(--radius);
      text-decoration: none;
      font-weight: 600;
      font-size: 1rem;
      border: 2px solid var(--primary);
      transition: all 0.2s;
    }
    .btn-secondary:hover { background: var(--primary); color: white; }

    /* Services */
    .services { padding: 40px 0; }
    .section-title {
      font-size: 1.5rem;
      color: var(--charcoal);
      text-align: center;
      margin-bottom: 32px;
    }
    .service-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px;
    }
    .service-card {
      background: white;
      border-radius: var(--radius-lg);
      padding: 28px;
      box-shadow: var(--shadow);
    }
    .service-card h3 {
      color: var(--charcoal);
      margin-bottom: 8px;
      font-size: 1.1rem;
    }
    .service-price {
      color: var(--primary);
      font-weight: 700;
      font-size: 0.95rem;
      margin-bottom: 8px;
    }
    .service-card p {
      color: var(--text-light);
      font-size: 0.9rem;
    }

    /* FAQ */
    .faq { padding: 40px 0; }
    .faq-item {
      border-bottom: 1px solid var(--cream-dark);
      padding: 16px 0;
    }
    .faq-item summary {
      cursor: pointer;
      font-weight: 600;
      color: var(--charcoal);
      list-style: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .faq-item summary::after { content: '+'; color: var(--primary); font-size: 1.3rem; }
    .faq-item[open] summary::after { content: '−'; }
    .faq-item p {
      margin-top: 12px;
      color: var(--text-light);
      line-height: 1.7;
    }

    /* Contact */
    .contact {
      padding: 40px 0;
      text-align: center;
    }
    .contact-grid {
      display: flex;
      gap: 20px;
      justify-content: center;
      flex-wrap: wrap;
      margin-top: 24px;
    }
    .contact-item {
      background: white;
      border-radius: var(--radius);
      padding: 20px 28px;
      box-shadow: var(--shadow);
      text-decoration: none;
      color: var(--text);
      transition: transform 0.2s;
    }
    .contact-item:hover { transform: translateY(-2px); }
    .contact-label {
      font-size: 0.8rem;
      color: var(--text-light);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .contact-value {
      font-weight: 600;
      color: var(--primary);
    }

    /* Footer */
    .site-footer {
      padding: 32px 0;
      text-align: center;
      border-top: 1px solid var(--cream-dark);
      color: var(--text-light);
      font-size: 0.85rem;
    }
    .site-footer a {
      color: var(--text-light);
      text-decoration: none;
    }
    .site-footer a:hover { color: var(--primary); }
    .powered-by {
      margin-top: 8px;
      font-size: 0.75rem;
      opacity: 0.6;
    }

    /* ─── Chatbot ─── */
    #cb-toggle {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, var(--primary), var(--primary-light));
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      transition: all 0.3s;
      z-index: 1000;
      border: none;
      color: white;
      font-size: 1.5rem;
    }
    #cb-toggle:hover { transform: scale(1.08); }
    #cb-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #E6533C;
      color: white;
      font-size: 0.7rem;
      font-weight: 700;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    #cb-window {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 380px;
      max-height: 520px;
      background: white;
      border-radius: var(--radius-lg);
      box-shadow: 0 8px 48px rgba(0,0,0,0.12);
      display: flex;
      flex-direction: column;
      z-index: 1001;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      transform-origin: bottom right;
    }
    .cb-closed { opacity: 0; transform: scale(0.8) translateY(20px); pointer-events: none; }
    .cb-open { opacity: 1; transform: scale(1) translateY(0); pointer-events: all; }
    #cb-header {
      background: var(--cream);
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--cream-dark);
    }
    #cb-header-name { font-weight: 600; font-size: 0.9rem; color: var(--charcoal); }
    #cb-header-status { font-size: 0.75rem; color: var(--green); }
    #cb-close {
      background: none;
      border: none;
      color: var(--text-light);
      font-size: 1.4rem;
      cursor: pointer;
      padding: 4px 8px;
    }
    #cb-messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 360px;
      min-height: 200px;
      background: var(--cream);
    }
    .cb-msg { display: flex; }
    .cb-bot { justify-content: flex-start; }
    .cb-user { justify-content: flex-end; }
    .cb-bubble {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 0.88rem;
      line-height: 1.6;
    }
    .cb-bubble-bot {
      background: white;
      color: var(--text);
      border: 1px solid var(--cream-dark);
      border-bottom-left-radius: 4px;
    }
    .cb-bubble-user {
      background: var(--primary);
      color: white;
      border-bottom-right-radius: 4px;
    }
    .cb-typing {
      display: flex;
      gap: 4px;
      padding: 12px 16px;
      background: white;
      border: 1px solid var(--cream-dark);
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      max-width: 60px;
    }
    .cb-typing span {
      width: 6px; height: 6px;
      background: var(--text-light);
      border-radius: 50%;
      animation: typing 1.4s ease-in-out infinite;
    }
    .cb-typing span:nth-child(2) { animation-delay: 0.2s; }
    .cb-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typing {
      0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-4px); }
    }
    #cb-input-area {
      padding: 16px;
      background: white;
      border-top: 1px solid var(--cream-dark);
      display: flex;
      gap: 8px;
    }
    #cb-input {
      flex: 1;
      border: 1px solid var(--cream-dark);
      border-radius: var(--radius);
      padding: 10px 16px;
      font-size: 0.88rem;
      font-family: 'DM Sans', sans-serif;
      outline: none;
      transition: border-color 0.2s;
      background: var(--cream);
    }
    #cb-input:focus { border-color: var(--primary); }
    #cb-send {
      width: 42px; height: 42px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: var(--radius);
      font-size: 1.1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #cb-send:hover { background: var(--primary-dark); }

    @media (max-width: 480px) {
      .hero h1 { font-size: 1.5rem; }
      #cb-window {
        width: calc(100vw - 32px);
        right: 16px;
        bottom: 88px;
        max-height: 70vh;
      }
    }
  </style>
</head>
<body>

  <header class="site-header">
    <div class="header-inner">
      <div class="site-name">${name}</div>
      <div class="header-cta">
        ${phone ? `<a href="tel:${phone}" class="btn-call">📞 Call Now</a>` : ''}
        ${whatsapp ? `<a href="https://wa.me/${whatsapp}" target="_blank" rel="noopener" class="btn-call" style="background:#25D366;">💬 WhatsApp</a>` : ''}
      </div>
    </div>
  </header>

  <main>
    <section class="hero">
      <div class="container">
        <h1>${tagline}</h1>
        <p>${description}</p>
        <div class="hero-buttons">
          ${phone ? `<a href="tel:${phone}" class="btn-primary">📞 Call ${phone}</a>` : ''}
          ${whatsapp ? `<a href="https://wa.me/${whatsapp}" target="_blank" rel="noopener" class="btn-primary" style="background:#25D366;">💬 WhatsApp Us</a>` : ''}
          <button class="btn-secondary" onclick="toggleChat()">💬 Chat with us</button>
        </div>
      </div>
    </section>

    ${servicesHtml ? `
    <section class="services">
      <div class="container">
        <h2 class="section-title">Our Services</h2>
        <div class="service-grid">${servicesHtml}</div>
      </div>
    </section>` : ''}

    ${faqHtml ? `
    <section class="faq">
      <div class="container">
        <h2 class="section-title">Common Questions</h2>
        ${faqHtml}
      </div>
    </section>` : ''}

    <section class="contact" id="contact">
      <div class="container">
        <h2 class="section-title">Get in Touch</h2>
        <div class="contact-grid">
          ${phone ? `<a href="tel:${phone}" class="contact-item"><div class="contact-label">Phone</div><div class="contact-value">${phone}</div></a>` : ''}
          ${whatsapp ? `<a href="https://wa.me/${whatsapp}" target="_blank" rel="noopener" class="contact-item"><div class="contact-label">WhatsApp</div><div class="contact-value" style="color:#25D366;">Message Us</div></a>` : ''}
          ${email ? `<a href="mailto:${email}" class="contact-item"><div class="contact-label">Email</div><div class="contact-value">${email}</div></a>` : ''}
          ${location ? `<div class="contact-item"><div class="contact-label">Location</div><div class="contact-value">${location}</div></div>` : ''}
          ${areas ? `<div class="contact-item"><div class="contact-label">Service Area</div><div class="contact-value">${areas}</div></div>` : ''}
          ${hours ? `<div class="contact-item"><div class="contact-label">Hours</div><div class="contact-value">${hours}</div></div>` : ''}
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} ${name}. ${location ? location + '.' : ''}</p>
      <p class="powered-by">Powered by <a href="https://layerops.tech" target="_blank" rel="noopener">LayerOps</a></p>
    </div>
  </footer>

  <!-- Chatbot -->
  <button id="cb-toggle" onclick="toggleChat()">💬<span id="cb-badge">1</span></button>

  <div id="cb-window" class="cb-closed">
    <div id="cb-header">
      <div>
        <div id="cb-header-name">${name}</div>
        <div id="cb-header-status">● Online</div>
      </div>
      <button id="cb-close" onclick="toggleChat()">×</button>
    </div>
    <div id="cb-messages">
      <div class="cb-msg cb-bot"><div class="cb-bubble cb-bubble-bot">${greeting}</div></div>
    </div>
    <div id="cb-input-area">
      <label for="cb-input" style="position:absolute;left:-9999px;">Message</label>
      <input type="text" id="cb-input" placeholder="Ask me anything..." onkeydown="if(event.key==='Enter')sendMsg()">
      <button id="cb-send" onclick="sendMsg()">→</button>
    </div>
  </div>

  <script>
    const CHAT_URL = '${chatEndpoint}';
    let chatOpen = false;
    let badgeShown = true;
    let history = [];

    function toggleChat() {
      chatOpen = !chatOpen;
      const w = document.getElementById('cb-window');
      w.classList.toggle('cb-open', chatOpen);
      w.classList.toggle('cb-closed', !chatOpen);
      if (chatOpen && badgeShown) {
        document.getElementById('cb-badge').style.display = 'none';
        badgeShown = false;
      }
      if (chatOpen) document.getElementById('cb-input').focus();
    }

    async function sendMsg() {
      const input = document.getElementById('cb-input');
      const msg = input.value.trim();
      if (!msg) return;
      input.value = '';
      const messages = document.getElementById('cb-messages');

      history.push({ role: 'user', content: msg });
      if (history.length > 20) history = history.slice(-20);

      const userDiv = document.createElement('div');
      userDiv.className = 'cb-msg cb-user';
      userDiv.innerHTML = '<div class="cb-bubble cb-bubble-user">' + esc(msg) + '</div>';
      messages.appendChild(userDiv);

      const typingDiv = document.createElement('div');
      typingDiv.className = 'cb-msg cb-bot';
      typingDiv.id = 'typing';
      typingDiv.innerHTML = '<div class="cb-typing"><span></span><span></span><span></span></div>';
      messages.appendChild(typingDiv);
      messages.scrollTop = messages.scrollHeight;

      try {
        const resp = await fetch(CHAT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg, history: history }),
        });
        const data = await resp.json();
        const reply = data.reply || "Sorry, I'm having trouble. Please call us directly.";
        history.push({ role: 'assistant', content: reply });
        if (history.length > 20) history = history.slice(-20);

        document.getElementById('typing')?.remove();
        const botDiv = document.createElement('div');
        botDiv.className = 'cb-msg cb-bot';
        botDiv.innerHTML = '<div class="cb-bubble cb-bubble-bot">' + render(reply) + '</div>';
        messages.appendChild(botDiv);
      } catch (e) {
        document.getElementById('typing')?.remove();
        const errDiv = document.createElement('div');
        errDiv.className = 'cb-msg cb-bot';
        errDiv.innerHTML = '<div class="cb-bubble cb-bubble-bot">Sorry, I\\'m having trouble connecting. Please call us directly.</div>';
        messages.appendChild(errDiv);
      }
      messages.scrollTop = messages.scrollHeight;
    }

    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function render(s) {
      let h = esc(s);
      h = h.replace(/\\n/g, '<br>');
      h = h.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
      h = h.replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:underline;">$1</a>');
      return h;
    }
  </script>

</body>
</html>`;
}

// ─── Color helpers ───────────────────────────────────────────────────────────

function hexToHSL(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function lighten(hex) {
  const [h, s, l] = hexToHSL(hex);
  return hslToHex(h, s, Math.min(100, l + 12));
}

function darken(hex) {
  const [h, s, l] = hexToHSL(hex);
  return hslToHex(h, s, Math.max(0, l - 12));
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
