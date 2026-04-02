// Industry vertical email templates for outreach
// Each vertical frames audit findings in language the industry cares about

const VERTICALS = {
  medical: {
    customer: 'patients',
    customers: 'patients',
    action: 'booking an appointment',
    pain: 'choosing a different practice',
    search: 'doctor near me',
    afterHours: 'looking for a GP after hours',
    subject: (host, issue) => issue || `your practice might be hard to find on google`,
    frame: (name, host, issues) => {
      const top = issues[0];
      return `Hi,\n\nI had a look at ${host} and noticed ${top?.description || 'some issues that could be affecting how many new patients find your practice online'}.\n\nNew patients searching for a GP or medical centre in your area are more likely to book with the practice that shows up first on Google. I found ${issues.length} things that could help more patients find you.\n\nWant me to send through the full report?`;
    },
  },

  dental: {
    customer: 'patients',
    customers: 'patients',
    action: 'booking a check-up',
    pain: 'choosing the practice that ranks higher',
    search: 'dentist near me',
    subject: (host, issue) => issue || `new patients might be choosing your competitors`,
    frame: (name, host, issues) => {
      const top = issues[0];
      return `Hi,\n\nI ran a health check on ${host} and noticed ${top?.description || 'some things that could be affecting how many new patients find your practice'}.\n\nWhen someone searches for a dentist in your area, the practices that show up first get most of the bookings. I found ${issues.length} things that could help your practice rank higher.\n\nHappy to send the full report if you're interested.`;
    },
  },

  realestate: {
    customer: 'buyers and sellers',
    customers: 'potential clients',
    action: 'listing their property or searching for homes',
    pain: 'going to competing agencies',
    search: 'real estate agent near me',
    subject: (host, issue) => issue || `your listings might not be showing up properly on google`,
    frame: (name, host, issues) => {
      const top = issues[0];
      return `Hi,\n\nI had a look at ${host} and noticed ${top?.description || 'some issues that could be affecting how visible your listings are online'}.\n\nBuyers and sellers often start their search on Google. If your agency doesn't show up or your listing pages aren't optimised, those enquiries go to your competitors. I found ${issues.length} things that could help.\n\nWant me to send through the full report?`;
    },
  },

  property_management: {
    customer: 'landlords and tenants',
    customers: 'potential clients',
    action: 'looking for a property manager',
    pain: 'choosing a competitor',
    search: 'property management near me',
    subject: (host, issue) => issue || `tenant enquiries might be going to your competitors`,
    frame: (name, host, issues) => {
      const top = issues[0];
      return `Hi,\n\nI ran a health check on ${host} and noticed ${top?.description || 'some things that could affect how landlords and tenants find you online'}.\n\nLandlords looking for a property manager and tenants searching for rentals start on Google. I found ${issues.length} things that could help more enquiries come your way.\n\nHappy to send the full report if you'd like to see it.`;
    },
  },

  trade: {
    customer: 'customers',
    customers: 'potential customers',
    action: 'looking for a tradie',
    pain: 'calling your competitors instead',
    search: 'plumber/electrician near me',
    subject: (host, issue) => issue || `you might be losing jobs to competitors online`,
    frame: (name, host, issues) => {
      const top = issues[0];
      return `Hi,\n\nI had a look at ${host} and noticed ${top?.description || 'some things that could be costing you jobs'}.\n\nWhen someone needs a tradie, they Google it. If your site doesn't show up or doesn't make it easy to call you, they ring the next one on the list. I found ${issues.length} things that could help you get more calls.\n\nWant me to send through the full report?`;
    },
  },

  vet: {
    customer: 'pet owners',
    customers: 'pet owners',
    action: 'finding a vet',
    pain: 'taking their pet elsewhere',
    search: 'vet near me',
    afterHours: 'searching for an emergency vet at night',
    subject: (host, issue) => issue || `pet owners might not be finding you online`,
    frame: (name, host, issues) => {
      const top = issues[0];
      return `Hi,\n\nI had a look at ${host} and noticed ${top?.description || 'some issues that could affect how pet owners find your clinic'}.\n\nPet owners — especially in emergencies — search Google first. If your clinic doesn't show up or your hours and phone number aren't easy to find, they'll call the next vet on the list. I found ${issues.length} things that could help.\n\nWant me to send the full report?`;
    },
  },

  physio: {
    customer: 'clients',
    customers: 'potential clients',
    action: 'booking a physio appointment',
    pain: 'booking with a different clinic',
    search: 'physio near me',
    subject: (host, issue) => issue || `new clients might not be finding your practice`,
    frame: (name, host, issues) => {
      const top = issues[0];
      return `Hi,\n\nI ran a health check on ${host} and noticed ${top?.description || 'some things that could be affecting how new clients find your practice'}.\n\nMost people searching for a physio book with whoever shows up first on Google. I found ${issues.length} things that could help your clinic rank higher and get more bookings.\n\nHappy to send the full report if you're interested.`;
    },
  },

  legal: {
    customer: 'clients',
    customers: 'potential clients',
    action: 'looking for a lawyer',
    pain: 'choosing a different firm',
    search: 'lawyer near me',
    subject: (host, issue) => issue || `potential clients might not be finding your firm online`,
    frame: (name, host, issues) => {
      const top = issues[0];
      return `Hi,\n\nI had a look at ${host} and noticed ${top?.description || 'some issues that could be affecting how potential clients find your firm'}.\n\nPeople searching for legal help often choose the firm that appears first and looks most credible online. I found ${issues.length} things that could help more clients find you.\n\nWant me to send through the full report?`;
    },
  },

  accounting: {
    customer: 'clients',
    customers: 'potential clients',
    action: 'looking for an accountant',
    pain: 'choosing a different firm',
    search: 'accountant near me',
    subject: (host, issue) => issue || `new clients might be going to your competitors`,
    frame: (name, host, issues) => {
      const top = issues[0];
      return `Hi,\n\nI ran a health check on ${host} and noticed ${top?.description || 'some things affecting how new clients find your practice online'}.\n\nSmall business owners looking for an accountant start with Google. I found ${issues.length} things that could help your firm show up higher and get more enquiries.\n\nHappy to send the full report if you'd like to see it.`;
    },
  },

  default: {
    customer: 'customers',
    customers: 'potential customers',
    action: 'looking for your services',
    pain: 'going to your competitors',
    search: 'your services near me',
    subject: (host, issue) => issue || `noticed something on your website`,
    frame: (name, host, issues) => {
      const top = issues[0];
      return `Hi,\n\nI had a look at ${host} and noticed ${top?.description || 'some things that could help more customers find you online'}.\n\nI ran a full health check and found ${issues.length} things that could help. Want me to send through the full report? No cost - just thought you would want to know.`;
    },
  },
};

// Map common industry names to vertical keys
const INDUSTRY_MAP = {
  'medical': 'medical', 'gp': 'medical', 'doctor': 'medical', 'clinic': 'medical', 'health': 'medical',
  'dental': 'dental', 'dentist': 'dental', 'orthodontist': 'dental',
  'realestate': 'realestate', 'real estate': 'realestate', 'property': 'realestate', 'real-estate': 'realestate',
  'property_management': 'property_management', 'property management': 'property_management',
  'plumber': 'trade', 'electrician': 'trade', 'builder': 'trade', 'tradie': 'trade', 'trade': 'trade', 'carpenter': 'trade', 'painter': 'trade', 'roofer': 'trade',
  'vet': 'vet', 'veterinarian': 'vet', 'veterinary': 'vet', 'animal': 'vet',
  'physio': 'physio', 'physiotherapist': 'physio', 'physiotherapy': 'physio', 'chiro': 'physio', 'chiropractor': 'physio',
  'legal': 'legal', 'lawyer': 'legal', 'solicitor': 'legal', 'law': 'legal',
  'accounting': 'accounting', 'accountant': 'accounting', 'tax': 'accounting', 'bookkeeper': 'accounting',
  'barber': 'default', 'hair salon': 'default', 'cafe': 'default', 'restaurant': 'default', 'bakery': 'default', 'landscaper': 'default', 'gardener': 'default',
};

function getVertical(industry) {
  if (!industry) return VERTICALS.default;
  const key = INDUSTRY_MAP[industry.toLowerCase()] || 'default';
  return VERTICALS[key];
}

function generateOutreachEmail(lead, auditResult) {
  const vertical = getVertical(lead.industry || lead.vertical);
  const host = new URL(lead.url).hostname;
  const issues = auditResult.top_fixes || [];
  const topIssue = issues[0];

  // Build the specific issue hook for the subject line
  let issueHook = null;
  if (topIssue) {
    issueHook = topIssue.title.toLowerCase();
  }

  const subject = vertical.subject(host, issueHook);
  const body = vertical.frame(lead.name, host, issues);

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.7;color:#333;">
${body.split('\n').map(line => line ? '<p>' + line + '</p>' : '').join('')}
<p>Cheers,<br>Jarek Piotrowski<br><span style="color:#999;font-size:13px;">LayerOps &middot; <a href="https://layerops.tech" style="color:#2B6777;">layerops.tech</a> &middot; 0404 003 240</span></p>
</body></html>`;

  return { subject, html, vertical: vertical === VERTICALS.default ? 'default' : lead.industry };
}

module.exports = { VERTICALS, INDUSTRY_MAP, getVertical, generateOutreachEmail };
