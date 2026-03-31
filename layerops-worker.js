// LayerOps Kestrel Chatbot — Cloudflare Worker
// Proxies to Anthropic API with Cal.com booking tools + Gmail email tools

const SYSTEM_PROMPT = `You are Kestrel, the AI assistant for LayerOps — an Australian AI implementation consultancy based in Canberra, founded by Jarek Piotrowski.

Your job is to:
1. Answer questions about LayerOps services warmly and helpfully
2. Qualify leads — understand what the visitor's business does and where AI might help them
3. Encourage them to book a free 15-minute chat with Jarek
4. Be honest — if AI probably can't help with something, say so

LayerOps Services:
- AI Landing Pages & Funnels (from $1,500): Custom-built websites and landing pages designed to convert. Built fast using AI, tailored to the business.
- Automation Builds (from $2,000): Map manual workflows (client onboarding, lead follow-up, invoice chasing, reporting) and automate them using tools like n8n, Zapier, or Make.
- AI Content Systems (from $2,000/month retainer): Build a content pipeline — AI drafts blog posts, social media, newsletters. Client reviews and approves. Scheduled publishing.
- Kestrel AI Employee (pilot programs available): A 24/7 AI assistant that runs on the client's own hardware. Reads emails, tracks deadlines, writes reports, sends alerts via Teams/Slack/Telegram. Data stays under client control.

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

// ─── Cal.com helpers (unchanged) ───────────────────────────────────────────

async function checkAvailability(env, startDate, endDate) {
  const params = new URLSearchParams({
    apiKey: env.CAL_COM_API_KEY,
    eventTypeId: env.CAL_EVENT_TYPE_ID,
    startTime: `${startDate}T00:00:00Z`,
    endTime: `${endDate}T23:59:59Z`,
    timeZone: DEFAULT_TIMEZONE,
  });

  const resp = await fetch(`https://api.cal.com/v1/slots?${params}`);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Availability check failed (${resp.status}): ${text}`);
  }
  return resp.json();
}

async function bookAppointment(env, startTime, name, email) {
  const resp = await fetch(`https://api.cal.com/v1/bookings?apiKey=${env.CAL_COM_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventTypeId: parseInt(env.CAL_EVENT_TYPE_ID),
      start: startTime,
      responses: {
        name: name,
        email: email,
        location: { optionValue: '', value: 'integrations:daily' },
      },
      timeZone: DEFAULT_TIMEZONE,
      language: 'en',
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
    return await checkAvailability(env, startDate, endDate);
  }

  if (toolName === 'book_appointment') {
    const result = await bookAppointment(env, input.start_time, input.attendee_name, input.attendee_email);
    // Return only essential info to keep tool result small
    return {
      success: true,
      bookingId: result.id,
      title: result.title,
      startTime: result.startTime,
      endTime: result.endTime,
      status: result.status,
      videoCallUrl: result.videoCallUrl || null,
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

function corsJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export default {
  async fetch(request, env) {
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
      return corsJson({ error: 'Method not allowed' }, 405);
    }

    try {
      const body = await request.json();
      const { message, history } = body;

      if (!message || typeof message !== 'string' || message.length > 1000) {
        return corsJson({ error: 'Invalid message' }, 400);
      }

      // Build messages from conversation history
      let messages = [];
      if (Array.isArray(history)) {
        for (const h of history.slice(-20)) {
          if ((h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string') {
            messages.push({ role: h.role, content: h.content });
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
            system: SYSTEM_PROMPT,
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
        const toolUseBlock = data.content.find(b => b.type === 'tool_use');

        if (!toolUseBlock) {
          finalReply = textBlocks;
          break;
        }

        // Claude wants to use a tool — add its response to messages
        messages.push({ role: 'assistant', content: data.content });

        // Execute the tool
        let toolResult;
        try {
          toolResult = await executeTool(env, toolUseBlock.name, toolUseBlock.input);
        } catch (toolErr) {
          toolResult = { error: toolErr.message };
        }

        // Feed tool result back to Claude
        messages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: toolUseBlock.id,
            content: JSON.stringify(toolResult),
          }],
        });
      }

      return corsJson({
        reply: finalReply || "Sorry, something went wrong during the booking process. You can reach Jarek directly at jarek@layerops.tech or 0404 003 240."
      });

    } catch (err) {
      console.error('Worker error:', err.message, err.stack);
      return corsJson({
        reply: "Sorry, something went wrong. You can reach Jarek directly at jarek@layerops.tech or 0404 003 240."
      }, 500);
    }
  },
};
