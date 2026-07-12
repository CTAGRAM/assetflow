import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import * as AF from '../data.js';
import api from '../api.js';

// Recreation of design/project/Assets.dc.html (topbar is the app shell).
// Registry: page header + register form (opens on #register), search + four
// filter selects + clear, an inline selected-asset detail card (allocation &
// maintenance history), the asset table, and the empty state.
//
// Assets load through src/api.js. A newly registered asset is sent through
// api.createAsset (demo) and also appended locally so the table updates —
// exactly the prototype's optimistic behaviour.

// This screen's own status-chip palette (as designed here — intentionally its
// own soft tints, not the STATUS map used by other screens).
const SOFT = {
  Available: ['#E5F6EF', '#157A57'], Allocated: ['#E9EFFC', '#2456C4'], Reserved: ['#EFEAF9', '#6D4FC2'],
  'Under Maintenance': ['#FBF1E0', '#A65B04'], Lost: ['#FDECEA', '#C0331F'], Retired: ['#F1F1F6', '#6B6C75'], Disposed: ['#F1F1F6', '#8A8B95'],
};

const GRID = '56px 110px 1.6fr 1fr 1fr 1fr 130px';

export default function Assets() {
  const location = useLocation();
  const { tag: routeTag } = useParams();

  // filters + selection
  const [q, setQ] = useState('');
  const [fltCat, setFltCat] = useState('');
  const [fltStatus, setFltStatus] = useState('');
  const [fltDept, setFltDept] = useState('');
  const [fltLoc, setFltLoc] = useState('');
  const [sel, setSel] = useState(routeTag || null);

  // register form
  const [formOpen, setFormOpen] = useState(location.hash === '#register');
  const [submitted, setSubmitted] = useState(false);
  const [justAdded, setJustAdded] = useState(null);
  const [added, setAdded] = useState([]);
  const [fName, setFName] = useState('');
  const [fCat, setFCat] = useState('laptops');
  const [fSerial, setFSerial] = useState('');
  const [fDate, setFDate] = useState('2026-07-12');
  const [fCost, setFCost] = useState('');
  const [fCond, setFCond] = useState('Good');
  const [fLoc, setFLoc] = useState('');
  const [fBookable, setFBookable] = useState(false);

  // base assets via API
  const [baseAssets, setBaseAssets] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    api.getAssets().then((a) => { if (alive) setBaseAssets(a); }).catch((e) => { if (alive) setError(e.message || 'Could not load assets.'); });
    return () => { alive = false; };
  }, []);

  const clearFilters = () => { setQ(''); setFltCat(''); setFltStatus(''); setFltDept(''); setFltLoc(''); };

  const model = useMemo(() => {
    if (!baseAssets) return null;
    const all = baseAssets.concat(added);
    const nextTag = 'AF-' + String(41 + added.length).padStart(4, '0');

    const query = q.trim().toLowerCase();
    const pool = all.filter((a) =>
      (!query || a.tag.toLowerCase().includes(query) || a.name.toLowerCase().includes(query) || (a.serial || '').toLowerCase().includes(query)) &&
      (!fltCat || a.cat === fltCat) && (!fltStatus || a.status === fltStatus) &&
      (!fltDept || a.dept === fltDept) && (!fltLoc || a.loc === fltLoc));

    const rows = pool.map((a) => ({
      tag: a.tag, name: a.name, serial: a.serial || '—',
      cat: (AF.categories.find((c) => c.id === a.cat) || {}).name || a.cat,
      dept: AF.deptName(a.dept), loc: a.loc,
      holder: a.holder ? (a.holderType === 'department' ? AF.deptName(a.holder) + ' (dept)' : AF.empName(a.holder)) : '—',
      status: a.status, stBg: (SOFT[a.status] || SOFT.Retired)[0], stInk: (SOFT[a.status] || SOFT.Retired)[1],
      img: a.img || false, abbr: a.name.slice(0, 2).toUpperCase(), on: sel === a.tag,
    }));

    const selA = all.find((a) => a.tag === sel);
    let d = null;
    if (selA) {
      const allocHist = AF.allocations.filter((x) => x.asset === selA.tag).map((h) => ({
        who: h.toType === 'department' ? AF.deptName(h.to) + ' (dept)' : AF.empName(h.to),
        range: AF.fmtDate(h.date) + ' → ' + (h.returned ? AF.fmtDate(h.returned) : h.expReturn ? 'due ' + AF.fmtDate(h.expReturn) : 'open-ended'),
        st: h.status, dot: h.status === 'Active' ? '#8EF0C6' : 'rgba(255,255,255,0.45)',
      }));
      const maintHist = AF.maintenance.filter((m) => m.asset === selA.tag).map((m) => ({ id: m.id, issue: m.issue, stage: m.stage }));
      d = {
        tag: selA.tag, name: selA.name, cat: (AF.categories.find((c) => c.id === selA.cat) || {}).name,
        status: selA.status, bookable: !!selA.bookable, img: selA.img || false,
        serial: selA.serial || '—', acq: AF.fmtDate(selA.acq), cost: AF.money(selA.cost),
        loc: selA.loc, cond: selA.cond, dept: AF.deptName(selA.dept),
        holder: selA.holder ? (selA.holderType === 'department' ? AF.deptName(selA.holder) : AF.empName(selA.holder)) : '—',
        allocHist, maintHist,
      };
    }

    const filterCount = [fltCat, fltStatus, fltDept, fltLoc, query].filter(Boolean).length;
    const locOptions = Array.from(new Set(all.map((a) => a.loc))).sort();
    const fCatObj = AF.categories.find((c) => c.id === fCat);
    const nameOk = fName.trim().length >= 2;
    const costOk = fCost === '' ? false : !isNaN(parseFloat(fCost));

    return {
      all, nextTag, rows, d, selA, filterCount, locOptions, fCatObj, nameOk, costOk,
      countLine: all.length + ' assets across ' + AF.departments.filter((x) => x.active).length + ' departments — search, filter, and open any asset for its full history.',
      resultLine: rows.length + ' of ' + all.length + ' assets',
    };
  }, [baseAssets, added, q, fltCat, fltStatus, fltDept, fltLoc, sel, fName, fCat, fCost]);

  async function submitForm() {
    if (!model.nameOk || !model.costOk) { setSubmitted(true); return; }
    const asset = {
      tag: model.nextTag, name: fName.trim(), cat: fCat, serial: fSerial || '—', acq: fDate,
      cost: parseFloat(fCost), cond: fCond, loc: fLoc || 'HQ · Unassigned', dept: 'ops',
      status: 'Available', bookable: fBookable, img: (model.fCatObj || {}).img || null, holder: null, extra: {},
    };
    try {
      await api.createAsset(asset); // TODO endpoint; demo returns ok. Local append keeps UI live.
    } catch (e) {
      setError(e.message || 'Could not register the asset.');
      return;
    }
    setAdded((a) => a.concat([asset]));
    setJustAdded(model.nextTag + ' · ' + fName.trim());
    setFormOpen(false); setSubmitted(false);
    setFName(''); setFSerial(''); setFCost(''); setFLoc(''); setFBookable(false);
  }

  function pickRow(t) {
    setSel((cur) => (cur === t ? null : t));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (error) return <div style={{ padding: '40px 26px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#E14B3B', fontWeight: 700 }}>{error}</div>;
  if (!model) return <div style={{ padding: '40px 26px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#A2A3AE', fontWeight: 600 }}>Loading registry…</div>;

  const fieldWrap = { display: 'flex', flexDirection: 'column', gap: 5 };
  const labelStyle = { fontSize: 10.5, fontWeight: 700, color: '#3F4046' };
  const inputBase = { all: 'unset', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 12.5, padding: '10px 12px', borderRadius: 11, background: '#F7F7FA', border: '1.5px solid #EBEBF1' };
  const selectBase = { boxSizing: 'border-box', fontSize: 12.5, padding: '10px 12px', borderRadius: 11, background: '#F7F7FA', border: '1.5px solid #EBEBF1', fontFamily: 'inherit', fontWeight: 600, color: '#3F4046', width: '100%' };
  const filterSelect = { border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, color: '#3F4046', cursor: 'pointer' };

  return (
    <div style={{ padding: '24px 26px 28px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#17171C', maxWidth: 1240, margin: '0 auto' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <Link to="/dashboard" style={{ width: 36, height: 36, borderRadius: 99, background: '#fff', border: '1px solid #E7E7EE', display: 'grid', placeItems: 'center', textDecoration: 'none' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#17171C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg></Link>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.6px' }}>Asset Registry</h1>
          <div style={{ fontSize: 12, color: '#A2A3AE', fontWeight: 500, marginTop: 2 }}>{model.countLine}</div>
        </div>
        <button onClick={() => { setFormOpen((o) => !o); setSubmitted(false); }} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 99, background: formOpen ? '#fff' : '#5F4DEE', color: formOpen ? '#17171C' : '#fff', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, boxShadow: '0 6px 14px rgba(95,77,238,0.25)', border: '1.5px solid ' + (formOpen ? '#E7E7EE' : '#5F4DEE') }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d={formOpen ? 'M18 6L6 18M6 6l12 12' : 'M12 5v14M5 12h14'} /></svg>{formOpen ? 'Close form' : 'Register an asset'}
        </button>
      </div>

      {/* register form */}
      {formOpen && (
        <div style={{ background: '#fff', borderRadius: 22, padding: '20px 22px', marginBottom: 18, border: '1.5px solid #DCD6FB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ width: 30, height: 30, borderRadius: 10, background: '#EEEBFE', display: 'grid', placeItems: 'center' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5F4DEE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" /></svg></span>
            <span style={{ fontSize: 14.5, fontWeight: 800 }}>Register a new asset</span>
            <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, background: '#17171C', color: '#fff', borderRadius: 99, padding: '4px 10px', marginLeft: 'auto' }}>Tag: {model.nextTag} · auto</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            <div style={fieldWrap}>
              <label style={labelStyle}>Asset name *</label>
              <input value={fName} onChange={(e) => setFName(e.target.value)} placeholder={'e.g. MacBook Pro 16"'} style={{ ...inputBase, border: '1.5px solid ' + (submitted && !model.nameOk ? '#E14B3B' : '#EBEBF1') }} />
              {submitted && !model.nameOk && <span style={{ fontSize: 10, fontWeight: 600, color: '#E14B3B' }}>Give the asset a name (min 2 characters).</span>}
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Category *</label>
              <select value={fCat} onChange={(e) => setFCat(e.target.value)} style={selectBase}>
                {AF.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#A2A3AE' }}>{model.fCatObj && model.fCatObj.fields.length ? 'Extra fields: ' + model.fCatObj.fields.map((f) => f.label).join(', ') : 'No extra fields'}</span>
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Serial number</label>
              <input value={fSerial} onChange={(e) => setFSerial(e.target.value)} placeholder="Manufacturer serial" style={inputBase} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Acquisition date</label>
              <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} style={inputBase} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Cost (USD) *</label>
              <input value={fCost} onChange={(e) => setFCost(e.target.value)} placeholder="0.00" style={{ ...inputBase, border: '1.5px solid ' + (submitted && !model.costOk ? '#E14B3B' : '#EBEBF1') }} />
              {submitted && !model.costOk && <span style={{ fontSize: 10, fontWeight: 600, color: '#E14B3B' }}>Enter a numeric cost, e.g. 1499.</span>}
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Condition</label>
              <select value={fCond} onChange={(e) => setFCond(e.target.value)} style={selectBase}>
                <option>Good</option><option>Fair</option><option>Poor</option><option>Damaged</option>
              </select>
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Location</label>
              <input value={fLoc} onChange={(e) => setFLoc(e.target.value)} placeholder="e.g. HQ · Floor 2" style={inputBase} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Photo</label>
              <button style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#6B6C75', padding: '10px 12px', borderRadius: 11, border: '1.5px dashed #C9C9D6', textAlign: 'center' }}>⇪ Upload image</button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
            <button onClick={() => setFBookable((b) => !b)} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 34, height: 20, borderRadius: 99, background: fBookable ? '#5F4DEE' : '#D9D9E3', position: 'relative', transition: 'background 0.15s' }}><span style={{ position: 'absolute', top: 2, left: fBookable ? 16 : 2, width: 16, height: 16, borderRadius: 99, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.15s' }} /></span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#3F4046' }}>Shared / bookable resource</span>
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={() => { setFormOpen(false); setSubmitted(false); }} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '10px 16px', borderRadius: 99, border: '1px solid #E7E7EE', background: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: '#6B6C75' }}>Cancel</button>
              <button onClick={submitForm} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '10px 18px', borderRadius: 99, background: '#5F4DEE', color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 800, boxShadow: '0 6px 14px rgba(95,77,238,0.35)' }}>Register {model.nextTag}</button>
            </div>
          </div>
        </div>
      )}

      {/* success banner */}
      {justAdded && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#E5F6EF', border: '1px solid #BFE8D6', borderRadius: 14, padding: '11px 16px', marginBottom: 16, fontSize: 12, fontWeight: 700, color: '#157A57' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          {justAdded} registered and set to Available.
        </div>
      )}

      {/* filter row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #E7E7EE', borderRadius: 99, padding: '9px 14px', width: 220 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A2A3AE" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tag, serial, name…" style={{ all: 'unset', flex: 1, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, color: '#17171C' }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #E7E7EE', borderRadius: 99, padding: '9px 14px' }}>
          <select value={fltCat} onChange={(e) => setFltCat(e.target.value)} style={filterSelect}><option value="">All categories</option>{AF.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #E7E7EE', borderRadius: 99, padding: '9px 14px' }}>
          <select value={fltStatus} onChange={(e) => setFltStatus(e.target.value)} style={filterSelect}><option value="">All statuses</option><option>Available</option><option>Allocated</option><option>Reserved</option><option>Under Maintenance</option><option>Lost</option><option>Retired</option><option>Disposed</option></select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #E7E7EE', borderRadius: 99, padding: '9px 14px' }}>
          <select value={fltDept} onChange={(e) => setFltDept(e.target.value)} style={filterSelect}><option value="">All departments</option>{AF.departments.filter((x) => x.active).map((dp) => <option key={dp.id} value={dp.id}>{dp.name}</option>)}</select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #E7E7EE', borderRadius: 99, padding: '9px 14px' }}>
          <select value={fltLoc} onChange={(e) => setFltLoc(e.target.value)} style={filterSelect}><option value="">All locations</option>{model.locOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select>
        </label>
        {model.filterCount > 0 && (
          <button onClick={clearFilters} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, background: '#17171C', color: '#fff', borderRadius: 99, padding: '9px 14px', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700 }}>Clear <span style={{ background: '#fff', color: '#17171C', borderRadius: 99, width: 17, height: 17, display: 'grid', placeItems: 'center', fontSize: 10 }}>{model.filterCount}</span></button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: '#A2A3AE' }}>{model.resultLine}</span>
      </div>

      {/* selected asset detail */}
      {model.d && (
        <div style={{ background: '#17171C', borderRadius: 26, padding: 16, marginBottom: 18 }}>
          <div style={{ borderRadius: 20, background: 'linear-gradient(155deg,#7168F0,#4E3BD8)', padding: '20px 22px', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              {model.d.img && <span style={{ display: 'block', width: 64, height: 64, borderRadius: 16, flex: 'none', border: '2px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.2) url(/' + model.d.img + ') center/cover no-repeat' }} />}
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>Asset details</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 4, flexWrap: 'wrap' }}>
                  <span className="mono" style={{ fontSize: 19, fontWeight: 800 }}># {model.d.tag}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, background: 'rgba(255,255,255,0.22)', borderRadius: 99, padding: '3px 9px' }}>{model.d.status}</span>
                  {model.d.bookable && <span style={{ fontSize: 9.5, fontWeight: 700, background: '#17171C', borderRadius: 99, padding: '3px 9px' }}>Bookable</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3 }}>{model.d.name} · <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>{model.d.cat}</span></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: '8px 22px', fontSize: 11 }}>
                {[['Serial', model.d.serial, true], ['Acquired', model.d.acq + ' · ' + model.d.cost], ['Location', model.d.loc], ['Condition', model.d.cond], ['Department', model.d.dept], ['Holder', model.d.holder]].map(([label, val, mono], i) => (
                  <div key={i}><div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9.5, fontWeight: 600 }}>{label}</div><div className={mono ? 'mono' : undefined} style={{ fontWeight: 700, marginTop: 2 }}>{val}</div></div>
                ))}
              </div>
              <button onClick={() => setSel(null)} style={{ all: 'unset', cursor: 'pointer', width: 30, height: 30, borderRadius: 99, background: 'rgba(255,255,255,0.16)', display: 'grid', placeItems: 'center' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'rgba(255,255,255,0.13)', borderRadius: 14, padding: '13px 15px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: 9 }}>Allocation history</div>
                {model.d.allocHist.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {model.d.allocHist.map((h, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 99, background: h.dot, flex: 'none' }} />
                        <span style={{ fontWeight: 700 }}>{h.who}</span>
                        <span style={{ color: 'rgba(255,255,255,0.65)' }}>{h.range}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, background: 'rgba(255,255,255,0.18)', borderRadius: 99, padding: '2px 8px' }}>{h.st}</span>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>Never allocated.</div>}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.13)', borderRadius: 14, padding: '13px 15px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: 9 }}>Maintenance history</div>
                {model.d.maintHist.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {model.d.maintHist.map((m, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                        <span className="mono" style={{ fontWeight: 700 }}>{m.id}</span>
                        <span style={{ color: 'rgba(255,255,255,0.75)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.issue}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 700, background: 'rgba(255,255,255,0.18)', borderRadius: 99, padding: '2px 8px' }}>{m.stage}</span>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>No maintenance recorded.</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* table / empty state */}
      {model.rows.length > 0 ? (
        <div style={{ background: '#fff', borderRadius: 22, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 10, alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid #F1F1F5', fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#A2A3AE' }}>
            <span /><span>Tag</span><span>Asset</span><span>Department</span><span>Location</span><span>Holder</span><span>Status</span>
          </div>
          {model.rows.map((r) => (
            <button key={r.tag} onClick={() => pickRow(r.tag)} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: '100%', display: 'grid', gridTemplateColumns: GRID, gap: 10, alignItems: 'center', padding: '9px 18px', borderBottom: '1px solid #F6F6F9', background: r.on ? '#F3F1FE' : 'transparent' }}
              onMouseEnter={(e) => { if (!r.on) e.currentTarget.style.background = '#F7F7FC'; }}
              onMouseLeave={(e) => { if (!r.on) e.currentTarget.style.background = 'transparent'; }}>
              {r.img
                ? <span style={{ display: 'block', width: 36, height: 36, borderRadius: 11, flex: 'none', background: '#F1F1F6 url(/' + r.img + ') center/cover no-repeat' }} />
                : <span style={{ width: 36, height: 36, borderRadius: 11, background: '#F1F1F6', color: '#A2A3AE', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800 }}>{r.abbr}</span>}
              <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, color: '#5F4DEE' }}>{r.tag}</span>
              <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span><span style={{ fontSize: 10.5, color: '#A2A3AE', fontWeight: 600 }}>{r.cat} · {r.serial}</span></span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#3F4046' }}>{r.dept}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#3F4046' }}>{r.loc}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#3F4046' }}>{r.holder}</span>
              <span><span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '4px 10px', background: r.stBg, color: r.stInk }}>{r.status}</span></span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 22, padding: '52px 20px', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 99, background: '#F1F1F6', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#A2A3AE" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg></div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>No assets match these filters</div>
          <div style={{ fontSize: 12, color: '#A2A3AE', fontWeight: 500, marginTop: 4, marginBottom: 16 }}>Try a broader search, or clear the filters to see all {model.all.length} assets.</div>
          <button onClick={clearFilters} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '10px 18px', borderRadius: 99, background: '#17171C', color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 700 }}>Clear all filters</button>
        </div>
      )}
    </div>
  );
}
