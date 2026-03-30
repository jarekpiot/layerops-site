// LayerOps Kestrel Chatbot — Cloudflare Worker
// Proxies to Anthropic API with Cal.com booking tools

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
- Contact: jarek@layerops.com.au / 0404 003 240

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
- If the Cal.com API fails, fall back to suggesting they email jarek@layerops.com.au
- Do NOT mention "Cal.com" or "tools" to the user — just present it naturally
- Present times in a readable format like "Tuesday 1 April, 10:00 AM AEST"
- Offer 3-5 time options spread across different days/times, don't overwhelm with too many
- IMPORTANT: When the user has picked a time slot AND provided their name and email, call book_appointment immediately with the matching ISO timestamp from the slots data. Do NOT call check_availability again — use the slot data you already have.
- Only call check_availability once per booking conversation. After that, use the data you received.
- If you need to match the user's chosen time to an ISO timestamp, use the closest matching slot from the availability data.

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
  }
];

const DEFAULT_TIMEZONE = 'Australia/Sydney';

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

async function executeTool(env, toolName, input) {
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

      // Tool use loop — max 5 iterations (check_availability + book_appointment)
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
          finalReply = "Sorry, I'm having a moment. Try again or reach out to jarek@layerops.com.au directly.";
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
        reply: finalReply || "Sorry, something went wrong during the booking process. You can reach Jarek directly at jarek@layerops.com.au or 0404 003 240."
      });

    } catch (err) {
      console.error('Worker error:', err.message, err.stack);
      return corsJson({
        reply: "Sorry, something went wrong. You can reach Jarek directly at jarek@layerops.com.au or 0404 003 240."
      }, 500);
    }
  },
};
