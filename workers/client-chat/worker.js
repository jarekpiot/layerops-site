// LayerOps Multi-Tenant Client Chatbot Worker
// Routes by subdomain: {slug}.layerops.tech → KV config → AI chatbot
// Serves landing page for browser requests, API for chat requests

import { LANDING_HTML } from './landing.js';
import { WIDGET_JS } from './widget.js';

const DEFAULT_TIMEZONE = 'Australia/Sydney';

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

  // Build team info
  const team = config.team || [];
  const teamInfo = team.length > 0
    ? `\nTeam members:\n${team.map((t) => `- ${t.name} — ${t.role}${t.specialties ? ' (specialises in: ' + t.specialties.join(', ') + ')' : ''}${t.calendar ? ' — can book directly' : ''}`).join('\n')}\n\nWhen a customer needs a specific service, route them to the right team member based on their role/specialties. If unsure, offer the general booking or ask what they need help with.`
    : '';

  return `You are a friendly AI assistant for ${config.business_name}. You are embedded on their website to help customers.

Your job is to:
1. Answer questions about ${config.business_name}'s services warmly and helpfully
2. Help potential customers understand what they offer and if it's right for them
3. Encourage them to get in touch — ${config.calendar_link || team.some((t) => t.calendar) ? 'book a time or ' : ''}call/email directly
4. Be honest — if you don't know something specific, suggest they contact the business directly

About ${config.business_name}:
- Business: ${config.business_name}
- Industry: ${config.industry || 'Local business'}
- Location: ${config.location || 'Australia'}
- Service areas: ${areas}
- Phone: ${config.phone || 'Not listed'}
- WhatsApp: ${config.whatsapp ? 'Available — customers can message on WhatsApp at ' + config.phone : 'Not configured'}
- Email: ${config.email || 'Not listed'}
- Hours: ${hours}
${teamInfo}

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
${config.whatsapp ? `- If someone prefers messaging, let them know they can reach the business on WhatsApp at ${config.phone}` : ''}
${config.calendar_link ? `- When someone wants to book an appointment, provide this link: ${config.calendar_link}` : ''}
${team.length > 0 ? `
Booking with team members:
- When someone wants to book, first understand what they need
- Route to the right team member based on what they need and the team member's role/specialties
- Use check_availability with the team member's name to find their open slots
- Book with that specific team member
- If the customer doesn't have a preference, suggest the most appropriate team member
- Tell the customer who they'll be seeing: "I'll book you in with [name], they specialise in [specialty]"` : ''}

Lead capture:
- When a customer provides their name AND phone number or email, ALWAYS call the capture_lead tool to save their details
- Also capture what they need (e.g. "blocked drain", "dental checkup", "quote for renovation")
- After capturing, confirm to the customer: "${config.business_name} will be in touch shortly"
- Don't ask for contact details unprompted — but if they offer them or you're wrapping up a conversation about a job, say "Can I take your name and number so ${config.phone ? 'we can' : 'someone can'} call you back?"

Important: You represent ${config.business_name}. Stay in character. Don't mention LayerOps, AI, or that you're a chatbot unless directly asked.`;
}

// ─── Build tools array based on client config ────────────────────────────────

function buildTools(config) {
  const tools = [
    {
      name: 'capture_lead',
      description: `Save a customer's contact details when they provide their name and phone number or email. Call this whenever a customer shares their contact information during the conversation.`,
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Customer\'s full name' },
          phone: { type: 'string', description: 'Customer\'s phone number (if provided)' },
          email: { type: 'string', description: 'Customer\'s email address (if provided)' },
          enquiry: { type: 'string', description: 'Brief summary of what they need (e.g. "blocked drain in Belconnen", "quote for bathroom reno")' },
          preferred_time: { type: 'string', description: 'When they want the work done or want a callback (if mentioned)' },
          team_member: { type: 'string', description: 'Name of the team member this enquiry is for (if applicable)' },
        },
        required: ['name', 'enquiry'],
      },
    },
  ];

  const hasCalendar = (config.cal_api_key && config.cal_event_type_id) || (config.team || []).some((t) => t.cal_api_key);

  if (hasCalendar) {
    const teamNames = (config.team || []).filter((t) => t.cal_api_key).map((t) => t.name);
    const teamDesc = teamNames.length > 0
      ? ` Specify team_member name to check a specific person's calendar. Available: ${teamNames.join(', ')}.`
      : '';

    tools.push(
      {
        name: 'check_availability',
        description: `Check available appointment slots for booking with ${config.business_name}.${teamDesc}`,
        input_schema: {
          type: 'object',
          properties: {
            start_date: { type: 'string', description: 'Start date in YYYY-MM-DD format. Defaults to today.' },
            end_date: { type: 'string', description: 'End date in YYYY-MM-DD format. Defaults to 5 days from start.' },
            team_member: { type: 'string', description: 'Name of the team member to check availability for. Leave empty for the default/owner calendar.' },
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
            team_member: { type: 'string', description: 'Name of the team member to book with. Leave empty for the default/owner.' },
          },
          required: ['start_time', 'attendee_name', 'attendee_email'],
        },
      },
    );
  }

  // Book transfer tool (for transport/transfer businesses)
  if (config.booking_url || config.industry === 'luxury transport') {
    tools.push({
      name: 'book_transfer',
      description: `Book a transfer or capture booking details. Collect pickup, destination, date, time, passengers, and any special requirements. Call this when you have enough details to confirm a booking.`,
      input_schema: {
        type: 'object',
        properties: {
          customer_name: { type: 'string', description: 'Customer full name' },
          customer_phone: { type: 'string', description: 'Customer phone number' },
          customer_email: { type: 'string', description: 'Customer email (if provided)' },
          pickup: { type: 'string', description: 'Pickup location (e.g. Gold Coast Airport, hotel name, address)' },
          destination: { type: 'string', description: 'Drop-off location' },
          date: { type: 'string', description: 'Transfer date (e.g. 15 April 2026)' },
          time: { type: 'string', description: 'Pickup time (e.g. 2:30 PM)' },
          passengers: { type: 'string', description: 'Number of passengers' },
          luggage: { type: 'string', description: 'Luggage details (e.g. 2 large suitcases)' },
          child_seats: { type: 'string', description: 'Child seat requirements (e.g. 1 child seat, 1 booster)' },
          flight_number: { type: 'string', description: 'Flight number for airport pickups' },
          notes: { type: 'string', description: 'Any special requirements or notes' },
        },
        required: ['customer_name', 'pickup', 'destination', 'date', 'time'],
      },
    });
  }

  return tools;
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

async function captureLead(env, config, input) {
  const leadId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const lead = {
    id: leadId,
    business: config.business_name,
    slug: config.slug,
    name: input.name,
    phone: input.phone || null,
    email: input.email || null,
    enquiry: input.enquiry,
    preferred_time: input.preferred_time || null,
    captured_at: new Date().toISOString(),
  };

  // Store in KV under the client's slug
  if (env.CLIENTS) {
    const leadsKey = `leads:${config.slug}`;
    const existing = await env.CLIENTS.get(leadsKey);
    const leads = existing ? JSON.parse(existing) : [];
    leads.push(lead);
    await env.CLIENTS.put(leadsKey, JSON.stringify(leads), { expirationTtl: 60 * 60 * 24 * 90 });
  }

  // Email the right person — team member or business owner
  if (env.RESEND_API_KEY) {
    try {
      // Find the right recipient
      let notifyEmail = config.email;
      let notifyName = config.business_name;
      if (input.team_member && config.team) {
        const member = config.team.find((t) => t.name.toLowerCase() === input.team_member.toLowerCase());
        if (member && member.email) {
          notifyEmail = member.email;
          notifyName = member.name;
        }
      }

      if (notifyEmail) {
        const contactLine = [
          input.phone ? `Phone: ${input.phone}` : null,
          input.email ? `Email: ${input.email}` : null,
        ].filter(Boolean).join('\n');

        // Send to team member (or owner)
        const recipients = [notifyEmail];
        // CC the owner if sending to a team member
        if (notifyEmail !== config.email && config.email) {
          recipients.push(config.email);
        }

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `${config.business_name} Chatbot <notifications@layerops.tech>`,
            to: recipients,
            subject: `New enquiry: ${input.name} — ${input.enquiry}`,
            text: `New lead from your website chatbot!\n\n${input.team_member ? 'For: ' + notifyName + '\n' : ''}Name: ${input.name}\n${contactLine}\nWhat they need: ${input.enquiry}${input.preferred_time ? '\nPreferred time: ' + input.preferred_time : ''}\n\nThis customer was chatting on your website and left their details. Give them a call to follow up.\n\n— Your AI Assistant`,
          }),
        });
      }
    } catch (err) {
      console.error('Failed to email lead notification:', err.message);
    }
  }

  return {
    success: true,
    message: `Lead captured: ${input.name} — ${input.enquiry}. ${config.email ? 'Notification sent to ' + config.email : 'Stored for follow-up.'}`,
  };
}

async function bookTransfer(env, config, input) {
  const bookingId = 'BK-' + Date.now().toString(36).toUpperCase();
  const booking = {
    id: bookingId,
    business: config.business_name,
    slug: config.slug,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone || null,
    customer_email: input.customer_email || null,
    pickup: input.pickup,
    destination: input.destination,
    date: input.date,
    time: input.time,
    passengers: input.passengers || '1',
    luggage: input.luggage || '',
    child_seats: input.child_seats || 'None',
    flight_number: input.flight_number || '',
    notes: input.notes || '',
    booked_at: new Date().toISOString(),
    source: 'chatbot',
  };

  // Store in KV
  if (env.CLIENTS) {
    const key = `bookings:${config.slug}`;
    const existing = await env.CLIENTS.get(key);
    const bookings = existing ? JSON.parse(existing) : [];
    bookings.push(booking);
    await env.CLIENTS.put(key, JSON.stringify(bookings), { expirationTtl: 60 * 60 * 24 * 90 });
  }

  // Email confirmation to the business
  if (env.RESEND_API_KEY) {
    try {
      const notifyEmail = config.notification_email || config.email;
      const details = [
        `Booking Reference: ${bookingId}`,
        `Customer: ${input.customer_name}`,
        input.customer_phone ? `Phone: ${input.customer_phone}` : null,
        input.customer_email ? `Email: ${input.customer_email}` : null,
        ``,
        `Pickup: ${input.pickup}`,
        `Destination: ${input.destination}`,
        `Date: ${input.date}`,
        `Time: ${input.time}`,
        `Passengers: ${input.passengers || '1'}`,
        input.luggage ? `Luggage: ${input.luggage}` : null,
        input.child_seats && input.child_seats !== 'None' ? `Child Seats: ${input.child_seats}` : null,
        input.flight_number ? `Flight: ${input.flight_number}` : null,
        input.notes ? `Notes: ${input.notes}` : null,
      ].filter(Boolean).join('\n');

      // Email to business owner
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: `${config.business_name} <notifications@layerops.tech>`,
          to: [notifyEmail],
          subject: `New Transfer Booking: ${input.customer_name} — ${input.pickup} to ${input.destination}`,
          text: `New transfer booking from your AI assistant!\n\n${details}\n\nBooked via: ${booking.source}\nTime: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}\n\n— ${config.business_name} AI Assistant`,
        }),
      });

      // Confirmation email to customer (if email provided)
      if (input.customer_email) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
          body: JSON.stringify({
            from: `${config.business_name} <notifications@layerops.tech>`,
            to: [input.customer_email],
            subject: `Booking Confirmed — ${config.business_name} (Ref: ${bookingId})`,
            text: `Hi ${input.customer_name},\n\nYour transfer has been booked!\n\n${details}\n\nIf you need to make any changes, please contact us.\n\nThank you for choosing ${config.business_name}.\n\n— The ${config.business_name} Team`,
          }),
        });
      }
    } catch (err) {
      console.error('Failed to send booking email:', err.message);
    }
  }

  return {
    success: true,
    booking_id: bookingId,
    message: `Transfer booked! Reference: ${bookingId}. ${input.pickup} to ${input.destination} on ${input.date} at ${input.time}. ${input.customer_email ? 'Confirmation email sent.' : 'We\'ll be in touch to confirm.'}`,
  };
}

// Resolve calendar credentials — team member or default
function resolveCalConfig(config, teamMemberName) {
  if (teamMemberName && config.team) {
    const member = config.team.find((t) =>
      t.name.toLowerCase() === teamMemberName.toLowerCase()
    );
    if (member && member.cal_api_key) {
      return {
        cal_api_key: member.cal_api_key,
        cal_event_type_id: member.cal_event_type_id,
        timezone: member.timezone || config.timezone,
        name: member.name,
        email: member.email,
      };
    }
  }
  // Fall back to default business calendar
  return {
    cal_api_key: config.cal_api_key,
    cal_event_type_id: config.cal_event_type_id,
    timezone: config.timezone,
    name: config.business_name,
    email: config.email,
  };
}

async function executeTool(env, config, toolName, input) {
  if (toolName === 'capture_lead') {
    return await captureLead(env, config, input);
  }
  if (toolName === 'check_availability') {
    const calConfig = resolveCalConfig(config, input.team_member);
    if (!calConfig.cal_api_key) {
      return { error: 'No calendar configured' + (input.team_member ? ' for ' + input.team_member : '') };
    }
    const today = new Date().toISOString().split('T')[0];
    const startDate = input.start_date || today;
    const endDefault = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
    const result = await checkAvailability(calConfig, startDate, input.end_date || endDefault);
    return { ...result, team_member: calConfig.name };
  }
  if (toolName === 'book_appointment') {
    const calConfig = resolveCalConfig(config, input.team_member);
    if (!calConfig.cal_api_key) {
      return { error: 'No calendar configured' + (input.team_member ? ' for ' + input.team_member : '') };
    }
    const result = await bookAppointment(calConfig, input.start_time, input.attendee_name, input.attendee_email);
    return {
      success: true,
      bookingId: result.id,
      title: result.title,
      startTime: result.startTime,
      endTime: result.endTime,
      status: result.status,
      booked_with: calConfig.name,
    };
  }
  if (toolName === 'book_transfer') {
    return await bookTransfer(env, config, input);
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
    apiBody.tools = tools;

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
      toolResult = await executeTool(env, config, toolUseBlock.name, toolUseBlock.input);
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

// ─── Bookings dashboard ────────────────────────────────────────────────────

async function handleBookingsDashboard(env, config) {
  const primary = config.brand_color || '#C4A265';
  const name = esc(config.business_name || 'Business');

  // Load bookings from KV
  let bookings = [];
  if (env.CLIENTS) {
    const raw = await env.CLIENTS.get(`bookings:${config.slug}`);
    if (raw) bookings = JSON.parse(raw);
  }

  // Sort newest first
  bookings.sort((a, b) => new Date(b.booked_at || b.timestamp || 0) - new Date(a.booked_at || a.timestamp || 0));

  const statusColor = (s) => {
    if (s === 'paid') return '#4A7C59';
    if (s === 'driver_assigned') return '#3d8a9c';
    if (s === 'completed') return '#8a8070';
    return '#C4A265'; // awaiting
  };

  const statusLabel = (s) => {
    if (s === 'paid') return 'PAID';
    if (s === 'driver_assigned') return 'DRIVER ASSIGNED';
    if (s === 'completed') return 'COMPLETED';
    return 'AWAITING PAYMENT';
  };

  const bookingsHtml = bookings.length === 0
    ? '<div style="text-align:center;color:#8a8070;padding:40px;">No bookings yet. Make a test booking to see it here.</div>'
    : bookings.map(b => {
      const ref = esc(b.bookingId || b.id || '?');
      const status = b.paymentStatus || 'awaiting';
      return `
      <div class="booking" id="bk-${ref}">
        <div class="bk-header">
          <div>
            <div class="bk-ref" style="color:${primary};">${ref}</div>
            <div class="bk-status" style="color:${statusColor(status)};">${statusLabel(status)}</div>
          </div>
          <div class="bk-date">${esc(b.date || '')} ${esc(b.time || '')}</div>
        </div>
        <div class="bk-route">
          <div class="bk-point"><span class="bk-dot" style="background:#4A7C59;"></span>${esc(b.pickup || '?')}</div>
          <div class="bk-arrow">&darr;</div>
          <div class="bk-point"><span class="bk-dot" style="background:${primary};"></span>${esc(b.destination || '?')}</div>
        </div>
        <div class="bk-details">
          <div><span class="bk-label">Customer:</span> ${esc(b.customer_name || '?')}</div>
          <div><span class="bk-label">Phone:</span> ${esc(b.customer_phone || 'N/A')}</div>
          <div><span class="bk-label">Email:</span> ${esc(b.customer_email || 'N/A')}</div>
          <div><span class="bk-label">Passengers:</span> ${esc(b.passengers || '?')}</div>
          ${b.child_seats && b.child_seats !== 'None' ? `<div><span class="bk-label">Child Seats:</span> ${esc(b.child_seats)}</div>` : ''}
          ${b.flight_number ? `<div><span class="bk-label">Flight:</span> ${esc(b.flight_number)}</div>` : ''}
          ${b.notes ? `<div><span class="bk-label">Notes:</span> ${esc(b.notes)}</div>` : ''}
          <div><span class="bk-label">Source:</span> ${esc(b.source || 'chatbot')}</div>
          <div><span class="bk-label">Booked:</span> ${esc(b.booked_at || b.timestamp || '?')}</div>
          ${b.paidAt ? `<div><span class="bk-label">Paid:</span> ${esc(b.paidAt)}</div>` : ''}
        </div>
        ${status === 'paid' ? `
        <div class="bk-assign">
          <div style="font-size:12px;color:${primary};font-weight:600;margin-bottom:8px;">ASSIGN DRIVER</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <input type="text" id="driver-${ref}" class="bk-input" placeholder="Driver name">
            <input type="text" id="rego-${ref}" class="bk-input" placeholder="Rego (e.g. ABC123)">
          </div>
          <input type="text" id="vehicle-${ref}" class="bk-input" placeholder="Vehicle (e.g. Silver Mercedes E-Class)" style="margin-top:8px;">
          <button class="bk-btn" onclick="assignDriver('${ref}')">Assign Driver &amp; Notify Customer</button>
        </div>` : ''}
        ${status === 'driver_assigned' ? `
        <div class="bk-assigned">
          <div style="font-size:12px;color:#3d8a9c;font-weight:600;">DRIVER ASSIGNED</div>
          <div style="font-size:13px;color:#e8e0d0;margin-top:4px;">${esc(b.driverName || '')} — ${esc(b.vehicle || '')} (${esc(b.rego || '')})</div>
        </div>` : ''}
      </div>`;
    }).join('');

  const html = `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Bookings — ${name}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'DM Sans',sans-serif;background:#0a0a0f;color:#e8e0d0;padding:16px;max-width:700px;margin:0 auto}
    h1{font-family:'Playfair Display',serif;color:${primary};font-size:20px;margin-bottom:4px}
    .sub{color:#8a8070;font-size:12px;margin-bottom:20px}
    .booking{background:#14141f;border:1px solid #1e1e2e;border-radius:12px;padding:20px;margin-bottom:16px}
    .bk-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
    .bk-ref{font-family:'Playfair Display',serif;font-size:1rem;font-weight:600}
    .bk-status{font-size:0.7rem;font-weight:700;letter-spacing:1px;margin-top:2px}
    .bk-date{color:#8a8070;font-size:0.85rem;text-align:right}
    .bk-route{padding:12px 0;border-top:1px solid #1e1e2e;border-bottom:1px solid #1e1e2e;margin-bottom:12px}
    .bk-point{display:flex;align-items:center;gap:8px;font-size:0.9rem;padding:4px 0}
    .bk-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
    .bk-arrow{color:#555;font-size:14px;padding-left:3px}
    .bk-details{font-size:0.82rem;line-height:2;color:#aaa}
    .bk-label{color:#8a8070}
    .bk-assign{margin-top:16px;padding-top:16px;border-top:1px solid #1e1e2e}
    .bk-assigned{margin-top:16px;padding:12px;background:rgba(61,138,156,0.08);border:1px solid rgba(61,138,156,0.2);border-radius:8px}
    .bk-input{width:100%;padding:10px;background:#0a0a0f;border:1px solid #1e1e2e;border-radius:6px;color:#e8e0d0;font-size:0.85rem;font-family:inherit;outline:none}
    .bk-input:focus{border-color:${primary}}
    .bk-input::placeholder{color:#555}
    .bk-btn{width:100%;margin-top:8px;padding:12px;background:${primary};color:#0a0a0f;border:none;border-radius:6px;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit}
    .bk-btn:hover{opacity:0.9}
    .bk-btn:disabled{background:#555;cursor:not-allowed}
    .refresh{color:${primary};font-size:12px;cursor:pointer;text-decoration:none}
    .topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
    .back{color:#8a8070;font-size:12px;text-decoration:none}
    .count{background:${primary};color:#0a0a0f;padding:2px 10px;border-radius:100px;font-size:12px;font-weight:600}
  </style>
</head>
<body>
  <div class="topbar">
    <div>
      <h1>${name}</h1>
      <div class="sub">Bookings Dashboard <span class="count">${bookings.length}</span></div>
    </div>
    <div>
      <a href="/bookings" class="refresh">Refresh</a>
      &nbsp;&middot;&nbsp;
      <a href="/" class="back">Landing Page</a>
    </div>
  </div>
  ${bookingsHtml}
  <script>
  async function assignDriver(ref) {
    const driver = document.getElementById('driver-' + ref).value.trim();
    const rego = document.getElementById('rego-' + ref).value.trim();
    const vehicle = document.getElementById('vehicle-' + ref).value.trim();
    if (!driver || !vehicle) { alert('Please enter driver name and vehicle'); return; }
    const btn = document.querySelector('#bk-' + ref + ' .bk-btn');
    btn.textContent = 'Assigning...'; btn.disabled = true;
    try {
      await fetch('/bookings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref, driverName: driver, rego, vehicle })
      });
      location.reload();
    } catch(e) { alert('Failed — try again'); btn.textContent = 'Assign Driver'; btn.disabled = false; }
  }
  </script>
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}

async function handleBookingUpdate(request, env, config) {
  const body = await request.json();
  const { ref, driverName, rego, vehicle } = body;
  const origin = request.headers.get('origin');

  let booking = {};
  if (env.CLIENTS) {
    const raw = await env.CLIENTS.get(`bookings:${config.slug}`);
    if (raw) {
      const bookings = JSON.parse(raw);
      const idx = bookings.findIndex(b => b.bookingId === ref || b.id === ref);
      if (idx !== -1) {
        bookings[idx].paymentStatus = 'driver_assigned';
        bookings[idx].driverName = driverName;
        bookings[idx].rego = rego;
        bookings[idx].vehicle = vehicle;
        bookings[idx].driverAssignedAt = new Date().toISOString();
        booking = bookings[idx];
        await env.CLIENTS.put(`bookings:${config.slug}`, JSON.stringify(bookings), { expirationTtl: 60 * 60 * 24 * 90 });
      }
    }
  }

  // Email customer with driver details
  if (env.RESEND_API_KEY && booking.customer_email) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: `${config.business_name} <notifications@layerops.tech>`,
          to: [booking.customer_email],
          subject: `Your Driver Details — ${config.business_name} (Ref: ${ref})`,
          text: `Hi ${booking.customer_name},\n\nGreat news — your driver has been assigned!\n\nDriver: ${driverName}\nVehicle: ${vehicle}${rego ? ' (' + rego + ')' : ''}\n\nTransfer Details:\nPickup: ${booking.pickup}\nDestination: ${booking.destination}\nDate: ${booking.date}\nTime: ${booking.time}\n\nYour driver will call you the evening before to confirm pickup details.\n\nSee you soon!\n— The ${config.business_name} Team`
        })
      });
    } catch (err) { console.error('Driver assign email failed:', err); }
  }

  // Email Aaron confirmation
  if (env.RESEND_API_KEY) {
    const notifyTo = config.notification_email || config.email;
    const notifyCc = config.notification_cc;
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: `${config.business_name} <notifications@layerops.tech>`,
          to: [notifyTo],
          cc: notifyCc ? [notifyCc] : undefined,
          subject: `Driver Assigned: ${driverName} → ${booking.customer_name} (${ref})`,
          text: `Driver assigned for booking ${ref}.\n\nDriver: ${driverName}\nVehicle: ${vehicle}${rego ? ' (' + rego + ')' : ''}\n\nCustomer: ${booking.customer_name}\nPickup: ${booking.pickup}\nDestination: ${booking.destination}\nDate: ${booking.date}\nTime: ${booking.time}\n\nCustomer has been notified by email.\n\n— ${config.business_name} AI`
        })
      });
    } catch (err) { console.error('Driver assign notify failed:', err); }
  }

  return corsJson({ success: true }, 200, origin);
}

// ─── Payment page ──────────────────────────────────────────────────────────

async function handlePaymentPage(url, env, config) {
  const ref = url.searchParams.get('ref') || 'Unknown';
  const name = config.business_name || 'Business';
  const primary = config.brand_color || '#2B6777';

  // Try to look up booking from KV
  let booking = {};
  try {
    if (env.CLIENTS) {
      const raw = await env.CLIENTS.get(`bookings:${config.slug}`);
      if (raw) {
        const bookings = JSON.parse(raw);
        booking = bookings.find(b => b.bookingId === ref || b.id === ref) || {};
      }
    }
  } catch (err) {
    console.error('Booking lookup failed:', err);
  }

  const html = `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete Payment — ${esc(name)}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'DM Sans',sans-serif;background:#0a0a0f;color:#e8e0d0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#14141f;border:1px solid #1e1e2e;border-radius:16px;max-width:480px;width:100%;padding:40px 32px;text-align:center}
    .logo{font-family:'Playfair Display',serif;font-size:1.2rem;color:${primary};margin-bottom:24px}
    h1{font-family:'Playfair Display',serif;font-size:1.5rem;color:#f5f0e8;margin-bottom:8px}
    .ref{color:${primary};font-size:0.85rem;margin-bottom:24px}
    .details{text-align:left;background:#0a0a0f;border:1px solid #1e1e2e;border-radius:10px;padding:20px;margin-bottom:24px;font-size:0.9rem;line-height:2}
    .label{color:#8a8070;font-size:0.8rem}
    .amount{font-family:'Playfair Display',serif;font-size:2rem;color:${primary};margin-bottom:8px}
    .amount-note{color:#8a8070;font-size:0.8rem;margin-bottom:24px}
    .btn-pay{background:${primary};color:#0a0a0f;border:none;padding:16px 40px;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;width:100%;transition:all 0.2s;font-family:inherit}
    .btn-pay:hover{opacity:0.9}
    .btn-pay:disabled{background:#555;cursor:not-allowed}
    .secure{color:#8a8070;font-size:0.75rem;margin-top:16px}
    .success{display:none}
    .success h2{font-family:'Playfair Display',serif;color:#4A7C59;font-size:1.4rem;margin:16px 0 8px}
    .success p{color:#8a8070;font-size:0.9rem;line-height:1.7}
    .tick{font-size:3rem}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">${esc(name)}</div>
    <div id="pay-form">
      <h1>Complete Your Payment</h1>
      <div class="ref">Ref: ${esc(ref)}</div>
      <div class="details">
        ${booking.pickup ? `<div><span class="label">Pickup:</span> ${esc(booking.pickup)}</div>` : ''}
        ${booking.destination ? `<div><span class="label">Destination:</span> ${esc(booking.destination)}</div>` : ''}
        ${booking.date ? `<div><span class="label">Date:</span> ${esc(booking.date)}</div>` : ''}
        ${booking.time ? `<div><span class="label">Time:</span> ${esc(booking.time)}</div>` : ''}
        ${booking.passengers ? `<div><span class="label">Passengers:</span> ${esc(booking.passengers)}</div>` : ''}
        ${booking.customer_name ? `<div><span class="label">Name:</span> ${esc(booking.customer_name)}</div>` : ''}
      </div>
      <div class="amount">$250.00</div>
      <div class="amount-note">Demo payment — no real charge</div>
      <button class="btn-pay" id="pay-btn" onclick="pay()">Pay Now</button>
      <div class="secure">Secure payment (demo)</div>
    </div>
    <div class="success" id="pay-success">
      <div class="tick">&#10003;</div>
      <h2>Payment Confirmed!</h2>
      <p>Your transfer is fully confirmed. A driver will be assigned and will call you the evening before to confirm pickup details.</p>
      <p style="margin-top:16px;color:${primary};font-size:0.85rem;">Ref: ${esc(ref)}</p>
    </div>
  </div>
  <script>
  async function pay(){
    const btn=document.getElementById('pay-btn');btn.textContent='Processing...';btn.disabled=true;
    try{await fetch('/pay-confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:'${ref}'})})}catch(e){}
    document.getElementById('pay-form').style.display='none';
    document.getElementById('pay-success').style.display='block';
  }
  </script>
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}

async function handlePaymentConfirm(request, env, config) {
  const body = await request.json();
  const ref = body.ref;
  const origin = request.headers.get('origin');

  // Find booking in KV
  let booking = {};
  if (env.CLIENTS) {
    const raw = await env.CLIENTS.get(`bookings:${config.slug}`);
    if (raw) {
      const bookings = JSON.parse(raw);
      const idx = bookings.findIndex(b => b.bookingId === ref || b.id === ref);
      if (idx !== -1) {
        booking = bookings[idx];
        bookings[idx].paymentStatus = 'paid';
        bookings[idx].paidAt = new Date().toISOString();
        await env.CLIENTS.put(`bookings:${config.slug}`, JSON.stringify(bookings), { expirationTtl: 60 * 60 * 24 * 90 });
      }
    }
  }

  const notifyTo = config.notification_email || config.email;
  const notifyCc = config.notification_cc;

  if (env.RESEND_API_KEY) {
    try {
      // Email business: payment received
      const emailTo = [notifyTo];
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: `${config.business_name} <notifications@layerops.tech>`,
          to: emailTo,
          cc: notifyCc ? [notifyCc] : undefined,
          subject: `Payment Received: ${booking.customer_name || 'Customer'} — ${ref}`,
          text: `Payment confirmed for booking ${ref}.\n\nCustomer: ${booking.customer_name || 'N/A'}\nPhone: ${booking.customer_phone || 'N/A'}\nEmail: ${booking.customer_email || 'N/A'}\nPickup: ${booking.pickup || 'N/A'}\nDestination: ${booking.destination || 'N/A'}\nDate: ${booking.date || 'N/A'}\nTime: ${booking.time || 'N/A'}\nPassengers: ${booking.passengers || 'N/A'}\n\nPlease assign a driver. The customer has been told their driver will call the evening before.\n\n— ${config.business_name} AI`
        })
      });

      // Email customer: payment confirmed
      if (booking.customer_email) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
          body: JSON.stringify({
            from: `${config.business_name} <notifications@layerops.tech>`,
            to: [booking.customer_email],
            subject: `Payment Confirmed — Your Transfer is Locked In (Ref: ${ref})`,
            text: `Hi ${booking.customer_name},\n\nThank you — your payment has been received!\n\nBooking: ${ref}\nPickup: ${booking.pickup}\nDestination: ${booking.destination}\nDate: ${booking.date}\nTime: ${booking.time}\n\nWhat happens next:\n- A driver will be assigned to your booking\n- Your driver will call you the evening before to confirm pickup details\n- On the day, your driver will be there right on time in a Mercedes\n\nIf you need changes, reply to this email.\n\nSee you soon!\n— The ${config.business_name} Team`
          })
        });
      }
    } catch (err) { console.error('Payment email failed:', err); }
  }

  return corsJson({ success: true }, 200, origin);
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

    // Payment confirmation (POST)
    if (url.pathname === '/pay-confirm' && request.method === 'POST') {
      return handlePaymentConfirm(request, env, config);
    }

    // POST = chat API (default POST handler)
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

    // Mock payment page
    if (url.pathname === '/pay' && request.method === 'GET') {
      return handlePaymentPage(url, env, config);
    }

    // Bookings dashboard
    if (url.pathname === '/bookings' && request.method === 'GET') {
      return handleBookingsDashboard(env, config);
    }

    // Update booking (assign driver)
    if (url.pathname === '/bookings/update' && request.method === 'POST') {
      return handleBookingUpdate(request, env, config);
    }

    // GET = serve landing page (custom HTML if set, otherwise generated)
    if (request.method === 'GET') {
      // Check for custom landing page HTML in KV
      const customHtml = await env.CLIENTS.get(slug + ':landing');
      if (customHtml) {
        return new Response(customHtml, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
      }
      return serveLanding(config);
    }

    return corsJson({ error: 'Method not allowed' }, 405);
  },
};
