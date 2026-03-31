// LayerOps Multi-Tenant Client Chatbot Worker
// Routes by subdomain: {slug}.layerops.tech → KV config → AI chatbot
// Serves landing page for browser requests, API for chat requests

import { LANDING_HTML } from './landing.js';
import { WIDGET_JS } from './widget.js';

const DEFAULT_TIMEZONE = 'Australia/Sydney';

// ─── Subdomain extraction ────────────────────────────────────────────────────

function getSlug(request) {
  const host = request.headers.get('host') || '';
  // Match {slug}.layerops.tech but not www, api, audit, demo
  const match = host.match(/^([a-z0-9-]+)\.layerops\.tech$/i);
  if (!match) return null;
  const slug = match[1].toLowerCase();
  if (['www', 'api', 'audit', 'layerops-site'].includes(slug)) return null;
  return slug;
}

// ─── Build system prompt from client config ──────────────────────────────────

function buildSystemPrompt(config) {
  const services = (config.services || [])
    .map((s, i) => `${i + 1}. ${s.name}${s.price ? ` — ${s.price}` : ''}${s.description ? `: ${s.description}` : ''}`)
    .join('\n');

  const faq = (config.faq || [])
    .map((f) => `Q: ${f.q}\nA: ${f.a}`)
    .join('\n\n');

  const hours = config.hours || 'Contact us for availability';
  const areas = Array.isArray(config.service_area) ? config.service_area.join(', ') : (config.service_area || 'Local area');

  return `You are a friendly AI assistant for ${config.business_name}. You are embedded on their website to help customers.

Your job is to:
1. Answer questions about ${config.business_name}'s services warmly and helpfully
2. Help potential customers understand what they offer and if it's right for them
3. Encourage them to get in touch — ${config.calendar_link ? 'book a time or ' : ''}call/email directly
4. Be honest — if you don't know something specific, suggest they contact the business directly

About ${config.business_name}:
- Business: ${config.business_name}
- Industry: ${config.industry || 'Local business'}
- Location: ${config.location || 'Australia'}
- Service areas: ${areas}
- Phone: ${config.phone || 'Not listed'}
- Email: ${config.email || 'Not listed'}
- Hours: ${hours}

Services:
${services || 'Contact us for details on what we offer.'}

${faq ? `Frequently Asked Questions:\n${faq}` : ''}

${config.custom_instructions || ''}

Your personality:
- Warm, approachable, Australian — like talking to a helpful local
- Concise — keep responses under 3 sentences unless the question needs more
- Not salesy — helpful and honest
- Never make up information about pricing, timelines, or capabilities you don't know
- If someone asks something you can't answer, suggest they call ${config.phone || 'the business'} or email ${config.email || 'them directly'}
${config.calendar_link ? `- When someone wants to book an appointment, provide this link: ${config.calendar_link}` : ''}

Important: You represent ${config.business_name}. Stay in character. Don't mention LayerOps, AI, or that you're a chatbot unless directly asked.`;
}

// ─── Build tools array based on client config ────────────────────────────────

function buildTools(config) {
  if (!config.cal_api_key || !config.cal_event_type_id) return [];
  return [
    {
      name: 'check_availability',
      description: `Check available appointment slots for booking with ${config.business_name}.`,
      input_schema: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'Start date in YYYY-MM-DD format. Defaults to today.' },
          end_date: { type: 'string', description: 'End date in YYYY-MM-DD format. Defaults to 5 days from start.' },
        },
        required: [],
      },
    },
    {
      name: 'book_appointment',
      description: 'Book an appointment. Only call after confirming time, name, and email.',
      input_schema: {
        type: 'object',
        properties: {
          start_time: { type: 'string', description: 'Selected slot ISO 8601 start time' },
          attendee_name: { type: 'string', description: 'Full name of person booking' },
          attendee_email: { type: 'string', description: 'Email of person booking' },
        },
        required: ['start_time', 'attendee_name', 'attendee_email'],
      },
    },
  ];
}

// ─── Cal.com helpers ─────────────────────────────────────────────────────────

async function checkAvailability(config, startDate, endDate) {
  const params = new URLSearchParams({
    apiKey: config.cal_api_key,
    eventTypeId: config.cal_event_type_id,
    startTime: `${startDate}T00:00:00Z`,
    endTime: `${endDate}T23:59:59Z`,
    timeZone: config.timezone || DEFAULT_TIMEZONE,
  });
  const resp = await fetch(`https://api.cal.com/v1/slots?${params}`);
  if (!resp.ok) throw new Error(`Availability check failed (${resp.status})`);
  return resp.json();
}

async function bookAppointment(config, startTime, name, email) {
  const resp = await fetch(`https://api.cal.com/v1/bookings?apiKey=${config.cal_api_key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventTypeId: parseInt(config.cal_event_type_id),
      start: startTime,
      responses: { name, email, location: { optionValue: '', value: 'integrations:daily' } },
      timeZone: config.timezone || DEFAULT_TIMEZONE,
      language: 'en',
      metadata: { source: `kestrel-${config.slug}` },
    }),
  });
  if (!resp.ok) throw new Error(`Booking failed (${resp.status})`);
  return resp.json();
}

async function executeTool(config, toolName, input) {
  if (toolName === 'check_availability') {
    const today = new Date().toISOString().split('T')[0];
    const startDate = input.start_date || today;
    const endDefault = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
    return await checkAvailability(config, startDate, input.end_date || endDefault);
  }
  if (toolName === 'book_appointment') {
    const result = await bookAppointment(config, input.start_time, input.attendee_name, input.attendee_email);
    return {
      success: true,
      bookingId: result.id,
      title: result.title,
      startTime: result.startTime,
      endTime: result.endTime,
      status: result.status,
    };
  }
  return { error: `Unknown tool: ${toolName}` };
}

// ─── CORS helper ─────────────────────────────────────────────────────────────

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function corsJson(body, status = 200, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

// ─── Chat handler ────────────────────────────────────────────────────────────

async function handleChat(request, env, config) {
  const body = await request.json();
  const { message, history } = body;
  const origin = request.headers.get('origin');

  if (!message || typeof message !== 'string' || message.length > 2000) {
    return corsJson({ error: 'Invalid message' }, 400, origin);
  }

  const systemPrompt = buildSystemPrompt(config);
  const tools = buildTools(config);

  let messages = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-20)) {
      if ((h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string') {
        messages.push({ role: h.role, content: h.content });
      }
    }
  }
  if (messages.length === 0 || messages[messages.length - 1].content !== message) {
    messages.push({ role: 'user', content: message });
  }

  let finalReply = '';
  for (let i = 0; i < 5; i++) {
    const apiBody = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    };
    if (tools.length > 0) apiBody.tools = tools;

    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(apiBody),
    });

    const data = await claudeResp.json();
    if (!claudeResp.ok) {
      console.error('Claude API error:', claudeResp.status, JSON.stringify(data));
      finalReply = `Sorry, I'm having a moment. Please call ${config.phone || 'us'} directly.`;
      break;
    }
    if (!data.content || data.content.length === 0) {
      console.error('Claude returned empty content:', JSON.stringify(data));
      finalReply = `Sorry, I'm having a moment. Please call ${config.phone || 'us'} directly.`;
      break;
    }

    const textBlocks = data.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const toolUseBlock = data.content.find((b) => b.type === 'tool_use');

    if (!toolUseBlock) {
      finalReply = textBlocks;
      break;
    }

    messages.push({ role: 'assistant', content: data.content });

    let toolResult;
    try {
      toolResult = await executeTool(config, toolUseBlock.name, toolUseBlock.input);
    } catch (e) {
      toolResult = { error: e.message };
    }

    messages.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: JSON.stringify(toolResult) }],
    });
  }

  return corsJson({
    reply: finalReply || `Sorry, something went wrong. Please contact ${config.phone || config.email || 'us'} directly.`,
  }, 200, origin);
}

// ─── Landing page renderer ───────────────────────────────────────────────────

function serveLanding(config) {
  const html = LANDING_HTML(config);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}

// ─── Widget JS server ────────────────────────────────────────────────────────

function serveWidget(config) {
  const js = WIDGET_JS(config);
  return new Response(js, {
    headers: {
      'Content-Type': 'application/javascript',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

// ─── Worker entry point ──────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request.headers.get('origin')) });
    }

    // Widget endpoint: /widget/{slug}
    const widgetMatch = url.pathname.match(/^\/widget\/([a-z0-9-]+)$/i);
    if (widgetMatch) {
      const slug = widgetMatch[1].toLowerCase();
      const configRaw = await env.CLIENTS.get(slug);
      if (!configRaw) {
        return new Response('// Client not found', { status: 404, headers: { 'Content-Type': 'application/javascript' } });
      }
      return serveWidget(JSON.parse(configRaw));
    }

    // Subdomain routing
    const slug = getSlug(request);
    if (!slug) {
      // Not a client subdomain — redirect to main site
      return Response.redirect('https://layerops.tech', 302);
    }

    // Look up client config in KV
    const configRaw = await env.CLIENTS.get(slug);
    if (!configRaw) {
      return Response.redirect('https://layerops.tech', 302);
    }

    const config = JSON.parse(configRaw);
    config.slug = slug;

    // POST = chat API
    if (request.method === 'POST') {
      try {
        return await handleChat(request, env, config);
      } catch (err) {
        console.error('Chat error:', err.message, err.stack);
        return corsJson({
          reply: `Sorry, something went wrong. Please contact ${config.phone || config.email || 'us'} directly.`,
        }, 500, request.headers.get('origin'));
      }
    }

    // GET = serve landing page
    if (request.method === 'GET') {
      return serveLanding(config);
    }

    return corsJson({ error: 'Method not allowed' }, 405);
  },
};
