import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as AF from '../data.js';
import api from '../api.js';

// Recreation of the content of design/project/Dashboard.dc.html (the shared
// topbar lives in the app shell / Layout, so this renders the page body only):
// page header + "Register an asset", four KPI stat cards (overdue returns,
// due within a month, avg allocation length, ready to allocate), the filter
// row, and the dark "Pending returns" master/detail panel.
//
// All collections load through src/api.js; AF.* are pure formatting/lookup
// helpers ported from the prototype.

// small inline chevron used on the static filter pills
const Chevron = ({ stroke = '#A2A3AE' }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
);
const FilterPill = ({ children }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #E7E7EE', borderRadius: 99, padding: '9px 14px', fontSize: 11.5, fontWeight: 600, color: '#3F4046' }}>{children}</span>
);

export default function Dashboard() {
  const role = AF.role();
  const me = AF.me();

  // UI state (mirrors the prototype's component state)
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState('all');   // all | overdue | upcoming
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('laptops');

  // Data through the API surface.
  const [assets, setAssets] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [a, al] = await Promise.all([api.getAssets(), api.getAllocations()]);
        if (!alive) return;
        setAssets(a);
        setAllocations(al);
      } catch (e) {
        if (alive) setError(e.message || 'Could not load dashboard data.');
      }
    })();
    return () => { alive = false; };
  }, []);

  const model = useMemo(() => {
    if (!assets) return null;
    // Live /assets carries no expected-return date (it lives on the open
    // allocation), so enrich each asset with the return date from its open
    // allocation. In demo-fallback mode the asset already has expReturn, so we
    // keep whichever is present.
    const expByTag = {};
    allocations.forEach((al) => { if (al.status === 'Active' && al.expReturn) expByTag[al.asset] = al.expReturn; });
    const assetsX = assets.map((a) => (a.expReturn || !expByTag[a.tag] ? a : { ...a, expReturn: expByTag[a.tag] }));
    const alloc = assetsX.filter((a) => a.status === 'Allocated' && a.expReturn);
    const overdueA = alloc.filter((a) => AF.daysFromToday(a.expReturn) < 0);
    const upcomingA = alloc.filter((a) => AF.daysFromToday(a.expReturn) >= 0);
    const dueMonth = upcomingA.filter((a) => AF.daysFromToday(a.expReturn) <= 31);
    const avail = assets.filter((a) => a.status === 'Available');

    // decorative monthly bars: Jul..Jan
    const monthNames = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
    const counts = monthNames.map((m, i) => alloc.filter((a) => { const mm = parseInt(a.expReturn.slice(5, 7), 10); return mm === ((6 + i) % 12) + 1; }).length);
    const mx = Math.max.apply(null, counts.concat([1]));
    const bars = monthNames.map((m, i) => ({ m, h: Math.round(8 + (counts[i] / mx) * 42), color: i === 4 ? '#5F4DEE' : '#C9C2F8' }));

    const catCards = ['laptops', 'av', 'vehicles'].map((id) => {
      const c = AF.categories.find((x) => x.id === id);
      const n = avail.filter((a) => a.cat === id).length;
      const on = cat === id;
      return { id, label: c.name.toUpperCase().slice(0, 8), n,
        bg: on ? '#EEEBFE' : '#fff', border: on ? '#5F4DEE' : '#E7E7EE', ink: on ? '#4A39C9' : '#3F4046', sub: on ? '#5F4DEE' : '#A2A3AE' };
    });

    // list pool by tab + tag search, soonest-due first
    let pool = tab === 'overdue' ? overdueA : tab === 'upcoming' ? upcomingA : overdueA.concat(upcomingA);
    const query = q.trim().toLowerCase();
    if (query) pool = pool.filter((a) => a.tag.toLowerCase().includes(query) || a.name.toLowerCase().includes(query));
    pool = pool.slice().sort((x, y) => AF.daysFromToday(x.expReturn) - AF.daysFromToday(y.expReturn));

    const selTag = sel || (pool[0] && pool[0].tag);
    const rows = pool.slice(0, 6).map((a) => {
      const dd = AF.daysFromToday(a.expReturn), od = dd < 0, on = a.tag === selTag;
      return {
        tag: a.tag, img: a.img, abbr: a.name.slice(0, 2).toUpperCase(), on,
        when: od ? Math.abs(dd) + ' days late' : dd === 0 ? 'Due today' : 'In ' + dd + ' days',
        whenColor: on ? 'rgba(255,255,255,0.75)' : od ? '#F08B7E' : '#9A9AA5',
        chip: od ? 'Overdue' : 'Upcoming',
        chipBg: on ? '#fff' : od ? 'rgba(225,75,59,0.18)' : '#26262C',
        chipInk: on ? '#17171C' : od ? '#F08B7E' : '#9A9AA5',
        cost: AF.money(a.cost), bg: on ? '#5F4DEE' : 'transparent',
      };
    });

    // detail panel for the selected asset (prefer the loaded/enriched asset so
    // it works against live data; fall back to the static lookup)
    const selAsset = assetsX.find((a) => a.tag === selTag) || AF.asset(selTag);
    let d = null;
    if (selAsset) {
      const dd = AF.daysFromToday(selAsset.expReturn), od = dd < 0;
      const al = allocations.find((x) => x.asset === selAsset.tag && x.status === 'Active');
      const holder = selAsset.holderType === 'department' ? AF.deptName(selAsset.holder) : AF.empName(selAsset.holder);
      const hEmp = AF.emp(selAsset.holder);
      d = {
        tag: selAsset.tag, name: selAsset.name, cat: (AF.categories.find((c) => c.id === selAsset.cat) || {}).name, loc: selAsset.loc,
        chip: od ? 'Overdue' : 'On track', chipBg: od ? '#FFD9D3' : 'rgba(255,255,255,0.25)', chipInk: od ? '#B3271A' : '#fff',
        holder, holderInit: AF.initials(holder), holderDept: hEmp ? AF.deptName(hEmp.dept) : 'Department pool',
        cost: AF.money(selAsset.cost), serial: (selAsset.serial || '—').slice(0, 10), cond: selAsset.cond,
        allocDate: al ? AF.fmtDate(al.date) : '—', expReturn: AF.fmtDate(selAsset.expReturn),
        dueLabel: od ? 'Days overdue' : 'Days remaining', dueVal: Math.abs(dd) + ' days', dueColor: od ? '#FFD9D3' : '#fff',
      };
    }

    const mkTab = (id, label, n) => ({ id, label, n: n || false, on: tab === id });
    const tabs = [mkTab('all', 'All returns', alloc.length), mkTab('overdue', 'Overdue', overdueA.length), mkTab('upcoming', 'Upcoming', upcomingA.length)];

    return {
      overdueValue: AF.money(overdueA.reduce((s, a) => s + a.cost, 0)), overdueCount: overdueA.length,
      dueValue: AF.money(dueMonth.reduce((s, a) => s + a.cost, 0)), dueCount: dueMonth.length,
      bars, availCount: avail.length, soonCount: dueMonth.length, catCards, tabs, rows, d, selTag,
    };
  }, [assets, allocations, tab, q, sel, cat]);

  if (error) {
    return <div style={{ padding: '40px 26px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#E14B3B', fontWeight: 700 }}>{error}</div>;
  }
  if (!model) {
    return <div style={{ padding: '40px 26px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#A2A3AE', fontWeight: 600 }}>Loading dashboard…</div>;
  }

  return (
    <div style={{ padding: '24px 26px 28px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#17171C', maxWidth: 1240, margin: '0 auto' }}>
      {/* page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ width: 36, height: 36, borderRadius: 99, background: '#fff', border: '1px solid #E7E7EE', display: 'grid', placeItems: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#17171C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.6px' }}>Dashboard</h1>
          <div style={{ fontSize: 12, color: '#A2A3AE', fontWeight: 500, marginTop: 2 }}>Manage and track all your assets in one place. Viewing as {role} — {me.name}.</div>
        </div>
        <span style={{ width: 38, height: 38, borderRadius: 12, background: '#fff', border: '1px solid #E7E7EE', display: 'grid', placeItems: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#17171C" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        </span>
        <Link to="/assets#register" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 99, background: '#5F4DEE', color: '#fff', textDecoration: 'none', fontSize: 12.5, fontWeight: 700, boxShadow: '0 6px 14px rgba(95,77,238,0.35)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#4A39C9'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#5F4DEE'; }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>Register an asset
        </Link>
      </div>

      {/* stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(225px, 1fr))', gap: 14, marginBottom: 20 }}>
        {/* overdue returns */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 16px 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#6B6C75' }}>Overdue returns</span>
            <span style={{ width: 26, height: 26, borderRadius: 99, background: '#FDECEA', display: 'grid', placeItems: 'center' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E14B3B" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg></span>
          </div>
          <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.7px', marginTop: 8 }}>{model.overdueValue}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, color: '#E14B3B', marginTop: 5 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            {model.overdueCount} assets past return date</div>
          <img src="/img/desk.jpg" alt="" style={{ width: 'calc(100% + 32px)', margin: '12px -16px 0', height: 92, objectFit: 'cover', display: 'block' }} />
        </div>

        {/* due within next month */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#6B6C75' }}>Due within next month</span>
            <span style={{ width: 26, height: 26, borderRadius: 99, background: '#EEEBFE', display: 'grid', placeItems: 'center' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5F4DEE" strokeWidth="2" strokeLinecap="round"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" /></svg></span>
          </div>
          <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.7px', marginTop: 8 }}>{model.dueValue}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, color: '#1FA97A', marginTop: 5 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            {model.dueCount} returns expected</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, marginTop: 'auto', paddingTop: 12, height: 74 }}>
            {model.bars.map((b, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', borderRadius: '5px 5px 2px 2px', background: b.color, height: b.h }} />
                <span style={{ fontSize: 8.5, color: '#A2A3AE', fontWeight: 600 }}>{b.m}</span>
              </div>
            ))}
          </div>
        </div>

        {/* average allocation length */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#6B6C75' }}>Average allocation length</span>
            <span style={{ width: 26, height: 26, borderRadius: 99, background: '#EEEBFE', display: 'grid', placeItems: 'center' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5F4DEE" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg></span>
          </div>
          <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.7px', marginTop: 8 }}>96 <span style={{ fontSize: 14, fontWeight: 700, color: '#6B6C75' }}>days</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, color: '#1FA97A', marginTop: 5 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
            4 days shorter than last quarter</div>
          <svg viewBox="0 0 220 70" style={{ width: '100%', marginTop: 'auto', paddingTop: 10 }} preserveAspectRatio="none">
            <path d="M4,58 C30,54 42,44 62,46 C86,48 96,30 118,32 C140,34 150,18 172,14 C190,11 204,10 216,6" fill="none" stroke="#5F4DEE" strokeWidth="2" />
            <path d="M4,58 C30,54 42,44 62,46 C86,48 96,30 118,32 C140,34 150,18 172,14 C190,11 204,10 216,6 L216,70 L4,70 Z" fill="rgba(95,77,238,0.08)" stroke="none" />
            <circle cx="62" cy="46" r="3" fill="#fff" stroke="#5F4DEE" strokeWidth="2" />
            <circle cx="118" cy="32" r="3" fill="#fff" stroke="#5F4DEE" strokeWidth="2" />
            <circle cx="172" cy="14" r="3" fill="#fff" stroke="#5F4DEE" strokeWidth="2" />
          </svg>
        </div>

        {/* ready to allocate */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#6B6C75' }}>Ready to allocate</span>
            <span style={{ width: 26, height: 26, borderRadius: 99, background: '#F1F1F6', display: 'grid', placeItems: 'center' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#17171C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M7 7h10v10" /></svg></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.7px' }}>{model.availCount} <span style={{ fontSize: 14, fontWeight: 700, color: '#6B6C75' }}>assets</span></span>
            <span style={{ fontSize: 9.5, fontWeight: 700, border: '1px solid #E7E7EE', borderRadius: 99, padding: '3px 8px', color: '#6B6C75' }}>+{model.soonCount} soon</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            {model.catCards.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', flex: 1, borderRadius: 10, padding: '8px 7px', textAlign: 'center', background: c.bg, border: '1.5px solid ' + c.border }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: c.ink, letterSpacing: '0.3px' }}>{c.label}</div>
                <div style={{ fontSize: 9, fontWeight: 600, color: c.sub, marginTop: 2 }}>{c.n} free</div>
              </button>
            ))}
          </div>
          <Link to="/allocation" style={{ marginTop: 12, display: 'block', textAlign: 'center', padding: 9, borderRadius: 99, background: '#17171C', color: '#fff', textDecoration: 'none', fontSize: 11.5, fontWeight: 700 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#000'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#17171C'; }}>Allocate now</Link>
        </div>
      </div>

      {/* filter row (static pills as designed; tag search is live) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#17171C', color: '#fff', borderRadius: 99, padding: '9px 14px', fontSize: 11.5, fontWeight: 700 }}>Active filters <span style={{ background: '#fff', color: '#17171C', borderRadius: 99, width: 17, height: 17, display: 'grid', placeItems: 'center', fontSize: 10 }}>2</span></span>
        <FilterPill>All categories <Chevron /></FilterPill>
        <FilterPill>All holders <Chevron /></FilterPill>
        <FilterPill>July 2026 <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#A2A3AE" strokeWidth="2" strokeLinecap="round"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" /></svg></FilterPill>
        <FilterPill>August 2026 <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#A2A3AE" strokeWidth="2" strokeLinecap="round"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" /></svg></FilterPill>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #E7E7EE', borderRadius: 99, padding: '9px 14px', width: 180 }}>
          <input value={q} onChange={(e) => { setQ(e.target.value); setSel(null); }} placeholder="Enter asset tag #" style={{ all: 'unset', flex: 1, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, color: '#17171C' }} />
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A2A3AE" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        </div>
      </div>

      {/* dark "Pending returns" panel */}
      <div style={{ background: '#17171C', borderRadius: 26, padding: '16px 16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ color: '#fff', fontSize: 14.5, fontWeight: 700, paddingLeft: 6 }}>Pending returns</span>
          <div style={{ margin: '0 auto', display: 'flex', alignItems: 'center', gap: 2, background: '#fff', borderRadius: 99, padding: 4 }}>
            {model.tabs.map((t) => (
              <button key={t.id} onClick={() => { setTab(t.id); setSel(null); }} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 99, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, color: t.on ? '#fff' : '#3F4046', background: t.on ? '#17171C' : 'transparent' }}>
                {t.label}
                {t.n !== false && <span style={{ fontSize: 10, fontWeight: 700, background: t.on ? '#5F4DEE' : '#F1F1F6', color: t.on ? '#fff' : '#3F4046', borderRadius: 99, padding: '1px 6px' }}>{t.n}</span>}
              </button>
            ))}
          </div>
          <span style={{ width: 32, height: 32, borderRadius: 10, background: '#26262C', display: 'grid', placeItems: 'center' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9A9AA5" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg></span>
          <span style={{ width: 32, height: 32, borderRadius: 10, background: '#26262C', display: 'grid', placeItems: 'center' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9A9AA5" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg></span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(0, 1.5fr)', gap: 14, alignItems: 'start' }}>
          {/* list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {model.rows.length > 0 ? model.rows.map((r) => (
              <button key={r.tag} onClick={() => setSel(r.tag)} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 16, background: r.bg }}
                onMouseEnter={(e) => { if (!r.on) e.currentTarget.style.background = '#26262C'; }}
                onMouseLeave={(e) => { if (!r.on) e.currentTarget.style.background = 'transparent'; }}>
                {r.img
                  ? <span style={{ display: 'block', width: 38, height: 38, borderRadius: 99, flex: 'none', background: '#26262C url(/' + r.img + ') center/cover no-repeat' }} />
                  : <span style={{ width: 38, height: 38, borderRadius: 99, background: '#26262C', color: '#9A9AA5', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, flex: 'none' }}>{r.abbr}</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mono" style={{ color: '#fff', fontSize: 12.5, fontWeight: 700 }}># {r.tag}</div>
                  <div style={{ color: r.whenColor, fontSize: 10.5, fontWeight: 600, marginTop: 1 }}>{r.when}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '4px 9px', background: r.chipBg, color: r.chipInk }}>{r.chip}</span>
                <span style={{ color: '#fff', fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 64, textAlign: 'right' }}>{r.cost}</span>
              </button>
            )) : (
              <div style={{ padding: '36px 20px', textAlign: 'center', borderRadius: 16, background: '#1E1E24' }}>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>No returns match</div>
                <div style={{ color: '#9A9AA5', fontSize: 11.5, marginTop: 4 }}>Try a different tab or clear the tag search.</div>
              </div>
            )}
          </div>

          {/* detail */}
          {model.d && (
            <div style={{ borderRadius: 20, background: 'linear-gradient(155deg,#7168F0,#4E3BD8)', padding: '20px 22px', color: '#fff' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 14, alignItems: 'start', marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>Asset details</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 5, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.5px' }}># {model.d.tag}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 700, background: model.d.chipBg, color: model.d.chipInk, borderRadius: 99, padding: '3px 8px' }}>{model.d.chip}</span>
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>{model.d.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>Category</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{model.d.cat}</div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{model.d.loc}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>Holder</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 99, background: 'rgba(255,255,255,0.22)', display: 'grid', placeItems: 'center', fontSize: 9.5, fontWeight: 700 }}>{model.d.holderInit}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{model.d.holder}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{model.d.holderDept}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9, marginBottom: 16 }}>
                {[[model.d.cost, 'Acquisition cost'], [model.d.serial, 'Serial number'], [model.d.cond, 'Condition']].map(([val, label], i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 13, padding: '11px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 800 }}>{val} <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M7 7h10v10" /></svg></div>
                    <div style={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>{label}</div>
                  </div>
                ))}
                <Link to="/maintenance#raise" style={{ border: '1.5px dashed rgba(255,255,255,0.4)', borderRadius: 13, padding: '11px 12px', display: 'grid', placeItems: 'center', textDecoration: 'none', color: 'rgba(255,255,255,0.75)', fontSize: 10.5, fontWeight: 700, textAlign: 'center' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#fff'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}>+ Raise issue</Link>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>Allocated</div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{model.d.allocDate}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>Expected return</div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{model.d.expReturn}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>{model.d.dueLabel}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, marginTop: 2, color: model.d.dueColor }}>{model.d.dueVal}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Link to="/assets" style={{ width: 34, height: 34, borderRadius: 99, background: 'rgba(255,255,255,0.16)', display: 'grid', placeItems: 'center', textDecoration: 'none' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg></Link>
                  <Link to="/booking" style={{ width: 34, height: 34, borderRadius: 99, background: 'rgba(255,255,255,0.16)', display: 'grid', placeItems: 'center', textDecoration: 'none' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" /></svg></Link>
                  <Link to="/allocation#return" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 99, background: '#fff', color: '#17171C', textDecoration: 'none', fontSize: 12, fontWeight: 800 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#EEEBFE'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}>Check in now</Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
