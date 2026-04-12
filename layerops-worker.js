// LayerOps Kestrel Chatbot — Cloudflare Worker
// Proxies to Anthropic API with Cal.com booking tools + Gmail email tools
// PRICING: must match config/services.json — run `node tools/sync-config.js` to verify

const SYSTEM_PROMPT = `You are Kestrel, the AI assistant for LayerOps — an Australian AI implementation consultancy based in Canberra, founded by Jarek Piotrowski.

Your job is to:
1. Answer questions about LayerOps services warmly and helpfully
2. Qualify leads — understand what the visitor's business does and where AI might help them
3. Encourage them to book a free 15-minute chat with Jarek
4. Be honest — if AI probably can't help with something, say so

What LayerOps Does (lead with outcomes, not technology):
1. Never Miss a Customer — AI that answers calls and website enquiries 24/7, captures lead details, and books appointments automatically.
2. Save Hours Every Week — Automate follow-ups, reminders, review requests, and admin.
3. Get Found on Google — SEO fixes so more customers find you.

PRICING — memorise this exactly. Do NOT make up extras or add-ons that aren't listed here:

Starter — from $99/month (free setup, no lock-in):
INCLUDES: Website chatbot, captures enquiries 24/7, books appointments, sends leads to your email, branded to your business, unlimited conversations.
DOES NOT INCLUDE: Voice AI (phone answering).

Professional — from $299/month (free setup, no lock-in):
INCLUDES: Everything in Starter PLUS voice AI receptionist that answers your phone 24/7, booking integration, lead capture with call summaries emailed to you. This is the most popular tier.
DOES NOT INCLUDE: Email triage, review automation, strategy calls.

Operator — from $599/month (free setup, no lock-in):
INCLUDES: Everything in Professional PLUS email triage, daily AI briefing, review automation, appointment reminders, monthly performance report, monthly strategy call with Jarek.

One-off services:
- SEO Quick Fix: $299 — fix your top Google issues.
- Website Build + Chatbot: $499 setup + Starter tier monthly.

Automation add-ons (optional, on top of any tier):
- From $299/month + one-off setup fee. Choose from: email triage, quote follow-up, Google review requests, appointment reminders, daily briefings, client reactivation.
- Only mention add-ons if someone asks about specific automation beyond what their tier includes.

IMPORTANT RULES for quoting pricing:
- Booking/appointment integration is INCLUDED in all tiers. Never say it costs extra.
- Voice AI is INCLUDED in Professional and Operator. Never charge extra for it.
- If unsure about what's included, say "that's included in your plan" or suggest booking a call with Jarek for specifics.
- Never invent services, features, or prices not listed above.
- Always say "from $X/month" — never quote a flat price without "from".
- All prices exclude GST.

When asked about pricing, say something like:
"Most businesses start from $99 a month for a website chatbot that captures enquiries 24/7. If you're missing phone calls, the Professional plan from $299 a month adds a voice AI receptionist that answers every call. Both include booking integration and free setup. Want me to find a time for a quick chat with Jarek?"

About Jarek:
- 20+ years enterprise IT infrastructure experience
- VMware Certified Expert
- Based in Canberra, serves all of Australia
- Background in VMware, NetApp, Hyper-V, cloud migrations, disaster recovery
- Contact: jarek@layerops.tech / 0404 003 240

Your personality:
- Warm, approachable, Australian — like talking to a helpful local
- Concise — keep responses under 3 sentences unless the question needs more
- Not salesy — helpful and honest
- If someone asks something outside your scope, suggest they book a chat with Jarek
- Never make up information about pricing, timelines, or capabilities you don't know
- ONLY quote prices listed above — if unsure, say "prices start from... but Jarek can give you an exact quote"
- Describe services by their outcomes, not the technology. Say "catch every customer enquiry" not "AI chatbot"

Booking Appointments:
- You can check Jarek's availability and book appointments directly in this chat
- When someone wants to book, use the check_availability tool to find open slots
- Default timezone is Australia/Sydney (Canberra time, AEST/AEDT)
- After showing slots, ask the user to pick one and provide their name and email
- The booking is for a free 15-minute introductory chat with Jarek
- If the Cal.com API fails, fall back to suggesting they email jarek@layerops.tech
- Do NOT mention "Cal.com" or "tools" to the user — just present it naturally
- Present times in a readable format like "Tuesday 1 April, 10:00 AM AEST"
- Offer 3-5 time options spread across different days/times, don't overwhelm with too many
- IMPORTANT: When the user has picked a time slot AND provided their name and email, call book_appointment immediately with the matching ISO timestamp from the slots data. Do NOT call check_availability again — use the slot data you already have.
- Only call check_availability once per booking conversation. After that, use the data you received.
- If you need to match the user's chosen time to an ISO timestamp, use the closest matching slot from the availability data.

Email Handling:
- You can check emails, search for specific messages, and send replies on behalf of Jarek
- Always summarise emails concisely — don't dump raw content to the user
- When drafting a reply, show the full draft to the user for approval before sending
- NEVER send an email without the user explicitly confirming the content first
- Be helpful with email triage — flag urgent items, summarise threads, highlight action items
- If email is not configured yet, let the user know gracefully and suggest contacting Jarek directly
- Do NOT mention "Gmail API" or "tools" to the user — just present email actions naturally

Important: You're embedded on the LayerOps website. Visitors are likely Australian small business owners exploring whether AI can help them. Meet them where they are.`;

const TOOLS = [
  {
    name: 'check_availability',
    description: 'Check available appointment slots for booking a free 15-minute call with Jarek. Call this when a user wants to schedule a meeting or book a chat.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date to check availability from, in YYYY-MM-DD format. Defaults to today if not specified.'
        },
        end_date: {
          type: 'string',
          description: 'End date to check availability until, in YYYY-MM-DD format. Defaults to 5 days from start if not specified.'
        }
      },
      required: []
    }
  },
  {
    name: 'book_appointment',
    description: 'Book an appointment slot. Only call this after confirming the time, name, and email with the user.',
    input_schema: {
      type: 'object',
      properties: {
        start_time: {
          type: 'string',
          description: 'The selected slot start time in ISO 8601 format as returned by check_availability (e.g., 2026-04-01T09:00:00+11:00)'
        },
        attendee_name: {
          type: 'string',
          description: 'Full name of the person booking'
        },
        attendee_email: {
          type: 'string',
          description: 'Email address of the person booking'
        }
      },
      required: ['start_time', 'attendee_name', 'attendee_email']
    }
  },
  {
    name: 'check_emails',
    description: 'Read recent inbox emails. Use this when the user asks to check, read, or review their emails.',
    input_schema: {
      type: 'object',
      properties: {
        max_results: {
          type: 'number',
          description: 'Maximum number of emails to retrieve. Defaults to 5.'
        },
        query: {
          type: 'string',
          description: 'Optional Gmail search query to filter emails (e.g., "is:unread", "from:someone@example.com", "subject:invoice").'
        }
      },
      required: []
    }
  },
  {
    name: 'send_email',
    description: 'Send an email or reply to an existing email thread. ONLY call this after the user has explicitly approved the email content.',
    input_schema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address'
        },
        subject: {
          type: 'string',
          description: 'Email subject line'
        },
        body: {
          type: 'string',
          description: 'Plain text email body'
        },
        in_reply_to: {
          type: 'string',
          description: 'Optional Message-ID header value of the email being replied to, for threading.'
        }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'search_emails',
    description: 'Search emails using Gmail query syntax. Use this when the user wants to find specific emails by sender, subject, date, labels, etc.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Gmail search query string (e.g., "from:client@example.com after:2026/01/01", "subject:proposal has:attachment", "is:starred").'
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return. Defaults to 5.'
        }
      },
      required: ['query']
    }
  }
];

const DEFAULT_TIMEZONE = 'Australia/Sydney';

// ─── Cal.com v2 helpers (migrated from v1 on 2026-04-12) ─────────────────

async function checkAvailability(env, startDate, endDate) {
  const params = new URLSearchParams({
    eventTypeId: env.CAL_EVENT_TYPE_ID,
    start: `${startDate}T00:00:00.000Z`,
    end: `${endDate}T23:59:59.999Z`,
    timeZone: DEFAULT_TIMEZONE,
  });

  const resp = await fetch(`https://api.cal.com/v2/slots?${params}`, {
    headers: {
      'Authorization': `Bearer ${env.CAL_COM_API_KEY}`,
      'cal-api-version': '2024-09-04',
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Availability check failed (${resp.status}): ${text}`);
  }
  return resp.json();
}

async function bookAppointment(env, startTime, name, email) {
  const resp = await fetch('https://api.cal.com/v2/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.CAL_COM_API_KEY}`,
      'cal-api-version': '2024-08-13',
    },
    body: JSON.stringify({
      eventTypeId: parseInt(env.CAL_EVENT_TYPE_ID),
      start: startTime,
      attendee: {
        name: name,
        email: email,
        timeZone: DEFAULT_TIMEZONE,
        language: 'en',
      },
      metadata: { source: 'kestrel-chatbot' },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Booking failed (${resp.status}): ${text}`);
  }
  return resp.json();
}

// ─── Gmail helpers ─────────────────────────────────────────────────────────

async function getGmailAccessToken(env) {
  if (!env.GOOGLE_REFRESH_TOKEN || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to get Gmail access token (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  return data.access_token;
}

async function listMessages(accessToken, query, maxResults) {
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (query) {
    params.set('q', query);
  }

  const resp = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gmail list messages failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  return data.messages || [];
}

function base64urlDecode(str) {
  // Gmail API returns base64url-encoded data
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Pad with = to make length a multiple of 4
  while (b64.length % 4 !== 0) {
    b64 += '=';
  }
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function extractBody(payload) {
  // If the payload has parts, look for text/plain
  if (payload.parts && payload.parts.length > 0) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        return base64urlDecode(part.body.data);
      }
    }
    // Recurse into nested parts (e.g., multipart/alternative inside multipart/mixed)
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
  }

  // Fall back to payload.body directly
  if (payload.body && payload.body.data) {
    return base64urlDecode(payload.body.data);
  }

  return '';
}

function getHeader(headers, name) {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : '';
}

async function getMessage(accessToken, messageId) {
  const resp = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gmail get message failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  const headers = data.payload.headers || [];
  const fullBody = extractBody(data.payload);
  const bodyPreview = fullBody.length > 500 ? fullBody.substring(0, 500) + '...' : fullBody;

  return {
    id: data.id,
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    subject: getHeader(headers, 'Subject'),
    date: getHeader(headers, 'Date'),
    snippet: data.snippet || '',
    body_preview: bodyPreview,
    message_id_header: getHeader(headers, 'Message-ID'),
  };
}

function base64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sendMessage(accessToken, to, subject, body, inReplyTo) {
  let mimeLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=UTF-8',
  ];

  if (inReplyTo) {
    mimeLines.push(`In-Reply-To: ${inReplyTo}`);
    mimeLines.push(`References: ${inReplyTo}`);
  }

  // Blank line separates headers from body per RFC 2822
  mimeLines.push('');
  mimeLines.push(body);

  const rawMessage = mimeLines.join('\r\n');
  const encodedMessage = base64urlEncode(rawMessage);

  const resp = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gmail send message failed (${resp.status}): ${text}`);
  }

  return resp.json();
}

// ─── Tool execution router ────────────────────────────────────────────────

async function executeTool(env, toolName, input) {
  // --- Cal.com tools ---
  if (toolName === 'check_availability') {
    const today = new Date().toISOString().split('T')[0];
    const startDate = input.start_date || today;
    const endDefault = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
    const endDate = input.end_date || endDefault;
    const raw = await checkAvailability(env, startDate, endDate);
    // Augment slots with explicit weekday + display string so Claude doesn't
    // hallucinate the wrong day name from ISO dates (bug: showed "Sunday" for a Monday)
    const data = raw.data || raw.slots || raw;
    const augmented = {};
    for (const [date, slots] of Object.entries(data)) {
      augmented[date] = (slots || []).map(s => {
        const d = new Date(s.start);
        const weekday = d.toLocaleDateString('en-AU', { weekday: 'long', timeZone: DEFAULT_TIMEZONE });
        const display = d.toLocaleDateString('en-AU', {
          weekday: 'long', day: 'numeric', month: 'long',
          hour: 'numeric', minute: '2-digit', hour12: true,
          timeZone: DEFAULT_TIMEZONE,
        });
        return { ...s, weekday, display };
      });
    }
    return { data: augmented };
  }

  if (toolName === 'book_appointment') {
    const resp = await bookAppointment(env, input.start_time, input.attendee_name, input.attendee_email);
    // v2 wraps booking in { data: { ... } }
    const result = resp.data || resp;
    return {
      success: true,
      bookingId: result.id,
      title: result.title,
      startTime: result.start || result.startTime,
      endTime: result.end || result.endTime,
      status: result.status,
      videoCallUrl: result.meetingUrl || result.videoCallUrl || null,
      attendeeName: input.attendee_name,
      attendeeEmail: input.attendee_email,
    };
  }

  // --- Gmail tools ---
  if (toolName === 'check_emails') {
    try {
      const accessToken = await getGmailAccessToken(env);
      const maxResults = input.max_results || 5;
      const query = input.query || '';
      const messageList = await listMessages(accessToken, query, maxResults);

      if (messageList.length === 0) {
        return { emails: [], message: 'No emails found matching the criteria.' };
      }

      const emails = await Promise.all(
        messageList.map(msg => getMessage(accessToken, msg.id))
      );
      return { emails };
    } catch (err) {
      if (err.message === 'EMAIL_NOT_CONFIGURED') {
        return { error: 'Email is not configured yet. Please contact Jarek at jarek@layerops.tech to set up email integration.' };
      }
      throw err;
    }
  }

  if (toolName === 'send_email') {
    try {
      const accessToken = await getGmailAccessToken(env);
      const result = await sendMessage(accessToken, input.to, input.subject, input.body, input.in_reply_to || null);
      return {
        success: true,
        messageId: result.id,
        to: input.to,
        subject: input.subject,
      };
    } catch (err) {
      if (err.message === 'EMAIL_NOT_CONFIGURED') {
        return { error: 'Email is not configured yet. Please contact Jarek at jarek@layerops.tech to set up email integration.' };
      }
      throw err;
    }
  }

  if (toolName === 'search_emails') {
    try {
      const accessToken = await getGmailAccessToken(env);
      const maxResults = input.max_results || 5;
      const messageList = await listMessages(accessToken, input.query, maxResults);

      if (messageList.length === 0) {
        return { emails: [], message: 'No emails found matching the search query.' };
      }

      const emails = await Promise.all(
        messageList.map(msg => getMessage(accessToken, msg.id))
      );
      return { emails };
    } catch (err) {
      if (err.message === 'EMAIL_NOT_CONFIGURED') {
        return { error: 'Email is not configured yet. Please contact Jarek at jarek@layerops.tech to set up email integration.' };
      }
      throw err;
    }
  }

  return { error: `Unknown tool: ${toolName}` };
}

function pickOrigin(request) {
  const origin = request?.headers?.get('Origin') || '';
  if (origin === 'https://layerops.tech' || origin.endsWith('.layerops.tech')) return origin;
  return 'https://layerops.tech';
}

function corsJson(body, status = 200, request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': pickOrigin(request),
    },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': pickOrigin(request),
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'POST') {
      return corsJson({ error: 'Method not allowed' }, 405, request);
    }

    try {
      const body = await request.json();
      const { message, history } = body;

      if (!message || typeof message !== 'string' || message.length > 1000) {
        return corsJson({ error: 'Invalid message' }, 400);
      }

      // Build messages from conversation history.
      // Accept both text turns (content is string) and tool-use/tool-result
      // turns (content is array). Dropping tool turns causes Claude to re-call
      // check_availability on every message instead of booking.
      let messages = [];
      if (Array.isArray(history)) {
        for (const h of history.slice(-20)) {
          if (h.role === 'user' || h.role === 'assistant') {
            if (typeof h.content === 'string' || Array.isArray(h.content)) {
              messages.push({ role: h.role, content: h.content });
            }
          }
        }
      }

      // Ensure current message is included
      if (messages.length === 0 || messages[messages.length - 1].content !== message) {
        messages.push({ role: 'user', content: message });
      }

      // Tool use loop — max 5 iterations
      let finalReply = '';
      for (let i = 0; i < 5; i++) {
        const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: SYSTEM_PROMPT + `\n\nIMPORTANT — TODAY'S DATE: ${new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' })} (${new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })}). When using check_availability or book_appointment, ALWAYS use dates from today onwards. Never check past dates.`,
            tools: TOOLS,
            messages: messages,
          }),
        });

        const data = await claudeResp.json();

        if (!data.content || data.content.length === 0) {
          finalReply = "Sorry, I'm having a moment. Try again or reach out to jarek@layerops.tech directly.";
          break;
        }

        // Extract text and tool_use blocks
        const textBlocks = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
        const toolUseBlocks = data.content.filter(b => b.type === 'tool_use');

        if (toolUseBlocks.length === 0) {
          finalReply = textBlocks;
          break;
        }

        // Claude wants to use tool(s) — add its response to messages
        messages.push({ role: 'assistant', content: data.content });

        // Execute all tool calls and collect results
        const toolResults = [];
        for (const toolBlock of toolUseBlocks) {
          let toolResult;
          try {
            toolResult = await executeTool(env, toolBlock.name, toolBlock.input);
          } catch (toolErr) {
            console.error(`Tool error [${toolBlock.name}]:`, toolErr.message);
            toolResult = { error: toolErr.message };
          }
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify(toolResult),
          });
        }

        // Feed all tool results back to Claude
        messages.push({
          role: 'user',
          content: toolResults,
        });
      }

      return corsJson({
        reply: finalReply || "Sorry, something went wrong during the booking process. You can reach Jarek directly at jarek@layerops.tech or 0404 003 240."
      }, 200, request);

    } catch (err) {
      console.error('Worker error:', err.message, err.stack);
      return corsJson({
        reply: "Sorry, something went wrong. You can reach Jarek directly at jarek@layerops.tech or 0404 003 240."
      }, 500, request);
    }
  },
};
