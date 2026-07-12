import { useEffect, useMemo, useRef, useState } from 'react';
import * as AF from '../data.js';
import api from '../api.js';
import { Page, PageHeader, Toast, Notice, setStyle } from '../components/screenKit.jsx';

// Recreation of design/project/Reports.dc.html (page body only). Utilization
// trend, most-used vs idle, maintenance frequency, due-for-attention, department
// allocation, and a booking heatmap — every card exports to CSV. The figures are
// computed client-side over collections loaded through src/api.js so the visuals
// match the prototype 1:1; the CSV download is a real Blob download.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
const UTIL_VALS = [52, 55, 58, 61, 64, 68, 71];
const DAYS = ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17'];
const DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const SHADES = ['#26262C', '#403880', '#5F4DEE', '#8A7DF2'];
const MAINT_COLORS = ['#E14B3B', '#E98A3C', '#5F4DEE', '#8A7DF2', '#C9C2F8'];
const mins = (t) => parseInt(t.slice(0, 2), 10);

export default function Reports() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [bookings, assets, categories, maintenance, departments] = await Promise.all([
          api.getBookings(), api.getAssets(), api.getCategories(), api.getMaintenance(), api.getDepartments(),
        ]);
        if (!alive) return;
        setData({ bookings, assets, categories, maintenance, departments });
      } catch (e) {
        if (alive) setError(e.message || 'Could not load analytics.');
      }
    })();
    return () => { alive = false; };
  }, []);

  const flash = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3800);
  };
  const csv = (name, rows) => {
    const text = rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    a.download = name;
    a.click();
    flash(name + ' downloaded.');
  };

  const m = useMemo(() => {
    if (!data) return null;
    const { bookings, assets, categories, maintenance, departments } = data;

    const utilPts = UTIL_VALS.map((v, i) => ({ x: 10 + i * 53.3, y: 112 - (v - 40) * 2.15 }));

    // usage: bookings per resource
    const usage = {};
    bookings.filter((b) => b.status !== 'Cancelled').forEach((b) => { usage[b.resource] = (usage[b.resource] || 0) + 1; });
    const used = Object.keys(usage).map((t) => ({ tag: t, n: usage[t], name: (AF.asset(t) || {}).name || t })).sort((a, b) => b.n - a.n);
    const maxU = used.length ? used[0].n : 1;
    const topUsed = used.slice(0, 5).map((u) => ({ name: u.name, pct: Math.round(u.n / maxU * 100), label: u.n + ' bkgs' }));
    const idle = assets.filter((a) => a.status === 'Available' && !usage[a.tag] && a.cat !== 'rooms').slice(0, 5)
      .map((a) => ({ label: a.tag + ' ' + a.name.split(' ').slice(0, 2).join(' ') }));

    // maintenance by category
    const mc = {};
    maintenance.forEach((r) => { const c = (AF.asset(r.asset) || {}).cat; if (c) mc[c] = (mc[c] || 0) + 1; });
    const mcArr = Object.keys(mc).map((c) => ({ id: c, name: (categories.find((x) => x.id === c) || {}).name || c, n: mc[c] })).sort((a, b) => b.n - a.n);
    const maxM = mcArr.length ? mcArr[0].n : 1;
    const maintByCat = mcArr.map((x, i) => ({ name: x.name, pct: Math.round(x.n / maxM * 100), label: x.n + ' reqs', color: MAINT_COLORS[Math.min(i, 4)] }));

    // due for attention (curated list, names resolved live)
    const dueList = [
      { tag: 'AF-0003', why: 'Service due', chipBg: '#FBF1E0', chipInk: '#A65B04' },
      { tag: 'AF-0026', why: 'Open repair', chipBg: '#FBF1E0', chipInk: '#A65B04' },
      { tag: 'AF-0002', why: 'Retire — 7 yrs', chipBg: '#F1F1F6', chipInk: '#6B6C75' },
      { tag: 'AF-0010', why: 'Confirmed lost', chipBg: '#FDECEA', chipInk: '#C0331F' },
      { tag: 'AF-0015', why: 'Warranty ends', chipBg: '#EFEAF9', chipInk: '#6D4FC2' },
    ].map((d) => ({ ...d, name: (AF.asset(d.tag) || {}).name || d.tag }));

    // department allocation (top-level depts, rolling up their children)
    const deptAlloc = departments.filter((d) => d.active && !d.parent).map((d) => {
      const das = assets.filter((a) => a.dept === d.id || (a.dept && departments.find((x) => x.id === a.dept && x.parent === d.id)));
      const alloc = das.filter((a) => a.status === 'Allocated').length;
      const total = das.length || 1;
      const allocPct = Math.round(alloc / total * 100);
      return { name: d.name, label: alloc + ' / ' + das.length + ' allocated', allocPct, availPct: 100 - allocPct, _row: [d.name, alloc, das.length] };
    });

    // booking heatmap: this week, 08:00–18:00
    const grid = DAYS.map(() => Array.from({ length: 10 }, () => 0));
    bookings.filter((b) => b.status !== 'Cancelled').forEach((b) => {
      const di = DAYS.indexOf(b.date);
      if (di < 0) return;
      const endH = parseInt(b.end.slice(0, 2), 10) + (b.end.slice(3) === '00' ? 0 : 1);
      for (let h = mins(b.start); h < Math.min(18, endH); h++) {
        if (h >= 8 && h < 18) grid[di][h - 8]++;
      }
    });
    let peakV = 0, peakLbl = '—';
    grid.forEach((row, di) => row.forEach((v, hi) => { if (v > peakV) { peakV = v; peakLbl = DOWS[di] + ' ' + (8 + hi) + ':00–' + (9 + hi) + ':00'; } }));
    const heatRows = grid.map((row, di) => ({ day: DOWS[di], cells: row.map((v, hi) => ({ bg: SHADES[Math.min(v, 3)], tip: DOWS[di] + ' ' + (8 + hi) + ':00 — ' + v + ' booking(s)' })) }));
    const heatHours = Array.from({ length: 10 }, (_, k) => ({ label: (8 + k) + '' }));

    return {
      utilPts, used, topUsed, idle, mcArr, maintByCat,
      maintTop: mcArr.length ? mcArr[0].name + ' (' + mcArr[0].n + ' requests this year)' : '—',
      dueList, deptAlloc, grid, heatRows, heatHours, peak: peakLbl,
    };
  }, [data]);

  const right = (
    <button onClick={() => m && csv('assetflow-analytics.csv', [['Report', 'Key metric'], ['Utilization', '71%'], ['Top resource', m.used[0] ? m.used[0].name : '—'], ['Maintenance top', m.mcArr[0] ? m.mcArr[0].name : '—'], ['Peak booking window', m.peak]])}
      onMouseEnter={setStyle('background', '#5F4DEE')} onMouseLeave={setStyle('background', '#17171C')}
      style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 99, background: '#17171C', color: '#fff', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>Export all
    </button>
  );

  const header = <PageHeader title="Reports & Analytics" subtitle="Utilization, maintenance load, and booking pressure — every card exports to CSV." right={right} />;
  if (error) return <Page>{header}<Notice color="#E14B3B">{error}</Notice></Page>;
  if (!m) return <Page>{header}<Notice>Loading analytics…</Notice></Page>;

  return (
    <Page>
      {header}
      {toast && <Toast>{toast}</Toast>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>

        {/* utilization trend */}
        <Card>
          <CardHead title="Asset utilization trend" onExport={() => csv('utilization-trend.csv', [['Month', 'Utilization %']].concat(MONTHS.map((mo, i) => [mo, UTIL_VALS[i]])))} />
          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#A2A3AE', marginBottom: 12 }}>Share of assets allocated or booked, Jan – Jul 2026</div>
          <svg viewBox="0 0 340 120" style={{ width: '100%' }}>
            <path d="M10,86 C40,80 60,74 90,70 C120,66 140,58 170,54 C200,50 220,44 250,40 C280,36 310,30 330,26" fill="none" stroke="#5F4DEE" strokeWidth="2.5" />
            <path d="M10,86 C40,80 60,74 90,70 C120,66 140,58 170,54 C200,50 220,44 250,40 C280,36 310,30 330,26 L330,112 L10,112 Z" fill="rgba(95,77,238,0.09)" />
            {m.utilPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#5F4DEE" strokeWidth="2" />)}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, color: '#A2A3AE', padding: '0 4px' }}>
            {MONTHS.map((mo) => <span key={mo}>{mo}</span>)}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#157A57' }}>▲ 71% this month</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#A2A3AE' }}>vs 52% in January</span>
          </div>
        </Card>

        {/* most-used vs idle */}
        <Card>
          <CardHead title="Most-used vs idle" onExport={() => csv('resource-usage.csv', [['Resource', 'Bookings']].concat(m.used.map((u) => [u.name, u.n])))} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {m.topUsed.map((u, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontSize: 11, fontWeight: 700, width: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</span>
                <div style={{ flex: 1, height: 14, borderRadius: 99, background: '#F1F1F6', overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#7B6CF6,#5F4DEE)', width: u.pct + '%' }} /></div>
                <span style={{ fontSize: 10.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', width: 56, textAlign: 'right' }}>{u.label}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed #EBEBF1' }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#C0331F', marginBottom: 7 }}>Idle 90+ days</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {m.idle.map((i, k) => <span key={k} style={{ fontSize: 10.5, fontWeight: 700, background: '#FDECEA', color: '#C0331F', borderRadius: 99, padding: '4px 11px' }}>{i.label}</span>)}
            </div>
          </div>
        </Card>

        {/* maintenance frequency */}
        <Card>
          <CardHead title="Maintenance frequency" onExport={() => csv('maintenance-by-category.csv', [['Category', 'Requests']].concat(m.mcArr.map((x) => [x.name, x.n])))} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {m.maintByCat.map((x, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontSize: 11, fontWeight: 700, width: 110 }}>{x.name}</span>
                <div style={{ flex: 1, height: 14, borderRadius: 99, background: '#F1F1F6', overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 99, background: x.color, width: x.pct + '%' }} /></div>
                <span style={{ fontSize: 10.5, fontWeight: 800, width: 66, textAlign: 'right' }}>{x.label}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#A2A3AE', marginTop: 12 }}>Top offender: <b style={{ color: '#17171C' }}>{m.maintTop}</b></div>
        </Card>

        {/* due for attention */}
        <Card>
          <CardHead title="Due for attention" onExport={() => csv('due-for-attention.csv', [['Tag', 'Asset', 'Reason']].concat(m.dueList.map((d) => [d.tag, d.name, d.why])))} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {m.dueList.map((d) => (
              <div key={d.tag} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px', borderRadius: 12, background: '#FAFAFC' }}>
                <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: '#5F4DEE' }}>{d.tag}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                <span style={{ fontSize: 9.5, fontWeight: 800, borderRadius: 99, padding: '3px 9px', background: d.chipBg, color: d.chipInk }}>{d.why}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* department allocation */}
        <Card>
          <CardHead title="Department allocation" onExport={() => csv('department-allocation.csv', [['Department', 'Allocated', 'Total']].concat(m.deptAlloc.map((d) => d._row)))} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {m.deptAlloc.map((d) => (
              <div key={d.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  <span>{d.name}</span><span style={{ color: '#A2A3AE' }}>{d.label}</span>
                </div>
                <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', background: '#F1F1F6' }}>
                  <div style={{ background: '#5F4DEE', width: d.allocPct + '%' }} />
                  <div style={{ background: '#C9C2F8', width: d.availPct + '%' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 10, fontWeight: 700, color: '#6B6C75' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 3, background: '#5F4DEE' }} />Allocated</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 3, background: '#C9C2F8' }} />Available / other</span>
          </div>
        </Card>

        {/* booking heatmap (dark) */}
        <div style={{ background: '#17171C', borderRadius: 22, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Booking heatmap</span>
            <button onClick={() => csv('booking-heatmap.csv', [['Day'].concat(m.heatHours.map((h) => h.label + ':00'))].concat(m.grid.map((row, i) => [DOWS[i]].concat(row))))}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#5F4DEE'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#33333B'; e.currentTarget.style.color = '#9A9AA5'; }}
              style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '5px 11px', borderRadius: 99, border: '1px solid #33333B', color: '#9A9AA5' }}>↓ CSV</button>
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#9A9AA5', marginBottom: 14 }}>Bookings per hour, this week — darker is busier</div>
          <div style={{ display: 'grid', gridTemplateColumns: '34px repeat(10, 1fr)', gap: 3, alignItems: 'center' }}>
            <span />
            {m.heatHours.map((h) => <span key={h.label} style={{ fontSize: 8, fontWeight: 700, color: '#6B6C75', textAlign: 'center' }}>{h.label}</span>)}
            {m.heatRows.map((r) => (
              <Row key={r.day} day={r.day} cells={r.cells} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 9.5, fontWeight: 700, color: '#6B6C75' }}>
            Quiet
            {SHADES.map((s) => <span key={s} style={{ width: 14, height: 10, borderRadius: 3, background: s }} />)}
            Peak
            <span style={{ marginLeft: 'auto', color: '#9A9AA5' }}>Peak window: <b style={{ color: '#fff' }}>{m.peak}</b></span>
          </div>
        </div>
      </div>
    </Page>
  );
}

function Row({ day, cells }) {
  return (
    <>
      <span style={{ fontSize: 9, fontWeight: 800, color: '#9A9AA5' }}>{day}</span>
      {cells.map((c, i) => <div key={i} title={c.tip} style={{ height: 22, borderRadius: 6, background: c.bg }} />)}
    </>
  );
}

function Card({ children }) {
  return <div style={{ background: '#fff', borderRadius: 22, padding: '18px 20px' }}>{children}</div>;
}
function CardHead({ title, onExport }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 800 }}>{title}</span>
      <button onClick={onExport} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#5F4DEE'; e.currentTarget.style.color = '#5F4DEE'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E7E7EE'; e.currentTarget.style.color = '#3F4046'; }}
        style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '5px 11px', borderRadius: 99, border: '1px solid #E7E7EE', color: '#3F4046' }}>↓ CSV</button>
    </div>
  );
}
