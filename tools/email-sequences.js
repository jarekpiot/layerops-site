// LayerOps 5-Email Outreach Sequence Templates
// Research-backed: PAS framework, <100 words, personalized per business/industry
//
// Sequence:
//   Day 0  — Website observation + automation pain (personalized from audit)
//   Day 3  — Quick bump + industry stat
//   Day 7  — Social proof / case study
//   Day 14 — Free audit offer (the value-add)
//   Day 21 — Breakup email (highest reply rate)

const SIG = `Jarek Piotrowski
LayerOps · layerops.tech · 0404 003 240`;

const SIG_SHORT = `Jarek
LayerOps · layerops.tech · 0404 003 240`;

// ─── Industry-specific pain points and stats ────────────────────────────────

const INDUSTRY_DATA = {
  plumber: {
    label: 'plumbing business',
    painStat: 'The average plumber in Canberra misses 3–5 calls a week while on a job. At $300+ per callout, that\'s $1,000/week walking to a competitor.',
    socialProof: 'a plumbing business here in Canberra',
    afterHours: 'emergency hot water calls at 9pm',
    jobValue: '$300–$500',
    missedCallPain: 'When someone\'s hot water goes out at 8pm, they\'re calling the first three plumbers on Google. If you don\'t answer, the job goes to whoever does.',
  },
  electrician: {
    label: 'electrical business',
    painStat: 'Electricians miss more after-hours calls than almost any trade — most emergencies (outages, safety switches) happen evenings and weekends.',
    socialProof: 'an electrical business in the ACT',
    afterHours: 'emergency callouts at night',
    jobValue: '$250–$600',
    missedCallPain: 'When someone\'s power goes out or a safety switch keeps tripping, they need an answer now — not a voicemail.',
  },
  dentist: {
    label: 'dental practice',
    painStat: 'Dental practices lose an average of 15–20 new patient enquiries per month to voicemail. Most first-time patients who get voicemail just call the next practice on Google.',
    socialProof: 'a dental practice in Canberra',
    afterHours: 'appointment requests outside business hours',
    jobValue: '$200–$400 per new patient',
    missedCallPain: 'New patients tend to call during lunch or after work — exactly when your front desk is busiest or closed.',
  },
  landscaper: {
    label: 'landscaping business',
    painStat: 'Most landscaping enquiries come through while you\'re on-site with your hands full. If you can\'t answer in 30 seconds, they\'ve already called someone else.',
    socialProof: 'a landscaping business in the ACT',
    afterHours: 'quote requests that come in while you\'re on a job',
    jobValue: '$500–$2,000',
    missedCallPain: 'Homeowners looking for a landscaper usually call 2–3 businesses and go with whoever picks up first.',
  },
  medical: {
    label: 'medical practice',
    painStat: 'GP practices handle 80–120 calls per day. Research shows 30% of patients who can\'t get through switch to a different practice within the month.',
    socialProof: 'a medical practice in Canberra',
    afterHours: 'patients trying to book outside hours',
    jobValue: '$75–$150 per consult',
    missedCallPain: 'Patients trying to book outside of 9–5 often end up at a different practice — especially new patients who don\'t have loyalty yet.',
  },
  legal: {
    label: 'law firm',
    painStat: 'Legal enquiries have the highest intent of any service industry — someone searching for a lawyer usually needs one now. But 40% of law firm calls go to voicemail.',
    socialProof: 'a law firm in the ACT',
    afterHours: 'urgent client calls outside office hours',
    jobValue: '$300–$500 per hour',
    missedCallPain: 'Someone looking for legal help has usually already decided they need a lawyer. If they can\'t reach you, they\'ll have engaged someone else by morning.',
  },
  realestate: {
    label: 'real estate agency',
    painStat: 'Property buyers expect instant responses. Agencies that reply to web enquiries within 5 minutes are 21x more likely to convert the lead.',
    socialProof: 'a real estate agency in Canberra',
    afterHours: 'rental and buying enquiries after hours',
    jobValue: '$5,000–$15,000 per sale',
    missedCallPain: 'Buyers browse listings at night. If they enquire at 8pm and don\'t hear back until 10am, they\'ve already inspected with another agent.',
  },
  physiotherapist: {
    label: 'physio practice',
    painStat: 'Physio practices lose bookings when patients can\'t get through during lunch breaks — the #1 time people try to book. If the phone rings out, they book elsewhere.',
    socialProof: 'a physio clinic in Canberra',
    afterHours: 'booking requests outside clinic hours',
    jobValue: '$80–$120 per session',
    missedCallPain: 'People in pain want an appointment now. If your phone rings out during lunch, they\'re already booking with the clinic down the road.',
  },
  transport: {
    label: 'transport business',
    painStat: 'Airport transfer bookings come in at all hours — travellers plan around flight times, not business hours. A missed enquiry at 10pm is a $200+ job gone.',
    socialProof: 'a transport business in Byron Bay',
    afterHours: 'booking enquiries that come in late at night',
    jobValue: '$150–$400',
    missedCallPain: 'Travellers book transfers when they book flights — often late at night. If they can\'t book with you instantly, they\'ll use a ride-share app instead.',
  },
  farm: {
    label: 'farm business',
    painStat: 'People looking for farm stays, tours, or farm-gate produce often search and enquire in the evening after work. If there\'s no way to book or enquire online, they move on.',
    socialProof: 'an agritourism business in regional NSW',
    afterHours: 'enquiries about visits, bookings, or produce orders',
    jobValue: '$100–$500',
    missedCallPain: 'Visitors plan farm trips in the evening. If they can\'t find what they need on your site or get a response, they pick somewhere else.',
  },
  default: {
    label: 'business',
    painStat: '62% of calls to small businesses go unanswered. 85% of those callers never try again — they just call your competitor.',
    socialProof: 'a local business in Canberra',
    afterHours: 'customer enquiries outside business hours',
    jobValue: '$200–$500',
    missedCallPain: '62% of calls to small businesses go unanswered, and 85% of those people never try again.',
  },
};

function getIndustry(industry) {
  return INDUSTRY_DATA[industry] || INDUSTRY_DATA[(industry || '').toLowerCase()] || INDUSTRY_DATA.default;
}

// ─── Sequence Templates ─────────────────────────────────────────────────────

function buildSequence(lead) {
  const ind = getIndustry(lead.industry);
  const name = lead.name || 'your business';
  const firstName = lead.firstName || 'there';
  const domain = (lead.url || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
  const city = lead.city || 'Canberra';
  const issue = lead.topIssue || 'a few things that could be costing you customers';
  const score = lead.score || null;

  return [
    // ─── EMAIL 1: Day 0 — Website observation + missed-call pain ────────
    {
      day: 0,
      subject: `${name} — noticed something on your site`,
      text: `Hi ${firstName},

I was looking at ${domain} and noticed ${issue}.

I also checked what happens when someone tries to reach you after hours. ${ind.missedCallPain}

Is that something you've thought about, or is it working fine as-is?

Cheers,
${SIG}`,
    },

    // ─── EMAIL 2: Day 3 — Bump + industry stat ───────────────��─────────
    {
      day: 3,
      subject: `Re: ${name} — noticed something on your site`,
      text: `Hi ${firstName},

Just bumping this in case it got buried.

${ind.painStat}

Happy to share what I found on ${domain} if it's useful — no sales pitch, just the info.

${SIG_SHORT}`,
    },

    // ─── EMAIL 3: Day 7 — Social proof ──────────────────────────────────
    {
      day: 7,
      subject: `Re: ${name} — noticed something on your site`,
      text: `Hi ${firstName},

We recently set up a virtual receptionist for ${ind.socialProof} — it answers every call and enquiry automatically, captures the details, and texts the lead straight to their phone.

They were losing 4–5 enquiries a week. Now they catch every one, even at 10pm on a Saturday.

Would something like that be useful for ${name}?

${SIG_SHORT}`,
    },

    // ─── EMAIL 4: Day 14 — Free audit report ────────────────────────────
    {
      day: 14,
      subject: `free website report for ${name}`,
      text: `Hi ${firstName},

I put together a full website health check for ${domain}${score ? ` — you scored ${score}/100` : ''}. It covers how you show up on Google, what's working, and what might be costing you leads.

Happy to send the full report over — no strings attached, just thought it'd be useful.

${SIG}`,
    },

    // ─── EMAIL 5: Day 21 — Breakup ──────────────────────────────────────
    {
      day: 21,
      subject: `closing the loop — ${name}`,
      text: `Hi ${firstName},

I've reached out a few times so I'll keep this short — looks like the timing isn't right and that's completely fine.

If you ever want a hand catching those after-hours enquiries or improving how ${name} shows up on Google, my door's open.

All the best,
${SIG}`,
    },
  ];
}

// ─── HTML wrapper for sending via Resend ────────────────────────────────────

function toHtml(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.7;color:#333;">
<p>${escaped}</p>
</body></html>`;
}

module.exports = { buildSequence, toHtml, getIndustry, INDUSTRY_DATA };
