/* PeopleFirst CRM - B2B Lead Generation & Sales Pipeline Management
   Runs entirely in the browser (double-click index.html). Changes are saved in this browser (localStorage).
   When served by backend/app.py, window.CRM_API is set and every change is also written to the database. */
(() => {
  'use strict';

  // ------------------------------------------------------------------ constants
  const API = window.CRM_API || null;
  const STORE_KEY = 'peoplefirst-crm-v1';
  const SAMPLE = window.CRM_DATA;
  const SNAP = SAMPLE.meta.snapshot_date;
  const STAGES = ['New Lead', 'Contacted', 'Qualified', 'Meeting Scheduled', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];
  const ORDER = { 'New Lead': 1, 'Contacted': 2, 'Qualified': 3, 'Meeting Scheduled': 4, 'Proposal Sent': 5, 'Negotiation': 6, 'Won': 7, 'Lost': 0 };
  const PROB = { 'New Lead': 5, 'Contacted': 10, 'Qualified': 20, 'Meeting Scheduled': 35, 'Proposal Sent': 50, 'Negotiation': 75, 'Won': 100, 'Lost': 0 };
  const OPEN_DEAL = ['Qualified', 'Meeting Scheduled', 'Proposal Sent', 'Negotiation'];
  const STAGE_OUTCOME = { 'New Lead': 'Reopened', 'Contacted': 'Contacted', 'Qualified': 'Qualified', 'Meeting Scheduled': 'Meeting Booked', 'Proposal Sent': 'Proposal Shared', 'Negotiation': 'Negotiating', 'Won': 'Closed Won', 'Lost': 'Closed Lost' };
  const TARGET = ['IT', 'Startup', 'Finance', 'Manufacturing', 'E-commerce'];
  const DM = ['CEO', 'Founder', 'CHRO', 'HR Head', 'HR Director', 'HR Manager'];
  const INTEREST = ['Replied', 'Qualified', 'Meeting Booked', 'Proposal Shared', 'Negotiating', 'Closed Won'];
  const INDUSTRIES = ['IT', 'Startup', 'Finance', 'Manufacturing', 'E-commerce', 'Healthcare', 'Education'];
  const CITIES = ['Bangalore', 'Delhi', 'Mumbai', 'Hyderabad', 'Pune', 'Chennai'];
  const SOURCES = ['LinkedIn', 'Cold Email', 'Website', 'IndiaMART', 'Events', 'Referral'];
  const TITLES = [...DM, 'Talent Acquisition Lead', 'Admin Manager', 'Operations Manager', 'Finance Manager', 'Office Manager'];
  const LOST_REASONS = ['No response', 'Not interested', 'No budget', 'Bad timing', 'Went with competitor', 'Price too high', 'Using in-house tool'];
  const ACT_TYPES = ['Email', 'Call', 'WhatsApp', 'LinkedIn Message', 'Meeting', 'Demo', 'Proposal'];
  const ACT_OUTCOMES = ['Follow-up done', 'No Response', 'Replied', 'Meeting Booked', 'Demo Done', 'Proposal Shared', 'Negotiating', 'Not interested'];
  const SRC_COL = { 'LinkedIn': 'var(--s1)', 'Cold Email': 'var(--s2)', 'Website': 'var(--s3)', 'IndiaMART': 'var(--s4)', 'Events': 'var(--s5)', 'Referral': 'var(--s6)' };
  const REP_COL = ['#2a78d6', '#eb6834', '#1baf7a', '#c98500', '#d55181', '#008300'];
  const FUNNEL_COL = ['#86b6ef', '#6da7ec', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', 'var(--accent)'];
  const CAT_COL = { Hot: 'var(--hot)', Warm: 'var(--warm)', Cold: 'var(--cold)' };
  const STAGE_CHIP = { 'Won': 'var(--good)', 'Lost': '#98a4aa', 'New Lead': '#9ec5f4', 'Contacted': '#6da7ec', 'Qualified': '#3987e5', 'Meeting Scheduled': '#2a78d6', 'Proposal Sent': '#1c5cab', 'Negotiation': '#104281' };
  const TEMPLATES = [
    { name: 'First outreach', subject: 'Simplifying HR operations at [Company Name]', body: 'Hello [Contact Name],\n\nI hope you are doing well.\n\nI am reaching out to introduce our HR Management Software, designed to help businesses streamline employee management, attendance tracking, payroll processing, and HR operations.\n\nWe believe our solution could help [Company Name] improve operational efficiency and reduce manual HR processes.\n\nWould you be available for a short 15-minute discussion to explore whether our solution could benefit your organization?\n\nLooking forward to hearing from you.\n\nBest regards,\n[Rep Name]\nSales Development Team, PeopleFirst HR' },
    { name: 'Follow-up', subject: 'Following up: HR software for [Company Name]', body: 'Hello [Contact Name],\n\nI wanted to follow up on my previous email regarding our HR Management Software.\n\nI would be happy to demonstrate how our solution can simplify HR operations and improve workforce management at [Company Name].\n\nPlease let me know if you would be available for a brief discussion.\n\nBest regards,\n[Rep Name]\nSales Development Team, PeopleFirst HR' },
    { name: 'Meeting confirmation', subject: 'Confirmed: PeopleFirst HR product demo', body: 'Hello [Contact Name],\n\nThank you for your interest in our HR Management Software.\n\nThis email confirms our scheduled product demonstration.\n\nDuring the session, we will cover:\n- Employee management features\n- Attendance and payroll automation\n- Reporting capabilities\n- Pricing and implementation\n\nLooking forward to speaking with you.\n\nBest regards,\n[Rep Name]\nSales Development Team, PeopleFirst HR' }
  ];
  const CADENCE = [[1, 'Day 1', 'Initial outreach email'], [2, 'Day 3', 'First follow-up email'], [3, 'Day 7', 'Second follow-up email'], [4, 'Day 10', 'Call to schedule a product demo'], [5, 'Day 14', 'Final follow-up, then update lead status']];

  // ------------------------------------------------------------------ state
  let DB, IDX, today = SNAP, page = 'dashboard', drawerId = null;
  const F = { from: '', to: '', industry: '', location: '', source: '', rep: '', stage: '' };
  const LQ = { q: '', industry: '', location: '', source: '', rep: '', cat: '', stage: '', sort: 'lead_score', dir: -1, page: 1 };
  let fuRep = '', pipeRep = '', outLead = '', outTpl = 0, outText = null, showAll = {};

  // ------------------------------------------------------------------ helpers
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const sum = (a, f) => a.reduce((t, x) => t + (+f(x) || 0), 0);
  const D = s => new Date(s + 'T00:00:00Z');
  const days = (a, b) => Math.round((D(a) - D(b)) / 864e5);
  const addDays = (s, n) => new Date(D(s).getTime() + n * 864e5).toISOString().slice(0, 10);
  const fd = s => s ? D(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—';
  const fdy = s => s ? D(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
  const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
  const money = n => { const a = Math.abs(n); return a >= 1e7 ? '₹' + parseFloat((n / 1e7).toFixed(2)) + ' Cr' : a >= 1e5 ? '₹' + parseFloat((n / 1e5).toFixed(1)) + 'L' : a >= 1e3 ? '₹' + parseFloat((n / 1e3).toFixed(1)) + 'k' : inr(n); };
  const pct = (x, d = 0) => (isFinite(x) ? (x * 100).toFixed(d) : '0') + '%';
  const opt = (v, l, sel) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(l)}</option>`;
  const opts = (arr, sel, all) => (all ? opt('', all, sel) : '') + arr.map(a => Array.isArray(a) ? opt(a[0], a[1], sel) : opt(a, a, sel)).join('');
  const chip = (txt, c) => `<span class="chip" style="--c:${c}">${esc(txt)}</span>`;
  const stageChip = s => chip(s, STAGE_CHIP[s] || 'var(--muted)');
  const catChip = c => chip(c, CAT_COL[c]);
  const isOpen = l => l.status !== 'Won' && l.status !== 'Lost';
  const pad = (n, w) => String(n).padStart(w, '0');
  const nextId = (arr, key, prefix, w) => prefix + pad(Math.max(0, ...arr.map(x => +String(x[key]).slice(prefix.length) || 0)) + 1, w);
  const rep = id => IDX.rep.get(id) || { sales_name: id, sales_id: id };
  const repIdx = id => DB.reps.findIndex(r => r.sales_id === id);
  const avatar = id => { const r = rep(id); const ini = r.sales_name.split(' ').map(w => w[0]).join('').slice(0, 2); return `<span class="avatar" style="background:${REP_COL[repIdx(id) % 6] || '#666'}" title="${esc(r.sales_name)}" aria-label="${esc(r.sales_name)}">${ini}</span>`; };
  const scoreView = l => `<span class="score">${l.lead_score}<span class="m"><i style="width:${l.lead_score}%;background:${CAT_COL[l.lead_category]}"></i></span></span>`;

  // ------------------------------------------------------------------ data layer
  function reindex() {
    IDX = { lead: new Map(), rep: new Map(), contacts: new Map(), acts: new Map(), opp: new Map() };
    DB.reps.forEach(r => IDX.rep.set(r.sales_id, r));
    DB.leads.forEach(l => { IDX.lead.set(l.lead_id, l); IDX.contacts.set(l.lead_id, []); IDX.acts.set(l.lead_id, []); });
    DB.contacts.forEach(c => IDX.contacts.get(c.lead_id)?.push(c));
    DB.activities.forEach(a => IDX.acts.get(a.lead_id)?.push(a));
    IDX.acts.forEach(list => list.sort((a, b) => a.activity_date.localeCompare(b.activity_date) || a.activity_id.localeCompare(b.activity_id)));
    DB.opportunities.forEach(o => IDX.opp.set(o.lead_id, o));
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(API ? { today } : { db: DB, today })); } catch (e) { /* storage unavailable: keep working in memory */ }
  }
  function loadLocal() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (s && s.today) today = s.today;
      if (!API && s && s.db && Array.isArray(s.db.leads)) return s.db;
    } catch (e) { /* ignore */ }
    return clone(SAMPLE);
  }
  function api(method, path, body) {
    if (!API) return;
    fetch(API + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      .then(r => { if (!r.ok) throw new Error(r.status); })
      .catch(() => toast('Server did not save this change - check that app.py is running'));
  }

  // lead info used everywhere
  function info(l) {
    const acts = IDX.acts.get(l.lead_id) || [];
    const last = acts[acts.length - 1] || null;
    const next = last ? last.next_followup : null;
    let fu = null;
    if (isOpen(l)) {
      if (!last) fu = 'Not contacted';
      else if (!next) fu = 'No follow-up set';
      else if (next < today) fu = 'Overdue';
      else if (next === today) fu = 'Due today';
      else if (next <= addDays(today, 7)) fu = 'This week';
      else fu = 'Later';
    }
    const idle = days(today, last ? last.activity_date : l.lead_date);
    return { acts, last, next, fu, idle, opp: IDX.opp.get(l.lead_id) || null, contacts: IDX.contacts.get(l.lead_id) || [] };
  }
  function scoreParts(l) {
    const cs = IDX.contacts.get(l.lead_id) || [], as = IDX.acts.get(l.lead_id) || [];
    return [
      { k: 'Company has more than 200 employees', p: 25, ok: l.employees > 200 },
      { k: 'Belongs to a target industry', p: 20, ok: TARGET.includes(l.industry) },
      { k: 'Decision-maker identified', p: 20, ok: cs.some(c => DM.includes(c.designation)) },
      { k: 'Has expressed interest', p: 25, ok: as.some(a => INTEREST.includes(a.outcome)) },
      { k: 'Valid business contact information', p: 10, ok: cs.some(c => c.valid_email && c.phone) }
    ];
  }
  const classify = s => s >= 75 ? 'Hot' : s >= 40 ? 'Warm' : 'Cold';
  function rescore(l) {
    const p = scoreParts(l);
    l.decision_maker = p[2].ok; l.interested = p[3].ok; l.valid_contact = p[4].ok;
    l.lead_score = sum(p.filter(x => x.ok), x => x.p);
    l.lead_category = classify(l.lead_score);
  }

  // ------------------------------------------------------------------ mutations
  function addActivity(l, a) {
    const act = Object.assign({ activity_id: nextId(DB.activities, 'activity_id', 'A', 5), lead_id: l.lead_id, sales_id: l.sales_id, activity_date: today, cadence_step: null, next_followup: null }, a);
    DB.activities.push(act);
    api('POST', '/activities', act);
    return act;
  }
  function commit(l, msg) {
    reindex();
    if (l) { rescore(l); api('PATCH', '/leads/' + l.lead_id, l); }
    save(); render(); if (drawerId) renderDrawer(); if (msg) toast(msg);
  }
  function setStage(id, stage, reason) {
    const l = IDX.lead.get(id); if (!l || l.status === stage) return;
    const prev = l.status;
    l.status = stage;
    if (stage !== 'Lost' && ORDER[stage] > ORDER[l.max_stage_reached]) l.max_stage_reached = stage;
    l.lost_at_stage = stage === 'Lost' ? prev : null;
    l.lost_reason = stage === 'Lost' ? (reason || 'Not interested') : null;
    let o = IDX.opp.get(id);
    if (!o && ORDER[stage] >= 3) {
      o = { opportunity_id: nextId(DB.opportunities, 'opportunity_id', 'O', 4), lead_id: id, stage, deal_value: Math.max(60000, Math.round(l.employees * 2100 / 5000) * 5000), probability: PROB[stage], created_date: today, expected_close_date: addDays(today, 45), close_date: null, lost_reason: null };
      DB.opportunities.push(o);
    }
    if (o) {
      o.stage = stage === 'New Lead' || stage === 'Contacted' ? 'Qualified' : stage;
      o.probability = PROB[o.stage];
      o.close_date = stage === 'Won' || stage === 'Lost' ? today : null;
      o.lost_reason = stage === 'Lost' ? l.lost_reason : null;
      api('PUT', '/opportunities/' + o.opportunity_id, o);
    }
    addActivity(l, { activity_type: 'Stage Change', outcome: STAGE_OUTCOME[stage], notes: `Moved from ${prev} to ${stage}${stage === 'Lost' ? ' - ' + l.lost_reason : ''}`, next_followup: isOpen(l) ? addDays(today, 3) : null });
    commit(l, stage === 'Won' ? `${l.company_name} won - ${money(o ? o.deal_value : 0)} added to revenue` : `${l.company_name} moved to ${stage}`);
  }
  function logActivity(id, a) {
    const l = IDX.lead.get(id); if (!l) return;
    addActivity(l, a);
    if (l.status === 'New Lead') { l.status = 'Contacted'; if (ORDER[l.max_stage_reached] < 2) l.max_stage_reached = 'Contacted'; }
    commit(l, `Activity logged for ${l.company_name}`);
  }

  // ------------------------------------------------------------------ filtering
  function applyF(leads) {
    return leads.filter(l => (!F.from || l.lead_date >= F.from) && (!F.to || l.lead_date <= F.to) && (!F.industry || l.industry === F.industry)
      && (!F.location || l.location === F.location) && (!F.source || l.lead_source === F.source) && (!F.rep || l.sales_id === F.rep) && (!F.stage || l.status === F.stage));
  }
  function filterBar() {
    const fld = (k, label, list, all) => `<label class="field">${label}<select id="f-${k}" data-f="${k}">${opts(list, F[k], all)}</select></label>`;
    return `<form class="filters" onsubmit="return false" aria-label="Filters">
      <label class="field">Lead date from<input type="date" id="f-from" data-f="from" value="${F.from}"></label>
      <label class="field">to<input type="date" id="f-to" data-f="to" value="${F.to}"></label>
      ${fld('industry', 'Industry', INDUSTRIES, 'All industries')}${fld('location', 'Location', CITIES, 'All locations')}
      ${fld('source', 'Lead source', SOURCES, 'All sources')}${fld('rep', 'Sales rep', DB.reps.map(r => [r.sales_id, r.sales_name]), 'All reps')}
      ${fld('stage', 'Pipeline stage', STAGES, 'All stages')}
      <button type="button" class="btn ghost" data-act="reset-filters">Reset</button></form>`;
  }
  function metrics(leads) {
    const ids = new Set(leads.map(l => l.lead_id));
    const opps = DB.opportunities.filter(o => ids.has(o.lead_id));
    const open = opps.filter(o => OPEN_DEAL.includes(o.stage));
    const won = leads.filter(l => l.status === 'Won').length, lost = leads.filter(l => l.status === 'Lost').length;
    const fu = leads.filter(isOpen).map(l => info(l).fu);
    return {
      total: leads.length, qualified: leads.filter(l => ORDER[l.max_stage_reached] >= 3).length, hot: leads.filter(l => l.lead_category === 'Hot').length,
      won, lost, conv: leads.length ? won / leads.length : 0, win: won + lost ? won / (won + lost) : 0,
      pipeline: sum(open, o => o.deal_value), weighted: sum(open, o => o.deal_value * o.probability / 100), openN: open.length,
      revenue: sum(opps.filter(o => o.stage === 'Won'), o => o.deal_value), opps, open,
      overdue: fu.filter(x => x === 'Overdue').length, dueToday: fu.filter(x => x === 'Due today').length, week: fu.filter(x => x === 'This week').length,
      idle: leads.filter(l => isOpen(l) && info(l).idle >= 14).length
    };
  }

  // ------------------------------------------------------------------ chart helpers (plain HTML/SVG - work offline)
  function hrows(items, o = {}) {
    if (!items.length) return '<div class="empty">No data for these filters</div>';
    const max = o.max || Math.max(1, ...items.map(i => i.v));
    return `<div class="hrows">${items.map(i => `<div class="hrow" data-tip="${esc(i.tip || i.n + ': ' + (i.label || i.v))}"><span class="n">${esc(i.n)}</span><div class="bartrack"><div class="bar" style="width:${(i.v / max * 100).toFixed(1)}%;background:${i.c || o.c || 'var(--s1)'}"></div></div><span class="v">${i.label ?? i.v}</span></div>`).join('')}</div>`;
  }
  function donut(items, center, sub) {
    const tot = sum(items, i => i.v);
    if (!tot) return '<div class="empty">No data for these filters</div>';
    const r = 56, C = 2 * Math.PI * r; let off = 0;
    const segs = items.filter(i => i.v).map(i => { const len = i.v / tot * C; const s = `<circle r="${r}" cx="75" cy="75" fill="none" stroke="${i.c}" stroke-width="22" stroke-dasharray="${Math.max(len - 2, 0.5)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 75 75)"><title>${esc(i.n)}: ${i.label || i.v}</title></circle>`; off += len; return s; }).join('');
    return `<div class="donut-wrap"><svg viewBox="0 0 150 150" role="img" aria-label="${esc(items.map(i => i.n + ' ' + (i.label || i.v)).join(', '))}"><circle r="${r}" cx="75" cy="75" fill="none" stroke="var(--track)" stroke-width="22"/>${segs}<text x="75" y="73" text-anchor="middle" font-family="Red Hat Display" font-weight="700" font-size="20" fill="var(--ink)">${esc(center)}</text><text x="75" y="92" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(sub)}</text></svg>
      <div class="legend" style="display:grid;gap:8px;margin:0">${items.map(i => `<span><i class="sw" style="background:${i.c}"></i><b style="color:var(--ink)">${esc(i.n)}</b> · ${i.label || i.v} (${pct(i.v / tot)})</span>`).join('')}</div></div>`;
  }
  function funnel(leads) {
    const steps = STAGES.slice(0, 7).map((s, i) => ({ s, n: leads.filter(l => ORDER[l.max_stage_reached] >= i + 1).length }));
    const top = Math.max(1, steps[0].n);
    return `<div class="funnel">${steps.map((x, i) => {
      const prev = i ? steps[i - 1].n : 0, drop = i && prev ? 1 - x.n / prev : 0;
      return `<div class="fstep" data-tip="${esc(`${x.s}: ${x.n} leads reached this stage (${pct(x.n / top, 1)} of all leads)`)}"><span class="small" style="font-weight:600">${x.s}</span><div class="fb" style="width:${Math.max(x.n / top * 100, 4)}%;background:${FUNNEL_COL[i]};color:${i < 2 ? '#0b1f4b' : '#fff'}">${x.n}</div><span class="drop">${i ? '−' + pct(drop) : ''}</span></div>`;
    }).join('')}</div><p class="note" style="margin:10px 0 0">Bars = leads that <b>reached</b> each stage. Right column = drop-off from the previous stage.</p>`;
  }
  function monthly(leads) {
    const m = {};
    leads.forEach(l => { const k = l.lead_date.slice(0, 7); m[k] = m[k] || { n: 0, w: 0 }; m[k].n++; if (l.status === 'Won') m[k].w++; });
    const keys = Object.keys(m).sort();
    if (!keys.length) return '<div class="empty">No data for these filters</div>';
    const max = Math.max(...keys.map(k => m[k].n));
    const nm = k => D(k + '-01').toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
    return `<div class="cols">${keys.map(k => `<div class="col" data-tip="${esc(`${nm(k)} ${k.slice(0, 4)}: ${m[k].n} new leads, ${m[k].w} won so far`)}"><span class="t">${m[k].n}</span><div class="b" style="height:${m[k].n / max * 85}%"><i style="height:${m[k].n ? m[k].w / m[k].n * 100 : 0}%"></i></div></div>`).join('')}</div>
      <div class="collab">${keys.map(k => `<div>${nm(k)}</div>`).join('')}</div>
      <div class="legend"><span><i class="sw" style="background:var(--s1)"></i>New leads</span><span><i class="sw" style="background:var(--accent)"></i>Of which won so far</span></div>`;
  }

  // ------------------------------------------------------------------ pages
  const PAGES = {};

  PAGES.dashboard = () => {
    const leads = applyF(DB.leads), M = metrics(leads);
    const srcConv = s => { const g = leads.filter(l => l.lead_source === s); return g.length ? g.filter(l => l.status === 'Won').length / g.length : 0; };
    const ranked = SOURCES.map(s => ({ s, c: srcConv(s), n: leads.filter(l => l.lead_source === s).length })).filter(x => x.n >= 5).sort((a, b) => b.c - a.c);
    const best = ranked[0], cold = ranked.find(x => x.s === 'Cold Email');
    const ratio = best && cold && cold.c ? best.c / cold.c : 0;
    const callFirst = leads.filter(l => isOpen(l) && l.lead_category !== 'Cold').map(l => ({ l, i: info(l) })).filter(x => x.i.fu === 'Overdue' || x.i.fu === 'Due today')
      .sort((a, b) => b.l.lead_score - a.l.lead_score || a.i.next.localeCompare(b.i.next)).slice(0, 8);
    const stageRows = OPEN_DEAL.map(s => { const os = M.open.filter(o => o.stage === s); return { n: s, v: sum(os, o => o.deal_value), label: money(sum(os, o => o.deal_value)), tip: `${s}: ${os.length} deals, ${inr(sum(os, o => o.deal_value))} (weighted ${inr(sum(os, o => o.deal_value * o.probability / 100))})`, c: STAGE_CHIP[s] }; });
    const reps = DB.reps.map(r => { const ls = leads.filter(l => l.sales_id === r.sales_id), ids = new Set(ls.map(l => l.lead_id)); return { n: r.sales_name, v: sum(DB.opportunities.filter(o => o.stage === 'Won' && ids.has(o.lead_id)), o => o.deal_value) }; }).sort((a, b) => b.v - a.v);
    return `<header class="ph"><div><div class="eyebrow">Sales dashboard · as of ${fdy(today)}</div>
        <h1>${money(M.weighted)} weighted pipeline, and ${M.overdue ? `${M.overdue} follow-up${M.overdue > 1 ? 's are' : ' is'} overdue` : 'no follow-ups are overdue'}</h1>
        <p>${M.total} leads, ${M.won} customers won (${pct(M.conv, 1)} conversion). ${ratio >= 1.5 ? `${best.s} leads convert at ${ratio.toFixed(1)}× the rate of cold email.` : ''}</p></div>
        <div class="actions"><a class="btn primary" href="#add">+ Add lead</a><a class="btn" href="#followups">Open follow-ups</a></div></header>
      ${filterBar()}
      <section class="kpis" aria-label="Key metrics">
        ${kpi('Total leads', M.total, `${leads.filter(isOpen).length} still open`)}
        ${kpi('Qualified leads', M.qualified, pct(M.total ? M.qualified / M.total : 0) + ' of all leads')}
        ${kpi('Hot leads', M.hot, 'score 75 or more')}
        ${kpi('Converted customers', M.won, `${M.lost} lost`, 'result')}
        ${kpi('Conversion rate', pct(M.conv, 1), `win rate ${pct(M.win, 1)}`)}
        ${kpi('Total pipeline value', money(M.pipeline), `${M.openN} open deals`)}
        ${kpi('Weighted pipeline', money(M.weighted), 'deal value × probability', 'result')}
        ${kpi('Revenue won', money(M.revenue), inr(M.revenue))}
        ${kpi('Overdue follow-ups', M.overdue, `${M.dueToday} due today`, M.overdue ? 'alert' : '')}
      </section>
      <div class="grid-main">
        <section class="card"><div class="hd"><h2>Conversion funnel</h2><span class="note">${M.total} leads → ${M.won} customers</span></div>${funnel(leads)}</section>
        <section class="card"><div class="hd"><h2>Call these first</h2><a href="#followups" class="small">All follow-ups →</a></div>
          <p class="note" style="margin:-6px 0 6px">Hot and warm leads with a follow-up overdue or due today, best score first.</p>
          ${callFirst.length ? `<div class="list">${callFirst.map(({ l, i }) => `<div class="li"><div><button class="t" data-act="open" data-id="${l.lead_id}">${esc(l.company_name)}</button><div class="m">${esc(rep(l.sales_id).sales_name)} · ${esc(l.status)} · ${i.fu === 'Overdue' ? `<b style="color:var(--crit)">${days(today, i.next)}d overdue</b>` : '<b>due today</b>'}</div></div><div style="display:grid;justify-items:end;gap:4px">${catChip(l.lead_category)}${scoreView(l)}</div></div>`).join('')}</div>` : '<div class="empty">Nothing overdue. Nice work.</div>'}
        </section>
      </div>
      <div class="grid2" style="margin-top:18px">
        <section class="card"><div class="hd"><h2>Monthly lead generation</h2></div>${monthly(leads)}</section>
        <section class="card"><div class="hd"><h2>Lead source quality</h2><span class="note">conversion rate</span></div>
          ${hrows(SOURCES.map(s => { const g = leads.filter(l => l.lead_source === s), w = g.filter(l => l.status === 'Won').length; return { n: s, v: g.length ? w / g.length : 0, label: pct(g.length ? w / g.length : 0, 1), tip: `${s}: ${w} won of ${g.length} leads`, c: SRC_COL[s] }; }).sort((a, b) => b.v - a.v))}
          <p class="note" style="margin:10px 0 0">Volume isn't quality: compare with lead counts on the Reports page.</p></section>
        <section class="card"><div class="hd"><h2>Open pipeline by stage</h2><span class="note">deal value</span></div>${hrows(stageRows)}</section>
        <section class="card"><div class="hd"><h2>Revenue won by sales rep</h2></div>${hrows(reps.map((r, i) => ({ ...r, label: money(r.v), c: 'var(--accent)' })))}</section>
      </div>`;
  };
  function kpi(l, v, s, cls = '') { return `<div class="kpi ${cls}"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s || '&nbsp;'}</div></div>`; }

  PAGES.leads = () => {
    let rows = DB.leads.filter(l => {
      if (LQ.q) { const q = LQ.q.toLowerCase(); const cs = IDX.contacts.get(l.lead_id) || []; if (!(l.company_name.toLowerCase().includes(q) || l.lead_id.toLowerCase().includes(q) || cs.some(c => c.contact_name.toLowerCase().includes(q) || (c.email || '').includes(q)))) return false; }
      return (!LQ.industry || l.industry === LQ.industry) && (!LQ.location || l.location === LQ.location) && (!LQ.source || l.lead_source === LQ.source)
        && (!LQ.rep || l.sales_id === LQ.rep) && (!LQ.cat || l.lead_category === LQ.cat) && (!LQ.stage || l.status === LQ.stage);
    });
    const key = { company_name: l => l.company_name.toLowerCase(), location: l => l.location, employees: l => l.employees, lead_score: l => l.lead_score, status: l => ORDER[l.status] || 9, lead_date: l => l.lead_date, next: l => info(l).next || '9999' }[LQ.sort];
    rows.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * LQ.dir || a.lead_id.localeCompare(b.lead_id); });
    const per = 25, pages = Math.max(1, Math.ceil(rows.length / per)); LQ.page = Math.min(LQ.page, pages);
    const view = rows.slice((LQ.page - 1) * per, LQ.page * per);
    const sel = (k, label, list, all) => `<label class="field">${label}<select id="lq-${k}" data-lq="${k}">${opts(list, LQ[k], all)}</select></label>`;
    const th = (k, l, r) => `<th class="${r ? 'r' : ''}" aria-sort="${LQ.sort === k ? (LQ.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button data-act="sort" data-k="${k}">${l}${LQ.sort === k ? (LQ.dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`;
    return `<header class="ph"><div><div class="eyebrow">Lead database</div><h1>${rows.length} of ${DB.leads.length} leads</h1><p>Search by company, contact or email. Click any row to see contacts, score breakdown and activity.</p></div>
        <div class="actions"><button class="btn" data-act="copy-csv">Copy as CSV</button><a class="btn primary" href="#add">+ Add lead</a></div></header>
      <form class="filters" onsubmit="return false" aria-label="Lead filters">
        <label class="field wide">Search<input type="search" id="lq-q" data-lq="q" value="${esc(LQ.q)}" placeholder="Company, contact, email or lead ID"></label>
        ${sel('industry', 'Industry', INDUSTRIES, 'All')}${sel('location', 'Location', CITIES, 'All')}${sel('source', 'Source', SOURCES, 'All')}
        ${sel('rep', 'Sales rep', DB.reps.map(r => [r.sales_id, r.sales_name]), 'All')}${sel('cat', 'Category', ['Hot', 'Warm', 'Cold'], 'All')}${sel('stage', 'Stage', STAGES, 'All')}
      </form>
      <div class="tablewrap"><div class="scroll"><table class="stack"><thead><tr>${th('company_name', 'Company')}${th('location', 'Location')}${th('employees', 'Employees', 1)}<th>Source</th><th>Sales rep</th>${th('lead_score', 'Score')}${th('status', 'Stage')}${th('next', 'Next follow-up')}${th('lead_date', 'Lead date')}</tr></thead>
      <tbody>${view.map(l => { const i = info(l); return `<tr class="click" data-act="open" data-id="${l.lead_id}" tabindex="0"><td><b>${esc(l.company_name)}</b><div class="note">${l.lead_id} · ${esc(l.industry)}</div></td><td>${esc(l.location)}</td><td class="r num">${l.employees.toLocaleString('en-IN')}</td><td>${chip(l.lead_source, SRC_COL[l.lead_source])}</td><td>${esc(rep(l.sales_id).sales_name)}</td><td>${scoreView(l)} <span class="note">${l.lead_category}</span></td><td>${stageChip(l.status)}</td><td class="num">${i.fu === 'Overdue' ? `<b style="color:var(--crit)">${fd(i.next)}</b>` : isOpen(l) ? fd(i.next) : '—'}</td><td class="num">${fd(l.lead_date)}</td></tr>`; }).join('') || `<tr><td colspan="9"><div class="empty">No leads match. Try clearing a filter.</div></td></tr>`}</tbody></table></div>
      <div class="pager"><span>Showing ${rows.length ? (LQ.page - 1) * per + 1 : 0}–${Math.min(LQ.page * per, rows.length)} of ${rows.length}</span><span class="actions"><button class="btn sm" data-act="page" data-p="${LQ.page - 1}" ${LQ.page <= 1 ? 'disabled' : ''}>← Previous</button><span class="small" style="align-self:center">Page ${LQ.page} of ${pages}</span><button class="btn sm" data-act="page" data-p="${LQ.page + 1}" ${LQ.page >= pages ? 'disabled' : ''}>Next →</button></span></div></div>`;
  };

  PAGES.add = () => `<header class="ph"><div><div class="eyebrow">Add lead</div><h1>Add a new business prospect</h1><p>The lead score updates as you type. Leads are auto-assigned to the rep who covers the city.</p></div><div class="actions"><button class="btn" data-act="fill-sample">Fill with sample company</button></div></header>
    <div class="grid-main"><form class="card" id="addForm" novalidate>
      <h2 style="margin-bottom:12px">Company</h2>
      <div class="formgrid">
        <label class="field full">Company name *<input id="a-company" name="company_name" required autocomplete="off"><span class="err" data-err="company_name"></span></label>
        <label class="field">Industry *<select id="a-industry" name="industry">${opts(INDUSTRIES, 'IT')}</select></label>
        <label class="field">Location *<select id="a-location" name="location">${opts(CITIES, 'Bangalore')}</select></label>
        <label class="field">Employees *<input id="a-emp" name="employees" type="number" min="1" inputmode="numeric" required><span class="err" data-err="employees"></span></label>
        <label class="field">Annual revenue (₹ crore)<input id="a-rev" name="annual_revenue_cr" type="number" min="0" step="0.1" inputmode="decimal"></label>
        <label class="field">Lead source *<select id="a-source" name="lead_source">${opts(SOURCES, 'LinkedIn')}</select></label>
        <label class="field">Assigned to<select id="a-rep" name="sales_id">${opts(DB.reps.map(r => [r.sales_id, `${r.sales_name} (${r.base_city})`]), 'S02')}</select></label>
      </div>
      <h2 style="margin:20px 0 12px">Primary contact</h2>
      <div class="formgrid">
        <label class="field">Contact person *<input id="a-name" name="contact_name" required autocomplete="off"><span class="err" data-err="contact_name"></span></label>
        <label class="field">Designation<select id="a-title" name="designation">${opts(TITLES, 'HR Manager')}</select></label>
        <label class="field">Business email<input id="a-email" name="email" type="email" autocomplete="off" placeholder="name@company.com"><span class="err" data-err="email"></span></label>
        <label class="field">Phone (10 digits)<input id="a-phone" name="phone" type="tel" inputmode="tel" placeholder="98XXXXXXXX"><span class="err" data-err="phone"></span></label>
        <label class="field full"><span><input type="checkbox" id="a-int" name="interested" style="width:auto;min-height:auto;margin-right:8px">The company has already expressed interest (replied or asked for a demo)</span></label>
      </div>
      <div class="actions" style="margin-top:18px"><button class="btn primary" type="submit">Save lead</button><a class="btn ghost" href="#leads">Cancel</a></div>
      <p class="note">Use business contact details shared with consent. Do not add personal data scraped without permission.</p>
    </form>
    <aside class="card sticky" id="scorePreview" aria-live="polite"></aside></div>`;

  function formLead(form) {
    const v = Object.fromEntries(new FormData(form));
    return { company_name: (v.company_name || '').trim(), industry: v.industry, location: v.location, employees: +v.employees || 0, annual_revenue_cr: v.annual_revenue_cr ? +v.annual_revenue_cr : null,
      lead_source: v.lead_source, sales_id: v.sales_id, contact_name: (v.contact_name || '').trim(), designation: v.designation, email: (v.email || '').trim().toLowerCase(),
      phone: (v.phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, ''), interested: !!v.interested };
  }
  const EMAIL_RE = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/;
  function drawPreview() {
    const f = $('#addForm'), box = $('#scorePreview'); if (!f || !box) return;
    const x = formLead(f);
    const parts = [
      { k: 'Company has more than 200 employees', p: 25, ok: x.employees > 200 },
      { k: 'Belongs to a target industry', p: 20, ok: TARGET.includes(x.industry) },
      { k: 'Decision-maker identified', p: 20, ok: DM.includes(x.designation) && !!x.contact_name },
      { k: 'Has expressed interest', p: 25, ok: x.interested },
      { k: 'Valid business contact information', p: 10, ok: EMAIL_RE.test(x.email) && x.phone.length === 10 }];
    const s = sum(parts.filter(p => p.ok), p => p.p), c = classify(s);
    const dup = x.company_name && DB.leads.find(l => l.company_name.toLowerCase() === x.company_name.toLowerCase() && l.location === x.location);
    box.innerHTML = `<h2>Lead score preview</h2><div style="display:flex;gap:16px;align-items:center;margin:14px 0">${ring(s, c)}<div><div class="num-xl" style="font-size:30px;font-weight:700">${s}<span class="muted" style="font-size:16px"> / 100</span></div>${catChip(c + ' lead')}</div></div>${critList(parts)}
      <p class="note" style="margin-top:12px">75–100 Hot · 40–74 Warm · 0–39 Cold</p>${dup ? `<p style="color:var(--crit);font-weight:600;margin:8px 0 0">Possible duplicate: ${esc(dup.company_name)} (${dup.lead_id}) already exists in ${esc(dup.location)}.</p>` : ''}`;
  }
  function ring(s, c) { const r = 36, C = 2 * Math.PI * r; return `<svg class="ring" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--track)" stroke-width="9"/><circle cx="42" cy="42" r="${r}" fill="none" stroke="${CAT_COL[c]}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${s / 100 * C} ${C}" transform="rotate(-90 42 42)"/></svg>`; }
  function critList(parts) { return `<ul class="crit">${parts.map(p => `<li><span class="${p.ok ? 'ok' : 'no'}">${p.ok ? '✓' : '○'}</span><span${p.ok ? '' : ' class="muted"'}>${p.k}</span><span class="num ${p.ok ? '' : 'muted'}">+${p.p}</span></li>`).join('')}</ul>`; }
  function submitLead(form) {
    const x = formLead(form), errs = {};
    if (!x.company_name) errs.company_name = 'Enter the company name';
    if (!(x.employees > 0)) errs.employees = 'Enter the number of employees';
    if (!x.contact_name) errs.contact_name = 'Enter a contact name';
    if (x.email && !EMAIL_RE.test(x.email)) errs.email = 'This email address is not valid';
    if (x.phone && x.phone.length !== 10) errs.phone = 'Phone must have 10 digits';
    form.querySelectorAll('[data-err]').forEach(e => { e.textContent = errs[e.dataset.err] || ''; const i = form.querySelector(`[name="${e.dataset.err}"]`); if (i) i.setAttribute('aria-invalid', errs[e.dataset.err] ? 'true' : 'false'); });
    const first = Object.keys(errs)[0]; if (first) { form.querySelector(`[name="${first}"]`).focus(); return; }
    const l = { lead_id: nextId(DB.leads, 'lead_id', 'L', 4), company_name: x.company_name, industry: x.industry, location: x.location, employees: x.employees, annual_revenue_cr: x.annual_revenue_cr,
      lead_source: x.lead_source, lead_date: today, sales_id: x.sales_id, status: 'New Lead', max_stage_reached: 'New Lead', lost_at_stage: null, lost_reason: null,
      decision_maker: false, interested: false, valid_contact: false, lead_score: 0, lead_category: 'Cold' };
    const c = { contact_id: nextId(DB.contacts, 'contact_id', 'C', 4), lead_id: l.lead_id, contact_name: x.contact_name, email: x.email || null, phone: x.phone ? '+91' + x.phone : null, designation: x.designation, valid_email: EMAIL_RE.test(x.email) };
    DB.leads.push(l); DB.contacts.push(c);
    api('POST', '/leads', { lead: l, contact: c });
    if (x.interested) { reindex(); addActivity(l, { activity_type: 'Email', outcome: 'Replied', notes: 'Expressed interest when the lead was captured' }); l.status = 'Contacted'; l.max_stage_reached = 'Contacted'; }
    reindex(); rescore(l); api('PATCH', '/leads/' + l.lead_id, l); save();
    toast(`${l.company_name} added as a ${l.lead_category} lead (${l.lead_score} points)`);
    location.hash = '#leads'; LQ.q = ''; LQ.sort = 'lead_date'; LQ.dir = -1; LQ.page = 1;
    setTimeout(() => openDrawer(l.lead_id), 60);
  }

  PAGES.followups = () => {
    const open = DB.leads.filter(l => isOpen(l) && (!fuRep || l.sales_id === fuRep)).map(l => ({ l, i: info(l) }));
    const groups = [
      { k: 'overdue', t: 'Overdue', c: 'var(--crit)', items: open.filter(x => x.i.fu === 'Overdue').sort((a, b) => a.i.next.localeCompare(b.i.next)), tag: x => `<b style="color:var(--crit)">${days(today, x.i.next)}d overdue</b>` },
      { k: 'today', t: 'Due today', c: 'var(--warn)', items: open.filter(x => x.i.fu === 'Due today').sort((a, b) => b.l.lead_score - a.l.lead_score), tag: () => '<b>Today</b>' },
      { k: 'week', t: 'Next 7 days', c: 'var(--s1)', items: open.filter(x => x.i.fu === 'This week').sort((a, b) => a.i.next.localeCompare(b.i.next)), tag: x => fd(x.i.next) },
      { k: 'idle', t: 'No activity 14+ days', c: 'var(--muted)', items: open.filter(x => x.i.idle >= 14).sort((a, b) => b.i.idle - a.i.idle), tag: x => `${x.i.idle}d idle` }];
    const col = g => { const lim = showAll[g.k] ? 999 : 12; return `<section class="card fu-col"><h3><span>${chip(g.t, g.c)}</span><span class="count">${g.items.length}</span></h3>
      ${g.items.length ? `<div class="list">${g.items.slice(0, lim).map(x => `<div class="li"><div><button class="t" data-act="open" data-id="${x.l.lead_id}">${esc(x.l.company_name)}</button><div class="m">${esc(rep(x.l.sales_id).sales_name)} · ${esc(x.l.status)}${x.i.last ? ` · last: ${esc(x.i.last.activity_type)} ${fd(x.i.last.activity_date)}` : ' · never contacted'}</div><div class="m">${g.tag(x)}</div></div><button class="btn sm" data-act="log" data-id="${x.l.lead_id}">Log</button></div>`).join('')}</div>${g.items.length > lim ? `<button class="btn sm ghost" style="width:100%;margin-top:8px" data-act="show-all" data-k="${g.k}">Show all ${g.items.length}</button>` : ''}` : '<div class="empty">All clear</div>'}</section>`; };
    return `<header class="ph"><div><div class="eyebrow">Follow-up management</div><h1>${groups[0].items.length} overdue, ${groups[1].items.length} due today</h1><p>Based on each open lead's latest activity. Use <b>Log</b> to record a touch and set the next follow-up date.</p></div>
      <label class="field" style="min-width:220px">Sales rep<select id="fu-rep" data-fu>${opts(DB.reps.map(r => [r.sales_id, r.sales_name]), fuRep, 'All reps')}</select></label></header>
      <div class="fu-cols">${groups.map(col).join('')}</div>`;
  };

  PAGES.pipeline = () => {
    const ok = o => { const l = IDX.lead.get(o.lead_id); return l && (!pipeRep || l.sales_id === pipeRep); };
    const opps = DB.opportunities.filter(ok);
    const open = opps.filter(o => OPEN_DEAL.includes(o.stage));
    const early = DB.leads.filter(l => (!pipeRep || l.sales_id === pipeRep));
    const lane = s => {
      let os = opps.filter(o => o.stage === s);
      const closed = s === 'Won' || s === 'Lost';
      os.sort(closed ? (a, b) => (b.close_date || '').localeCompare(a.close_date || '') : (a, b) => b.deal_value - a.deal_value);
      const lim = closed && !showAll['lane-' + s] ? 6 : 999;
      return `<section class="lane" data-lane="${s}" aria-label="${s}"><div class="lane-hd"><div class="row1"><span>${chip(s, STAGE_CHIP[s])}</span><span class="num">${os.length}</span></div><div class="row2">${money(sum(os, o => o.deal_value))}${closed ? '' : ` · weighted ${money(sum(os, o => o.deal_value * o.probability / 100))}`}</div></div>
        ${os.slice(0, lim).map(o => card(o)).join('') || '<div class="more">Drop a deal here</div>'}
        ${os.length > lim ? `<button class="btn sm ghost" data-act="show-all" data-k="lane-${s}">Show all ${os.length}</button>` : ''}</section>`;
    };
    const card = o => { const l = IDX.lead.get(o.lead_id), i = info(l); return `<article class="deal" draggable="true" data-deal="${l.lead_id}">
      <button class="co" data-act="open" data-id="${l.lead_id}">${esc(l.company_name)}</button>
      <div class="meta"><span class="val">${money(o.deal_value)}</span><span>${o.probability}%</span></div>
      <div class="meta">${avatar(l.sales_id)}<span>${isOpen(l) ? (i.fu === 'Overdue' ? `<b style="color:var(--crit)">follow-up ${days(today, i.next)}d late</b>` : i.next ? 'next ' + fd(i.next) : '') : (o.close_date ? 'closed ' + fd(o.close_date) : '')}</span>${catChip(l.lead_category)}</div>
      <label class="small muted">Move to <select data-move="${l.lead_id}" aria-label="Move ${esc(l.company_name)} to stage">${opts([...OPEN_DEAL, 'Won', 'Lost'], o.stage)}</select></label></article>`; };
    return `<header class="ph"><div><div class="eyebrow">Sales pipeline</div><h1>${money(sum(open, o => o.deal_value))} in ${open.length} open deals, ${money(sum(open, o => o.deal_value * o.probability / 100))} weighted</h1><p>Drag a deal to another stage, or use “Move to” on the card. Probability updates with the stage.</p></div>
      <label class="field" style="min-width:220px">Sales rep<select id="pipe-rep" data-pipe>${opts(DB.reps.map(r => [r.sales_id, r.sales_name]), pipeRep, 'All reps')}</select></label></header>
      <div class="early"><span class="muted">Before qualification:</span>${chip(`New Lead · ${early.filter(l => l.status === 'New Lead').length}`, STAGE_CHIP['New Lead'])}${chip(`Contacted · ${early.filter(l => l.status === 'Contacted').length}`, STAGE_CHIP['Contacted'])}<a href="#leads" class="small" data-act="leads-stage" data-stage="Contacted">Qualify them from the lead database →</a></div>
      <div class="board" id="board">${[...OPEN_DEAL, 'Won', 'Lost'].map(lane).join('')}</div>`;
  };

  PAGES.reports = () => {
    const leads = applyF(DB.leads), M = metrics(leads);
    const by = (key, list) => list.map(v => ({ n: v, v: leads.filter(l => l[key] === v).length })).sort((a, b) => b.v - a.v);
    const wonOpps = M.opps.filter(o => o.stage === 'Won'), lostOpps = M.opps.filter(o => o.stage === 'Lost');
    const reasons = {}; leads.filter(l => l.status === 'Lost').forEach(l => reasons[l.lost_reason] = (reasons[l.lost_reason] || 0) + 1);
    const repRows = DB.reps.map((r, i) => {
      const ls = leads.filter(l => l.sales_id === r.sales_id), ids = new Set(ls.map(l => l.lead_id));
      const won = ls.filter(l => l.status === 'Won').length, lost = ls.filter(l => l.status === 'Lost').length;
      const os = DB.opportunities.filter(o => ids.has(o.lead_id));
      return { r, i, n: ls.length, q: ls.filter(l => ORDER[l.max_stage_reached] >= 3).length, won, lost, win: won + lost ? won / (won + lost) : 0, conv: ls.length ? won / ls.length : 0,
        rev: sum(os.filter(o => o.stage === 'Won'), o => o.deal_value), wp: sum(os.filter(o => OPEN_DEAL.includes(o.stage)), o => o.deal_value * o.probability / 100),
        od: ls.filter(l => isOpen(l) && info(l).fu === 'Overdue').length };
    }).sort((a, b) => b.rev - a.rev);
    const maxWin = Math.max(...repRows.map(x => x.win), 0.01);
    const cycle = INDUSTRIES.map(ind => { const w = leads.filter(l => l.industry === ind && l.status === 'Won').map(l => IDX.opp.get(l.lead_id)).filter(o => o && o.close_date); const ds = w.map(o => days(o.close_date, IDX.lead.get(o.lead_id).lead_date)); return { n: ind, v: ds.length ? Math.round(sum(ds, x => x) / ds.length) : 0, k: ds.length }; }).filter(x => x.k).sort((a, b) => a.v - b.v);
    const cats = ['Hot', 'Warm', 'Cold'].map(c => { const g = leads.filter(l => l.lead_category === c), w = g.filter(l => l.status === 'Won').length; return { n: c, v: g.length ? w / g.length : 0, label: pct(g.length ? w / g.length : 0, 1), tip: `${c}: ${w} won of ${g.length}`, c: CAT_COL[c] }; });
    const inSet = new Set(leads.map(l => l.lead_id));
    const steps = CADENCE.map(([s, d]) => { const a = DB.activities.filter(x => x.cadence_step === s && inSet.has(x.lead_id)); const r = a.filter(x => x.outcome === 'Replied').length; return { n: d, v: a.length ? r / a.length : 0, label: pct(a.length ? r / a.length : 0, 1), tip: `${d}: ${r} replies from ${a.length} touches` }; });
    return `<header class="ph"><div><div class="eyebrow">Reports</div><h1>Sales analytics</h1><p>Lead generation, pipeline, rep performance and follow-up health. All charts respond to the filters.</p></div></header>
      ${filterBar()}
      <h2 class="section-title">A · Overall performance</h2>
      <section class="kpis">${kpi('Total leads', M.total)}${kpi('Qualified leads', M.qualified)}${kpi('Hot leads', M.hot)}${kpi('Converted customers', M.won, '', 'result')}${kpi('Conversion rate', pct(M.conv, 1))}${kpi('Pipeline value', money(M.pipeline))}${kpi('Weighted pipeline', money(M.weighted), '', 'result')}</section>
      <h2 class="section-title">B · Lead generation <span>where leads come from</span></h2>
      <div class="grid2">
        <section class="card"><div class="hd"><h3>Leads by industry</h3></div>${hrows(by('industry', INDUSTRIES).map(x => ({ ...x, c: TARGET.includes(x.n) ? 'var(--s1)' : 'var(--muted)' })))}<p class="note" style="margin:8px 0 0">Grey = outside the 5 target industries.</p></section>
        <section class="card"><div class="hd"><h3>Leads by location</h3></div>${hrows(by('location', CITIES))}</section>
        <section class="card"><div class="hd"><h3>Leads by source</h3></div>${donut(SOURCES.map(s => ({ n: s, v: leads.filter(l => l.lead_source === s).length, c: SRC_COL[s] })), M.total, 'leads')}</section>
        <section class="card"><div class="hd"><h3>Monthly lead generation</h3></div>${monthly(leads)}</section>
      </div>
      <h2 class="section-title">C · Sales pipeline <span>how deals move</span></h2>
      <div class="grid2">
        <section class="card"><div class="hd"><h3>Leads by pipeline stage (funnel)</h3></div>${funnel(leads)}</section>
        <section class="card"><div class="hd"><h3>Deal value by stage</h3><span class="note">open deals</span></div>${hrows(OPEN_DEAL.map(s => { const os = M.open.filter(o => o.stage === s); return { n: s, v: sum(os, o => o.deal_value), label: money(sum(os, o => o.deal_value)), c: STAGE_CHIP[s], tip: `${s}: ${os.length} deals` }; }))}
          <div class="kpis" style="margin:16px 0 0;grid-template-columns:repeat(2,minmax(0,1fr))">${kpi('Expected revenue (weighted)', money(M.weighted), `from ${M.openN} open deals`, 'result')}${kpi('Average won deal', money(wonOpps.length ? sum(wonOpps, o => o.deal_value) / wonOpps.length : 0), `${wonOpps.length} deals won`)}</div></section>
        <section class="card"><div class="hd"><h3>Won vs lost opportunities</h3></div>${donut([{ n: 'Won', v: wonOpps.length, c: 'var(--good)', label: `${wonOpps.length} · ${money(sum(wonOpps, o => o.deal_value))}` }, { n: 'Lost', v: lostOpps.length, c: '#98a4aa', label: `${lostOpps.length} · ${money(sum(lostOpps, o => o.deal_value))}` }], pct(wonOpps.length + lostOpps.length ? wonOpps.length / (wonOpps.length + lostOpps.length) : 0), 'deal win rate')}</section>
        <section class="card"><div class="hd"><h3>Why leads are lost</h3></div>${hrows(Object.entries(reasons).map(([n, v]) => ({ n, v, c: 'var(--serious)' })).sort((a, b) => b.v - a.v))}</section>
      </div>
      <h2 class="section-title">D · Sales representative performance</h2>
      <div class="tablewrap"><div class="scroll"><table class="stack"><thead><tr><th>Sales rep</th><th class="r">Leads</th><th class="r">Qualified</th><th class="r">Won</th><th>Win rate</th><th class="r">Conversion</th><th class="r">Revenue won</th><th class="r">Weighted pipeline</th><th class="r">Overdue</th></tr></thead>
        <tbody>${repRows.map(x => `<tr><td><span style="display:inline-flex;gap:8px;align-items:center">${avatar(x.r.sales_id)}<b>${esc(x.r.sales_name)}</b></span><div class="note">${esc(x.r.region)} · ${esc(x.r.base_city)}</div></td><td class="r num">${x.n}</td><td class="r num">${x.q}</td><td class="r num">${x.won}</td><td><span class="score">${pct(x.win, 1)}<span class="m" style="width:70px"><i style="width:${x.win / maxWin * 100}%;background:var(--s3)"></i></span></span></td><td class="r num">${pct(x.conv, 1)}</td><td class="r num"><b>${money(x.rev)}</b></td><td class="r num">${money(x.wp)}</td><td class="r num" style="${x.od ? 'color:var(--crit);font-weight:700' : ''}">${x.od}</td></tr>`).join('')}</tbody></table></div></div>
      <h2 class="section-title">E · Follow-up management</h2>
      <section class="kpis">${kpi('Overdue follow-ups', M.overdue, 'past their date', M.overdue ? 'alert' : '')}${kpi('Due today', M.dueToday)}${kpi('Upcoming (7 days)', M.week)}${kpi('No activity 14+ days', M.idle, 'open leads going cold', M.idle ? 'alert' : '')}</section>
      <div class="grid3">
        <section class="card"><div class="hd"><h3>Does the lead score work?</h3></div>${hrows(cats, { max: Math.max(...cats.map(c => c.v), 0.01) })}<p class="note" style="margin:10px 0 0">Conversion rate by category. “Expressed interest” is part of the score, so some of this lift is built in.</p></section>
        <section class="card"><div class="hd"><h3>Days to close by industry</h3></div>${hrows(cycle.map(x => ({ ...x, label: x.v + ' days', tip: `${x.n}: ${x.v} days on average over ${x.k} won deals`, c: 'var(--s3)' })))}</section>
        <section class="card"><div class="hd"><h3>Reply rate by cadence step</h3></div>${hrows(steps, { max: Math.max(...steps.map(s => s.v), 0.01), c: 'var(--accent)' })}<p class="note" style="margin:10px 0 0">Day 14 “break-up” emails get no replies in this data. Consider dropping that step.</p></section>
      </div>`;
  };

  PAGES.outreach = () => {
    const openLeads = DB.leads.filter(l => isOpen(l) && (IDX.contacts.get(l.lead_id) || []).length).sort((a, b) => b.lead_score - a.lead_score);
    if (!outLead || !IDX.lead.has(outLead)) outLead = openLeads[0]?.lead_id || '';
    const l = IDX.lead.get(outLead), cs = l ? IDX.contacts.get(l.lead_id) : [], c = cs.find(x => DM.includes(x.designation)) || cs[0];
    const t = TEMPLATES[outTpl];
    const fill = s => s.replace(/\[Contact Name\]/g, c ? c.contact_name.split(' ')[0] : 'there').replace(/\[Company Name\]/g, l ? l.company_name : 'your company').replace(/\[Rep Name\]/g, l ? rep(l.sales_id).sales_name : '');
    if (outText === null) outText = `Subject: ${fill(t.subject)}\n\n${fill(t.body)}`;
    const steps = CADENCE.map(([s, d, txt]) => { const a = DB.activities.filter(x => x.cadence_step === s), r = a.filter(x => x.outcome === 'Replied').length; return { s, d, txt, rate: a.length ? r / a.length : 0, r, n: a.length }; });
    const maxR = Math.max(...steps.map(s => s.rate), 0.01);
    const sent = l ? (IDX.acts.get(l.lead_id) || []).filter(a => a.cadence_step).length : 0;
    return `<header class="ph"><div><div class="eyebrow">Outreach</div><h1>Email templates and follow-up cadence</h1><p>Pick a lead and the template fills in the contact, company and rep. Edit it, copy it, then log it as sent.</p></div></header>
      <div class="grid-main"><section class="card stack-gap">
        <label class="field">Lead<select id="out-lead" data-out>${openLeads.map(x => opt(x.lead_id, `${x.company_name} · ${x.lead_category} ${x.lead_score} · ${x.status}`, outLead)).join('')}</select></label>
        <div class="tabs" role="group" aria-label="Template">${TEMPLATES.map((x, i) => `<button type="button" data-act="tpl" data-i="${i}" aria-pressed="${i === outTpl}">${x.name}</button>`).join('')}</div>
        ${c ? `<p class="small muted" style="margin:0">To: <b style="color:var(--ink)">${esc(c.contact_name)}</b>, ${esc(c.designation)} · ${esc(c.email || 'no email')} ${c.valid_email ? '' : '<b style="color:var(--crit)">(invalid email)</b>'}</p>` : ''}
        <label class="field">Message<textarea id="out-text" class="tpl" data-outtext>${esc(outText)}</textarea></label>
        <div class="actions"><button class="btn primary" data-act="copy-tpl">Copy email</button><button class="btn" data-act="log-sent" ${l ? '' : 'disabled'}>Log as sent (step ${Math.min(sent + 1, 5)})</button><button class="btn ghost" data-act="reset-tpl">Reset text</button></div>
        <p class="note" style="margin:0">Respect opt-outs and email and privacy rules. Only email business contacts who can reasonably expect it.</p>
      </section>
      <aside class="card"><h2>Follow-up cadence</h2><p class="note">Reply rate for each step across all ${DB.activities.filter(a => a.cadence_step).length} outreach touches.</p>
        <ol class="cadence">${steps.map(s => `<li><span class="d">${s.d}</span><div><b>${s.txt}</b><div class="hrow" style="grid-template-columns:minmax(0,1fr) 7em;margin-top:4px" data-tip="${s.r} replies from ${s.n} touches"><div class="bartrack"><div class="bar" style="width:${s.rate / maxR * 100}%;background:var(--accent)"></div></div><span class="v small">${pct(s.rate, 1)} reply</span></div></div></li>`).join('')}</ol>
        <p class="note" style="margin-top:14px">Most replies come from the first three touches. After Day 14, update the lead to Lost (reason: no response) so the pipeline stays honest.</p></aside></div>`;
  };

  // ------------------------------------------------------------------ drawer
  function openDrawer(id) { drawerId = id; renderDrawer(); $('#drawer').classList.add('on'); $('#scrim').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false'); setTimeout(() => $('#drawer .x')?.focus(), 30); }
  function closeDrawer() { const id = drawerId; drawerId = null; $('#drawer').classList.remove('on'); $('#scrim').classList.remove('on'); $('#drawer').setAttribute('aria-hidden', 'true'); document.querySelector(`[data-id="${id}"]`)?.focus(); }
  function renderDrawer() {
    const l = IDX.lead.get(drawerId); if (!l) return;
    const i = info(l), parts = scoreParts(l), o = i.opp;
    const cur = ORDER[l.status], max = ORDER[l.max_stage_reached];
    $('#drawer').innerHTML = `<div class="dr-hd"><div><div class="small muted">${l.lead_id} · ${esc(l.industry)} · ${esc(l.location)}</div><h2 style="font-size:22px">${esc(l.company_name)}</h2>
        <div class="small muted">${l.employees.toLocaleString('en-IN')} employees${l.annual_revenue_cr != null ? ` · ₹${l.annual_revenue_cr} Cr revenue` : ''} · ${chip(l.lead_source, SRC_COL[l.lead_source])} · added ${fd(l.lead_date)}</div></div>
        <button class="x" data-act="close-drawer" aria-label="Close">×</button></div>
      <div class="dr-body">
        <section class="card"><div class="hd"><h3>Pipeline stage</h3>${stageChip(l.status)}</div>
          <div class="stepper">${STAGES.slice(0, 7).map(s => { const n = ORDER[s]; const cls = l.status === s ? (s === 'Won' ? 'won' : 'cur') : (n <= max && l.status !== 'Lost' && n < cur) ? 'done' : ''; return `<button class="${cls}" data-act="stage" data-id="${l.lead_id}" data-stage="${s}" aria-pressed="${l.status === s}">${s.replace(' Scheduled', '').replace(' Sent', '')}</button>`; }).join('')}<button class="${l.status === 'Lost' ? 'lost' : ''}" data-act="stage" data-id="${l.lead_id}" data-stage="Lost" aria-pressed="${l.status === 'Lost'}">Lost</button></div>
          ${l.status === 'Lost' ? `<p class="small" style="margin:10px 0 0">Lost at <b>${esc(l.lost_at_stage || '')}</b> · ${esc(l.lost_reason || '')}</p>` : ''}
          <label class="field" style="margin-top:12px">Assigned sales rep<select id="dr-rep" data-rep="${l.lead_id}">${opts(DB.reps.map(r => [r.sales_id, `${r.sales_name} (${r.region})`]), l.sales_id)}</select></label></section>
        <section class="card"><div class="hd"><h3>Lead score</h3>${catChip(l.lead_category + ' lead')}</div><div style="display:flex;gap:16px;align-items:center">${ring(l.lead_score, l.lead_category)}<div style="flex:1">${critList(parts)}</div></div></section>
        ${o ? `<section class="card"><div class="hd"><h3>Opportunity ${o.opportunity_id}</h3>${stageChip(o.stage)}</div><dl class="kv">
          <dt>Deal value</dt><dd><input class="inp" style="max-width:180px" type="number" min="0" step="5000" id="dr-deal" data-deal="${l.lead_id}" value="${o.deal_value}" aria-label="Deal value in rupees"> <span class="small muted">${inr(o.deal_value)}</span></dd>
          <dt>Probability</dt><dd>${o.probability}% → weighted <b>${inr(o.deal_value * o.probability / 100)}</b></dd>
          <dt>Created</dt><dd>${fdy(o.created_date)}</dd><dt>${o.close_date ? 'Closed' : 'Expected close'}</dt><dd>${fdy(o.close_date || o.expected_close_date)}</dd></dl></section>` : ''}
        <section class="card"><div class="hd"><h3>Contacts</h3><span class="note">${i.contacts.length}</span></div>${i.contacts.map(c => `<div class="li"><div><b>${esc(c.contact_name)}</b> ${DM.includes(c.designation) ? '<span class="tag">Decision-maker</span>' : ''}<div class="m">${esc(c.designation)}</div><div class="m">${esc(c.email || '—')} ${c.valid_email ? '' : '<b style="color:var(--crit)">invalid</b>'} · ${esc(c.phone || 'no phone')}</div></div>${c.email ? `<button class="btn sm" data-act="copy" data-text="${esc(c.email)}">Copy email</button>` : ''}</div>`).join('') || '<div class="empty">No contacts</div>'}</section>
        ${isOpen(l) ? `<form class="card" id="logForm" data-lead="${l.lead_id}"><div class="hd"><h3>Log activity</h3>${i.fu ? `<span class="small" style="${i.fu === 'Overdue' ? 'color:var(--crit);font-weight:700' : ''}">${i.fu === 'Overdue' ? `Follow-up ${days(today, i.next)}d overdue` : i.next ? 'Next follow-up ' + fd(i.next) : i.fu}</span>` : ''}</div>${logFields()}<div class="actions" style="margin-top:12px"><button class="btn primary" type="submit">Save activity</button><button type="button" class="btn ghost" data-act="draft" data-id="${l.lead_id}">Draft email</button></div></form>` : ''}
        <section class="card"><div class="hd"><h3>Activity timeline</h3><span class="note">${i.acts.length} activities</span></div>
          ${i.acts.length ? `<ol class="timeline">${i.acts.slice().reverse().map(a => `<li style="--c:${a.outcome === 'Closed Won' ? 'var(--good)' : a.outcome === 'Closed Lost' ? 'var(--crit)' : INTEREST.includes(a.outcome) ? 'var(--accent)' : 'var(--s1)'}"><div><b>${esc(a.activity_type)}</b> · ${esc(a.outcome || '')}${a.cadence_step ? ` <span class="tag">step ${a.cadence_step}</span>` : ''}</div><div class="small muted">${fdy(a.activity_date)} · ${esc(rep(a.sales_id).sales_name)}${a.next_followup ? ` · next follow-up ${fd(a.next_followup)}` : ''}</div>${a.notes ? `<div class="small">${esc(a.notes)}</div>` : ''}</li>`).join('')}</ol>` : '<div class="empty">No activity yet. Log the first touch above.</div>'}</section>
      </div>`;
  }
  const logFields = () => `<div class="formgrid"><label class="field">Type<select name="activity_type">${opts(ACT_TYPES, 'Call')}</select></label><label class="field">Outcome<select name="outcome">${opts(ACT_OUTCOMES, 'Follow-up done')}</select></label>
    <label class="field full">Notes<input name="notes" autocomplete="off" placeholder="What happened? What's next?"></label><label class="field">Next follow-up<input type="date" name="next_followup" value="${addDays(today, 3)}"></label></div>`;
  function readLog(form) { const v = Object.fromEntries(new FormData(form)); return { activity_type: v.activity_type, outcome: v.outcome, notes: v.notes || '', next_followup: v.next_followup || null }; }

  // ------------------------------------------------------------------ modal, toast, tooltip
  let modalSave = null;
  function modal(title, body, label, onSave) {
    const m = $('#modal');
    m.innerHTML = `<form class="box" role="dialog" aria-modal="true" aria-labelledby="m-t"><h2 id="m-t">${title}</h2>${body}<div class="actions" style="justify-content:flex-end"><button type="button" class="btn ghost" data-act="modal-cancel">Cancel</button><button class="btn primary" type="submit">${label}</button></div></form>`;
    modalSave = onSave; m.classList.add('on');
    setTimeout(() => m.querySelector('select,input,textarea,button')?.focus(), 20);
  }
  function closeModal() { $('#modal').classList.remove('on'); modalSave = null; }
  let tt;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2600); }
  function copy(text, msg) {
    const fallback = () => modal('Copy this text', `<textarea class="inp" style="min-height:220px;padding:10px;font:13px/1.4 ui-monospace,monospace" readonly>${esc(text)}</textarea><p class="note" style="margin:0">Your browser blocked automatic copying. Select all (Ctrl/Cmd + A) and copy.</p>`, 'Done', () => true);
    try { navigator.clipboard.writeText(text).then(() => toast(msg), fallback); } catch (e) { fallback(); }
  }
  function askLost(id) {
    modal('Mark as lost', `<label class="field">Reason<select name="reason">${opts(LOST_REASONS, 'Not interested')}</select></label><p class="note" style="margin:0">The lead keeps its history, so it still counts in the funnel up to the stage it reached.</p>`, 'Mark lost', f => { setStage(id, 'Lost', new FormData(f).get('reason')); return true; });
  }

  // ------------------------------------------------------------------ render + routing
  function render() {
    const a = document.activeElement, fid = a && a.id, sel = a && 'selectionStart' in a ? [a.selectionStart, a.selectionEnd] : null;
    $('#page').innerHTML = (PAGES[page] || PAGES.dashboard)();
    document.querySelectorAll('.nav a').forEach(x => x.getAttribute('href') === '#' + page ? x.setAttribute('aria-current', 'page') : x.removeAttribute('aria-current'));
    const od = DB.leads.filter(l => isOpen(l) && info(l).fu === 'Overdue').length;
    $('#od-badge').textContent = od; $('#od-badge').hidden = !od;
    $('#today').value = today;
    if (page === 'add') drawPreview();
    if (fid) { const n = document.getElementById(fid); if (n) { n.focus({ preventScroll: true }); try { if (sel) n.setSelectionRange(sel[0], sel[1]); } catch (e) { /* not a text input */ } } }
  }
  function route() {
    const h = location.hash.slice(1);
    const next = PAGES[h] ? h : 'dashboard';
    if (next !== page) { page = next; window.scrollTo(0, 0); outText = null; }
    render();
  }

  // ------------------------------------------------------------------ events
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const act = t.dataset.act, id = t.dataset.id;
    if (t.tagName === 'A' && act !== 'leads-stage') return;
    if (act === 'open') { e.preventDefault(); openDrawer(id); }
    else if (act === 'close-drawer') closeDrawer();
    else if (act === 'stage') { const s = t.dataset.stage; if (s === 'Lost') askLost(id); else setStage(id, s); }
    else if (act === 'log') { const l = IDX.lead.get(id); modal(`Log activity · ${esc(l.company_name)}`, logFields(), 'Save', f => { logActivity(id, readLog(f)); return true; }); }
    else if (act === 'page') { LQ.page = +t.dataset.p; render(); $('.tablewrap')?.scrollIntoView({ block: 'nearest' }); }
    else if (act === 'sort') { const k = t.dataset.k; if (LQ.sort === k) LQ.dir *= -1; else { LQ.sort = k; LQ.dir = (k === 'company_name' || k === 'location' || k === 'next') ? 1 : -1; } render(); }
    else if (act === 'reset-filters') { Object.keys(F).forEach(k => F[k] = ''); render(); }
    else if (act === 'show-all') { showAll[t.dataset.k] = true; render(); }
    else if (act === 'leads-stage') { e.preventDefault(); Object.assign(LQ, { stage: t.dataset.stage, page: 1, sort: 'lead_score', dir: -1 }); location.hash = '#leads'; }
    else if (act === 'copy') copy(t.dataset.text, 'Copied');
    else if (act === 'copy-csv') {
      const cols = ['lead_id', 'company_name', 'industry', 'location', 'employees', 'annual_revenue_cr', 'lead_source', 'lead_date', 'sales_id', 'status', 'lead_score', 'lead_category'];
      const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      copy([cols.join(','), ...DB.leads.map(l => cols.map(c => q(l[c])).join(','))].join('\n'), `Copied ${DB.leads.length} leads as CSV`);
    }
    else if (act === 'fill-sample') {
      const f = $('#addForm'); const set = (n, v) => { f.elements[n].value = v; };
      set('company_name', 'Horizon Analytics'); set('industry', 'IT'); set('location', 'Pune'); set('employees', 320); set('annual_revenue_cr', 28.5); set('lead_source', 'Referral'); set('sales_id', 'S04');
      set('contact_name', 'Ananya Deshpande'); set('designation', 'CHRO'); set('email', 'ananya.deshpande@horizonanalytics.example.com'); set('phone', '9876501234'); f.elements.interested.checked = true; drawPreview();
    }
    else if (act === 'tpl') { outTpl = +t.dataset.i; outText = null; render(); }
    else if (act === 'reset-tpl') { outText = null; render(); }
    else if (act === 'copy-tpl') copy($('#out-text').value, 'Email copied - paste it into your mail app');
    else if (act === 'log-sent') {
      const l = IDX.lead.get(outLead); const sent = (IDX.acts.get(outLead) || []).filter(a => a.cadence_step).length;
      logActivity(outLead, { activity_type: 'Email', outcome: 'Sent', cadence_step: Math.min(sent + 1, 5), notes: TEMPLATES[outTpl].name + ' email sent', next_followup: addDays(today, [2, 4, 3, 4, 3][Math.min(sent, 4)]) });
      toast(`Logged ${TEMPLATES[outTpl].name.toLowerCase()} email to ${l.company_name}`);
    }
    else if (act === 'draft') { outLead = id; outTpl = (IDX.acts.get(id) || []).some(a => a.cadence_step) ? 1 : 0; outText = null; closeDrawer(); location.hash = '#outreach'; }
    else if (act === 'modal-cancel') closeModal();
    else if (act === 'reset-demo') modal('Reset demo data?', '<p style="margin:0">This removes every lead, activity and stage change you made in this browser and restores the original 500 sample leads.</p>', 'Reset', () => { DB = clone(SAMPLE); today = SNAP; reindex(); save(); render(); toast('Sample data restored'); return true; });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if ($('#modal').classList.contains('on')) closeModal(); else if (drawerId) closeDrawer(); }
    if (e.key === 'Enter' && e.target.matches('tr[data-act="open"]')) openDrawer(e.target.dataset.id);
  });
  $('#scrim').addEventListener('click', closeDrawer);
  document.addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    if (f.id === 'addForm') submitLead(f);
    else if (f.id === 'logForm') logActivity(f.dataset.lead, readLog(f));
    else if (f.closest('#modal') && modalSave) { if (modalSave(f) !== false) closeModal(); }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.lq === 'q') { LQ.q = t.value; LQ.page = 1; render(); }
    else if (t.closest('#addForm')) {
      if (t.name === 'location') { const r = DB.reps.find(x => x.base_city === t.value); if (r) t.form.elements.sales_id.value = r.sales_id; }
      drawPreview();
    }
    else if (t.matches('[data-outtext]')) outText = t.value;
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.f !== undefined) { F[t.dataset.f] = t.value; render(); }
    else if (t.dataset.lq && t.dataset.lq !== 'q') { LQ[t.dataset.lq] = t.value; LQ.page = 1; render(); }
    else if (t.matches('[data-fu]')) { fuRep = t.value; render(); }
    else if (t.matches('[data-pipe]')) { pipeRep = t.value; render(); }
    else if (t.matches('[data-out]')) { outLead = t.value; outText = null; render(); }
    else if (t.dataset.move) { const s = t.value; if (s === 'Lost') askLost(t.dataset.move); else setStage(t.dataset.move, s); }
    else if (t.dataset.rep) { const l = IDX.lead.get(t.dataset.rep); l.sales_id = t.value; commit(l, `${l.company_name} reassigned to ${rep(t.value).sales_name}`); }
    else if (t.dataset.deal) { const o = IDX.opp.get(t.dataset.deal); const v = Math.max(0, Math.round(+t.value || 0)); o.deal_value = v; api('PUT', '/opportunities/' + o.opportunity_id, o); commit(null, 'Deal value updated'); }
    else if (t.id === 'today' && t.value) { today = t.value; save(); render(); if (drawerId) renderDrawer(); toast('Demo date set to ' + fdy(today)); }
  });
  // drag and drop on the pipeline board
  let dragId = null;
  document.addEventListener('dragstart', e => { const d = e.target.closest?.('[data-deal]'); if (!d) return; dragId = d.dataset.deal; d.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* ignore */ } });
  document.addEventListener('dragend', e => { e.target.classList?.remove('dragging'); document.querySelectorAll('.lane.over').forEach(x => x.classList.remove('over')); });
  document.addEventListener('dragover', e => { const ln = e.target.closest?.('[data-lane]'); if (!ln || !dragId) return; e.preventDefault(); document.querySelectorAll('.lane.over').forEach(x => x !== ln && x.classList.remove('over')); ln.classList.add('over'); });
  document.addEventListener('drop', e => { const ln = e.target.closest?.('[data-lane]'); if (!ln || !dragId) return; e.preventDefault(); const id = dragId; dragId = null; ln.classList.remove('over'); const s = ln.dataset.lane; if (IDX.lead.get(id).status === s) return; if (s === 'Lost') askLost(id); else setStage(id, s); });
  // tooltips
  const tip = $('#tip');
  document.addEventListener('pointermove', e => {
    const t = e.target.closest?.('[data-tip]');
    if (!t) { tip.style.opacity = 0; return; }
    tip.textContent = t.dataset.tip; tip.style.opacity = 1;
    tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8) + 'px';
    tip.style.top = Math.max(8, e.clientY - tip.offsetHeight - 12) + 'px';
  });
  // label table cells for the phone layout
  new MutationObserver(() => { for (const c of document.querySelectorAll('.stack td:not([data-l])')) { let i = 0, p = c; while ((p = p.previousElementSibling)) i += p.colSpan; c.dataset.l = c.closest('table').rows[0].cells[i]?.textContent || ''; } }).observe(document.body, { childList: true, subtree: true });

  // ------------------------------------------------------------------ start
  function start(db) {
    DB = db; reindex();
    $('#mode').textContent = API ? 'Connected to the Flask API: changes are saved to the database.' : 'Offline mode: changes are saved in this browser.';
    addEventListener('hashchange', route);
    route();
  }
  const local = loadLocal();
  if (API) fetch(API + '/data').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(start).catch(() => { toast('Could not reach the API - using sample data'); start(local); });
  else start(local);
})();
