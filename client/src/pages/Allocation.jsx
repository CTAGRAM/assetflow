import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as AF from '../data.js';
import api from '../api.js';

// Recreation of design/project/Allocation.dc.html (topbar is the app shell).
// Allocate form + the BLOCKED-ALLOCATION state (asset not Available shows who
// holds it and offers "Request transfer instead"), the active-allocations list
// with inline check-in/return, and the role-gated transfer-approval panel.
//
// Collections load through src/api.js; allocate / return / transfer actions
// call the matching api.* method (demo today) then update local state so the
// UI stays live — mirroring the prototype's optimistic behaviour.

export default function Allocation() {
  const role = AF.role();
  const me = AF.me();
  const canApprove = role === 'Asset Manager' || role === 'Department Head' || role === 'Admin';

  // form
  const [selAsset, setSelAsset] = useState('');
  const [selTo, setSelTo] = useState('');
  const [retDate, setRetDate] = useState('');
  const [tried, setTried] = useState(false);

  // check-in
  const [openCi, setOpenCi] = useState(null);
  const [ciCond, setCiCond] = useState('Good');
  const [ciNotes, setCiNotes] = useState('');

  // data + overrides
  const [allocs, setAllocs] = useState(null);
  const [transfers, setTransfers] = useState(null);
  const [statusOv, setStatusOv] = useState({});
  const [holderOv, setHolderOv] = useState({});
  const [error, setError] = useState('');

  // toast
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const flash = (m) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    let alive = true;
    Promise.all([api.getAllocations(), api.getTransfers()])
      .then(([al, tr]) => {
        if (!alive) return;
        setAllocs(al.filter((a) => a.status === 'Active').map((a) => ({ ...a })));
        setTransfers(tr.map((t) => ({ ...t })));
      })
      .catch((e) => { if (alive) setError(e.message || 'Could not load allocations.'); });
    return () => { alive = false; };
  }, []);

  const st = (a) => statusOv[a.tag] || a.status;

  const model = useMemo(() => {
    if (!allocs || !transfers) return null;

    const assetOptions = AF.assets
      .filter((a) => ['Available', 'Allocated', 'Reserved'].includes(st(a)))
      .map((a) => ({ tag: a.tag, label: a.tag + ' — ' + a.name + (st(a) === 'Available' ? '' : ' (' + st(a) + ')') }));

    const toOptions = AF.employees.filter((e) => e.active).map((e) => ({ v: 'e:' + e.id, label: e.name + ' · ' + AF.deptName(e.dept) }))
      .concat(AF.departments.filter((d) => d.active).map((d) => ({ v: 'd:' + d.id, label: d.name + ' (department pool)' })));

    // blocked-allocation banner
    const selA = AF.asset(selAsset);
    let blocked = false;
    if (tried && selA && st(selA) !== 'Available') {
      const holder = holderOv[selA.tag] || (selA.holderType === 'department' ? AF.deptName(selA.holder) : AF.empName(selA.holder));
      blocked = {
        title: selA.tag + ' is ' + st(selA).toLowerCase() + ' — allocation blocked.',
        body: 'Currently held by ' + (holder || 'another party') + (selA.expReturn ? ', expected back ' + AF.fmtDate(selA.expReturn) : '') + ". Raise a transfer request and the holder's side approves the handover.",
      };
    }

    const allocRows = allocs.map((al) => {
      const a = AF.asset(al.asset) || {};
      const od = al.expReturn && AF.daysFromToday(al.expReturn) < 0;
      const open = openCi === al.id;
      return {
        id: al.id, tag: al.asset, name: a.name || al.asset, img: a.img || false, abbr: (a.name || '??').slice(0, 2).toUpperCase(),
        holder: al.toType === 'department' ? AF.deptName(al.to) + ' (dept)' : AF.empName(al.to),
        since: AF.fmtDate(al.date),
        chip: od ? 'Overdue' : al.expReturn ? 'On loan' : 'Open-ended',
        chipBg: od ? '#FDECEA' : '#E9EFFC', chipInk: od ? '#C0331F' : '#2456C4',
        dueLine: al.expReturn ? (od ? Math.abs(AF.daysFromToday(al.expReturn)) + ' days late · due ' + AF.fmtDate(al.expReturn) : 'due ' + AF.fmtDate(al.expReturn)) : 'no return date',
        rowBg: od ? '#FFFBFA' : 'transparent',
        ciLabel: open ? 'Close' : 'Check in', ciBorder: open ? '#17171C' : '#E7E7EE', ciInk: open ? '#fff' : '#3F4046', ciBg: open ? '#17171C' : '#fff', open,
      };
    });
    const overdueCount = allocRows.filter((r) => r.chip === 'Overdue').length;

    const trRows = transfers.map((t) => {
      const active = t.status === 'Requested' || t.status === 'Approved';
      return {
        id: t.id, asset: t.asset + ' · ' + ((AF.asset(t.asset) || {}).name || ''),
        from: t.from ? (AF.emp(t.from) ? AF.empName(t.from) : AF.deptName(t.from)) : '—',
        to: AF.emp(t.to) ? AF.empName(t.to) : AF.deptName(t.to),
        reason: t.reason, by: AF.empName(t.requestedBy), date: AF.fmtDate(t.date), status: t.status,
        bg: active ? 'linear-gradient(155deg,#7168F0,#4E3BD8)' : '#1E1E24',
        idInk: active ? 'rgba(255,255,255,0.7)' : '#9A9AA5',
        chipBg: t.status === 'Requested' ? '#FBF1E0' : t.status === 'Approved' ? '#8EF0C6' : t.status === 'Declined' ? '#FDECEA' : 'rgba(255,255,255,0.14)',
        chipInk: t.status === 'Requested' ? '#A65B04' : t.status === 'Approved' ? '#0B3D2A' : t.status === 'Declined' ? '#C0331F' : 'rgba(255,255,255,0.75)',
        showActions: active,
        canApprove: t.status === 'Requested' && canApprove,
        waiting: t.status === 'Requested' && !canApprove,
        canComplete: t.status === 'Approved' && canApprove,
      };
    });

    return {
      assetOptions, toOptions, blocked, allocRows, overdueCount, trRows,
      trCount: transfers.filter((t) => t.status === 'Requested' || t.status === 'Approved').length,
    };
  }, [allocs, transfers, statusOv, holderOv, selAsset, tried, openCi, canApprove]);

  // --- actions (call api then update local state) ---
  async function allocate() {
    if (!selAsset || !selTo) { flash('Pick an asset and who it goes to first.'); return; }
    const a = AF.asset(selAsset);
    if (st(a) !== 'Available') { setTried(true); return; }
    const isDept = selTo.indexOf('d:') === 0, id = selTo.slice(2);
    const na = { id: 'AL-' + Math.floor(130 + Math.random() * 800), asset: a.tag, to: id, toType: isDept ? 'department' : 'employee', by: me.id, date: AF.TODAY, expReturn: retDate || null, status: 'Active' };
    try { await api.allocateAsset(na); } catch (e) { flash(e.message || 'Allocation failed.'); return; }
    setAllocs((cur) => [na].concat(cur));
    setStatusOv((o) => ({ ...o, [a.tag]: 'Allocated' }));
    setHolderOv((o) => ({ ...o, [a.tag]: isDept ? AF.deptName(id) : AF.empName(id) }));
    setSelAsset(''); setSelTo(''); setRetDate(''); setTried(false);
    flash(a.tag + ' allocated to ' + (isDept ? AF.deptName(id) : AF.empName(id)) + (retDate ? ', due back ' + AF.fmtDate(retDate) : '') + '.');
  }

  async function requestTransfer() {
    const a = AF.asset(selAsset);
    const isDept = selTo.indexOf('d:') === 0, id = selTo.slice(2);
    const nt = { id: 'TR-' + Math.floor(32 + Math.random() * 60), asset: a.tag, from: a.holder, to: id, requestedBy: me.id, date: AF.TODAY, status: 'Requested', reason: 'Requested from allocation screen — asset currently held.' };
    try { await api.requestTransfer(nt); } catch (e) { flash(e.message || 'Could not raise transfer.'); return; }
    setTransfers((cur) => [nt].concat(cur));
    setTried(false); setSelAsset(''); setSelTo('');
    flash(nt.id + ' created — transfer of ' + a.tag + ' now waits for approval.');
  }

  async function confirmReturn(al) {
    try { await api.returnAsset({ id: al.id, asset: al.tag, condition: ciCond, notes: ciNotes }); } catch (e) { flash(e.message || 'Check-in failed.'); return; }
    setAllocs((cur) => cur.filter((x) => x.id !== al.id));
    setStatusOv((o) => ({ ...o, [al.tag]: 'Available' }));
    setOpenCi(null);
    flash(al.tag + ' checked in as ' + ciCond + (ciNotes ? ' — “' + ciNotes + '”' : '') + '. Asset is Available again.');
  }

  function updateTransfer(id, changes, message) {
    setTransfers((cur) => cur.map((t) => (t.id === id ? { ...t, ...changes } : t)));
    if (message) flash(message);
  }

  if (error) return <div style={{ padding: '40px 26px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#E14B3B', fontWeight: 700 }}>{error}</div>;
  if (!model) return <div style={{ padding: '40px 26px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#A2A3AE', fontWeight: 600 }}>Loading allocations…</div>;

  const allocSelect = { boxSizing: 'border-box', fontSize: 12.5, padding: '11px 12px', borderRadius: 11, background: '#F7F7FA', border: '1.5px solid #EBEBF1', fontFamily: 'inherit', fontWeight: 600, color: '#3F4046', width: '100%' };

  return (
    <div style={{ padding: '24px 26px 28px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: '#17171C', maxWidth: 1240, margin: '0 auto' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <Link to="/dashboard" style={{ width: 36, height: 36, borderRadius: 99, background: '#fff', border: '1px solid #E7E7EE', display: 'grid', placeItems: 'center', textDecoration: 'none' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#17171C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg></Link>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.6px' }}>Allocation &amp; Transfer</h1>
          <div style={{ fontSize: 12, color: '#A2A3AE', fontWeight: 500, marginTop: 2 }}>Assign assets, route transfer approvals, and check returns back in.</div>
        </div>
      </div>

      {toast && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#E5F6EF', border: '1px solid #BFE8D6', borderRadius: 14, padding: '11px 16px', marginBottom: 16, fontSize: 12, fontWeight: 700, color: '#157A57' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>{toast}
        </div>
      )}

      {/* allocate form */}
      <div style={{ background: '#fff', borderRadius: 22, padding: '18px 20px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ width: 30, height: 30, borderRadius: 10, background: '#EEEBFE', display: 'grid', placeItems: 'center' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5F4DEE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3l4 4-4 4M21 7H9M7 21l-4-4 4-4M3 17h12" /></svg></span>
          <span style={{ fontSize: 14.5, fontWeight: 800 }}>Allocate an asset</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1.4, minWidth: 220 }}>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: '#3F4046' }}>Asset</label>
            <select value={selAsset} onChange={(e) => { setSelAsset(e.target.value); setTried(false); }} style={allocSelect}>
              <option value="">Choose an asset…</option>
              {model.assetOptions.map((a) => <option key={a.tag} value={a.tag}>{a.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1.2, minWidth: 200 }}>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: '#3F4046' }}>Allocate to</label>
            <select value={selTo} onChange={(e) => setSelTo(e.target.value)} style={allocSelect}>
              <option value="">Employee or department…</option>
              {model.toOptions.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 160 }}>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: '#3F4046' }}>Expected return <span style={{ color: '#A2A3AE', fontWeight: 600 }}>(optional)</span></label>
            <input type="date" value={retDate} onChange={(e) => setRetDate(e.target.value)} style={{ all: 'unset', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 12.5, padding: '11px 12px', borderRadius: 11, background: '#F7F7FA', border: '1.5px solid #EBEBF1' }} />
          </div>
          <button onClick={allocate} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '12px 20px', borderRadius: 99, background: '#5F4DEE', color: '#fff', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, boxShadow: '0 6px 14px rgba(95,77,238,0.3)' }}>Allocate</button>
        </div>

        {model.blocked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, background: '#FDECEA', border: '1.5px solid #F5C6BE', borderRadius: 16, padding: '13px 16px', flexWrap: 'wrap' }}>
            <span style={{ width: 34, height: 34, borderRadius: 99, background: '#fff', display: 'grid', placeItems: 'center', flex: 'none' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E14B3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg></span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#B3271A' }}>{model.blocked.title}</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#8F2B1F', marginTop: 2 }}>{model.blocked.body}</div>
            </div>
            <button onClick={requestTransfer} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '10px 18px', borderRadius: 99, background: '#17171C', color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 800 }}>Request transfer instead →</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        {/* active allocations */}
        <div style={{ background: '#fff', borderRadius: 22, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '15px 18px', borderBottom: '1px solid #F1F1F5' }}>
            <span style={{ fontSize: 13.5, fontWeight: 800 }}>Active allocations</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, background: '#F1F1F6', borderRadius: 99, padding: '2px 9px', color: '#6B6C75' }}>{model.allocRows.length}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: '#E14B3B' }}>{model.overdueCount ? model.overdueCount + ' overdue' : ''}</span>
          </div>
          {model.allocRows.length ? model.allocRows.map((r) => (
            <div key={r.id} style={{ borderBottom: '1px solid #F6F6F9', background: r.rowBg }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 18px' }}>
                {r.img
                  ? <span style={{ display: 'block', width: 36, height: 36, borderRadius: 11, flex: 'none', background: '#F1F1F6 url(/' + r.img + ') center/cover no-repeat' }} />
                  : <span style={{ width: 36, height: 36, borderRadius: 11, background: '#F1F1F6', color: '#A2A3AE', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, flex: 'none' }}>{r.abbr}</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: '#5F4DEE' }}>{r.tag}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6C75', marginTop: 1 }}>→ {r.holder} · since {r.since}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '4px 10px', background: r.chipBg, color: r.chipInk }}>{r.chip}</span>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#A2A3AE', marginTop: 3 }}>{r.dueLine}</div>
                </div>
                <button onClick={() => { setOpenCi(r.open ? null : r.id); setCiCond('Good'); setCiNotes(''); }} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', fontSize: 11, fontWeight: 800, padding: '7px 13px', borderRadius: 99, border: '1.5px solid ' + r.ciBorder, color: r.ciInk, background: r.ciBg }}>{r.ciLabel}</button>
              </div>
              {r.open && (
                <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end', padding: '2px 18px 14px', flexWrap: 'wrap', background: '#FAFAFE' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#A2A3AE' }}>Condition on return</label>
                    <select value={ciCond} onChange={(e) => setCiCond(e.target.value)} style={{ boxSizing: 'border-box', fontSize: 12, padding: '9px 11px', borderRadius: 10, background: '#fff', border: '1.5px solid #DCD6FB', fontFamily: 'inherit', fontWeight: 600, color: '#3F4046' }}><option>Good</option><option>Fair</option><option>Poor</option><option>Damaged</option></select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#A2A3AE' }}>Check-in notes</label>
                    <input value={ciNotes} onChange={(e) => setCiNotes(e.target.value)} placeholder="e.g. scuff on lid, charger returned" style={{ all: 'unset', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 12, padding: '9px 11px', borderRadius: 10, background: '#fff', border: '1.5px solid #DCD6FB' }} />
                  </div>
                  <button onClick={() => confirmReturn(r)} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '10px 16px', borderRadius: 99, background: '#17171C', color: '#fff', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 800 }}>Mark returned</button>
                </div>
              )}
            </div>
          )) : (
            <div style={{ padding: '36px 20px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#A2A3AE' }}>Everything is back on the shelf — no active allocations.</div>
          )}
        </div>

        {/* transfers */}
        <div style={{ background: '#17171C', borderRadius: 26, padding: 16 }} id="transfers">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12, padding: '0 4px' }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>Transfer requests</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, background: '#26262C', color: '#9A9AA5', borderRadius: 99, padding: '2px 9px' }}>{model.trCount}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: '#9A9AA5' }}>requested → approved → re-allocated</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {model.trRows.length ? model.trRows.map((t) => (
              <div key={t.id} style={{ borderRadius: 18, padding: '14px 16px', background: t.bg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: t.idInk }}>{t.id}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>{t.asset}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '3px 9px', background: t.chipBg, color: t.chipInk, marginLeft: 'auto' }}>{t.status}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
                  {t.from} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg> {t.to}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 500, color: 'rgba(255,255,255,0.55)', marginTop: 5, lineHeight: 1.45 }}>“{t.reason}” — {t.by}, {t.date}</div>
                {t.showActions && (
                  <div style={{ display: 'flex', gap: 7, marginTop: 11 }}>
                    {t.canApprove && (
                      <>
                        <button onClick={() => updateTransfer(t.id, { status: 'Approved', approvedBy: me.id }, t.id + ' approved by ' + me.name + '. Complete the re-allocation when the asset changes hands.')} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '8px 15px', borderRadius: 99, background: '#fff', color: '#17171C', fontFamily: 'inherit', fontSize: 11, fontWeight: 800 }}>Approve</button>
                        <button onClick={() => updateTransfer(t.id, { status: 'Declined' }, t.id + ' declined.')} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '8px 15px', borderRadius: 99, border: '1.5px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.8)', fontFamily: 'inherit', fontSize: 11, fontWeight: 700 }}>Decline</button>
                      </>
                    )}
                    {t.canComplete && (
                      <button onClick={() => updateTransfer(t.id, { status: 'Completed' }, t.id + ' completed — ' + t.asset + ' re-allocated to ' + t.to + '.')} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '8px 15px', borderRadius: 99, background: '#8EF0C6', color: '#0B3D2A', fontFamily: 'inherit', fontSize: 11, fontWeight: 800 }}>Re-allocate now →</button>
                    )}
                    {t.waiting && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.5)', padding: '8px 4px' }}>Waiting for Asset Manager or Dept Head approval</span>
                    )}
                  </div>
                )}
              </div>
            )) : (
              <div style={{ padding: '32px 16px', textAlign: 'center', borderRadius: 18, background: '#1E1E24', fontSize: 12, fontWeight: 600, color: '#9A9AA5' }}>No transfer requests right now.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
