// One-off send: intro email to Maciej @ Véurr
// Usage: RESEND_API_KEY=... node tools/send-veurr-email.js

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error('Missing RESEND_API_KEY');
  process.exit(1);
}

const text = `Hey Maciej,

Good chat today. I've been thinking about what you said about Vietnam — that the firm is starting to look into AI.

Quick context: I've been building this thing called LayerOps for the last few months. It's basically an AI receptionist for small businesses — answers the phone, captures website enquiries, books meetings, sends the lead to the right person on your team. Australian-built, runs on Cloudflare, stays on Australian infrastructure.

The honest reason I think it'd fit Véurr: financial advisory is the perfect industry for this kind of thing specifically because the bot can't give advice. Every reputable adviser I know is paranoid about compliance, and they should be. The bot we'd build for you would refuse to discuss anything advice-shaped — it would only do receptionist work: "hi, what's the matter, how urgent is it, let me get you booked in with the right adviser, here's the Financial Services Guide you need to read first, see you Tuesday". That's it. No grey area.

The stuff it WOULD genuinely solve for Véurr (these are the things that drove me to build this in the first place):

After-hours enquiries from prospects. People research financial advisers at 10pm after the kids go to bed. If they hit a "request a callback" form, half of them never get one. With Kestrel (the AI receptionist), they get an actual conversation, their details captured properly, and a meeting in your calendar before they close the tab.

But honestly the receptionist is just the front door. The bigger value for a firm your size is probably in the internal admin that eats your team's day — the stuff that has nothing to do with advice and everything to do with paperwork. A few things I'd look at if we ended up working together:

Pre-meeting document workflow. "Did the client read the FSG yet? Did they fill in the fact-find?" Half the meetings I see in advisory firms get half-wasted because the client showed up unprepared. A bot can chase the FSG, the fact-find, and any required forms — and only mark the meeting as "ready" when everything's in.

Meeting prep dossiers. Each adviser flips through 5 systems to assemble a 1-pager for each client meeting — recent portfolio movements, last meeting notes, action items still open, life events to follow up on. A bot can generate that overnight and email it to the adviser at 7am. Saves 20-30 minutes per meeting.

Lead nurture for prospects who didn't book. Someone fills in your website form but doesn't actually book a meeting — currently they probably get one reactive email and that's it. A bot can send a personalised follow-up after a few days, share a relevant article, chase once more, and mark them cold after 3 weeks. No advice, just nurture.

None of those involve giving advice. All of them give your team back hours per week.

I had a quick look at veurr.com.au while I was thinking about this. A few things you might want to know about (most of these are 5-minute fixes):

1. There's no meta description on the homepage, so Google is making one up for searches. Worth controlling that for a premium brand.
2. No structured business markup (LocalBusiness / FinancialService schema), which means you're not appearing in "financial planner near me" / Google Maps searches as well as you could.
3. The homepage has 11 H1 headings instead of one clear top-level heading — Google can't tell what the page is actually about, which hurts ranking for terms like "financial advice Canberra".

Happy to look at that for you.

Oh, and if you want to hear our virtual receptionist in action, give it a call on (02) 5941 6608. It's set up for a different business right now, but the version we'd build for Véurr would be tailored entirely to you — your tone, your services, your compliance rules. Have a play with it and see what you think.

Cheers,

Jarek Piotrowski
LayerOps · layerops.tech · 0404 003 240
Try our AI receptionist — call (02) 5941 6608
`;

const html = text
  .split('\n\n')
  .map(p => `<p>${p.replace(/\n/g, '<br>').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
  .join('\n');

(async () => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Jarek Piotrowski <jarek@layerops.tech>',
      to: ['Maciej@veurr.com.au'],
      reply_to: 'jarek@layerops.tech',
      subject: 'AI for Véurr — what we were chatting about today',
      text,
      html,
    }),
  });
  const body = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', body);
  if (!res.ok) process.exit(2);
})();
