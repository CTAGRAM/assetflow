import { useEffect, useRef, useState } from 'react';
import * as AF from '../data.js';
import api from '../api.js';
import { Page, PageHeader, Toast, LockedCard, Notice, setStyle } from '../components/screenKit.jsx';

// Recreation of design/project/Audits.dc.html (page body only). Admin +
// Asset Manager only. Open an audit cycle over a scope, assign auditors, mark
// each in-scope asset Verified / Missing / Damaged, watch the live discrepancy
// report, and close + lock the cycle (missing assets become Lost on close).
// Reads/writes flow through src/api.js; marks are optimistic like the prototype.

const LOCATIONS = ['HQ · Floor 1', 'HQ · Floor 2', 'HQ · Floor 3', 'HQ · Floor 4', 'HQ · Garage', 'HQ · Storage B1'];
const MARK_C = {
  Verified: ['#E5F6EF', '#157A57', '#8FDDBB'], Missing: ['#FDECEA', '#C0331F', '#F5C6BE'], Damaged: ['#FBF1E0', '#A65B04', '#F2D9AE'],
};

export default function Audits() {
  const role = AF.role();
  const canAudit = role === 'Admin' || role === 'Asset Manager';

  const [audits, setAudits] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [assets, setAssets] = useState([]);
  const [error, setError] = useState('');
  const [selId, setSelId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [fScope, setFScope] = useState('loc:HQ · Floor 2');
  const [fFrom, setFFrom] = useState('2026-07-20');
  const [fTo, setFTo] = useState('2026-08-07');
  const [fAud1, setFAud1] = useState('');
  const [fAud2, setFAud2] = useState('');
  const toastTimer = useRef(null);

  // detail rows (per-asset items) come from the cycle detail endpoint
  const loadAudits = async () => {
    const list = await api.getAudits();
    return Promise.all(list.map((c) => api.getAudit(c.id).catch(() => c)));
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [a, e, d, as] = await Promise.all([
          loadAudits(), api.getEmployees(), api.getDepartments(), api.getAssets(),
        ]);
        if (!alive) return;
        setAudits(a.map((c) => ({ ...c, items: (c.items || []).map((i) => ({ ...i })) })));
        setEmployees(e); setDepartments(d); setAssets(as);
      } catch (e) {
        if (alive) setError(e.message || 'Could not load audit cycles.');
      }
    })();
    return () => { alive = false; };
  }, []);

  const flash = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  };
  const updateItem = (cid, tag, patch) => setAudits((as) => as.map((c) => c.id === cid ? { ...c, items: c.items.map((it) => it.asset === tag ? { ...it, ...patch } : it) } : c));
  const updateCycle = (cid, patch) => setAudits((as) => as.map((c) => c.id === cid ? { ...c, ...patch } : c));

  const newBtn = (
    <button onClick={() => setFormOpen((v) => !v)}
      style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 99, background: formOpen ? '#fff' : '#5F4DEE', color: formOpen ? '#17171C' : '#fff', border: '1.5px solid ' + (formOpen ? '#E7E7EE' : '#5F4DEE'), fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, boxShadow: '0 6px 14px rgba(95,77,238,0.25)' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d={formOpen ? 'M18 6L6 18M6 6l12 12' : 'M12 5v14M5 12h14'} /></svg>{formOpen ? 'Close form' : 'New cycle'}
    </button>
  );

  const header = <PageHeader title="Audit Cycles" subtitle="Walk the floor, verify every asset, and close the loop on discrepancies." right={canAudit ? newBtn : null} />;

  if (error) return <Page>{header}<Notice color="#E14B3B">{error}</Notice></Page>;
  if (!canAudit) return <Page>{header}<LockedCard title="Audits are for Admins and Asset Managers">You're viewing as {role}. Switch roles in the top bar.</LockedCard></Page>;
  if (!audits) return <Page>{header}<Notice>Loading audit cycles…</Notice></Page>;

  const sel = audits.find((a) => a.id === selId) || audits[0];
  const editable = sel.status !== 'Closed';
  const done = sel.items.filter((i) => i.result).length;

  const audOptions = employees.filter((e) => e.active && e.role !== 'employee')
    .concat(employees.filter((e) => e.active && e.role === 'employee'))
    .map((e) => ({ id: e.id, name: e.name }));
  const liveLocations = [...new Set(assets.map((a) => a.loc).filter((l) => l && l !== '—'))];
  const scopeOptions = departments.filter((d) => d.active).map((d) => ({ v: 'dept:' + d.dbId, label: 'Dept — ' + d.name }))
    .concat((liveLocations.length ? liveLocations : LOCATIONS).map((l) => ({ v: 'loc:' + l, label: 'Location — ' + l })));

  const createCycle = async () => {
    const isDept = fScope.indexOf('dept:') === 0;
    const key = fScope.slice(fScope.indexOf(':') + 1);
    if (!fAud1) { flash('Assign at least one auditor.'); return; }
    const deptName = isDept ? (departments.find((d) => String(d.dbId) === key) || {}).name : null;
    const auditor_ids = [Number(fAud1)].concat(fAud2 && fAud2 !== fAud1 ? [Number(fAud2)] : []);
    try {
      const created = await api.createAudit({
        name: 'Q3 2026 — ' + (isDept ? deptName : key),
        starts_on: fFrom, ends_on: fTo, auditor_ids,
        department_id: isDept ? Number(key) : null, location: isDept ? null : key,
      });
      setAudits(await loadAudits().then((a) => a.map((c) => ({ ...c, items: (c.items || []).map((i) => ({ ...i })) }))));
      setSelId(created.id); setFormOpen(false);
      flash('Cycle opened. Auditors notified.');
    } catch (e) { flash(e.message || 'Could not open the cycle.'); }
  };

  const closeCycle = async () => {
    if (done < sel.items.length) { flash('Check all ' + sel.items.length + ' assets before closing — ' + (sel.items.length - done) + ' still unmarked.'); return; }
    try {
      const res = await api.closeAudit(sel.id);
      updateCycle(sel.id, { status: 'Closed', closed: AF.TODAY });
      const missing = res.summary ? res.summary.marked_lost : 0;
      flash('Cycle closed and locked.' + (missing ? ' ' + missing + ' missing asset(s) are now marked Lost.' : ' No discrepancies — clean audit.'));
    } catch (e) { flash(e.message || 'Could not close the cycle.'); }
  };

  const disc = sel.items.filter((i) => i.result === 'Missing' || i.result === 'Damaged');

  return (
    <Page>
      {header}
      {toast && <Toast>{toast}</Toast>}

      {formOpen && (
        <div style={{ background: '#fff', borderRadius: 22, padding: '18px 20px', marginBottom: 16, border: '1.5px solid #DCD6FB', display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <FormField label="Scope" style={{ minWidth: 150 }}>
            <select value={fScope} onChange={(e) => setFScope(e.target.value)} style={selBox}>
              {scopeOptions.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </FormField>
          <FormField label="From" style={{ minWidth: 135 }}>
            <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} style={dateBox} />
          </FormField>
          <FormField label="To" style={{ minWidth: 135 }}>
            <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} style={dateBox} />
          </FormField>
          <FormField label="Auditor 1" style={{ minWidth: 160 }}>
            <select value={fAud1} onChange={(e) => setFAud1(e.target.value)} style={selBox}>
              {audOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </FormField>
          <FormField label="Auditor 2 (optional)" style={{ minWidth: 160 }}>
            <select value={fAud2} onChange={(e) => setFAud2(e.target.value)} style={selBox}>
              <option value="">None</option>
              {audOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </FormField>
          <button onClick={createCycle} onMouseEnter={setStyle('background', '#4A39C9')} onMouseLeave={setStyle('background', '#5F4DEE')}
            style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '11px 18px', borderRadius: 99, background: '#5F4DEE', color: '#fff', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, boxShadow: '0 6px 14px rgba(95,77,238,0.3)' }}>Open cycle</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '290px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        {/* cycles list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {audits.map((a) => {
            const cdone = a.items.filter((i) => i.result).length;
            const pct = Math.round(cdone / (a.items.length || 1) * 100);
            const on = a.id === selId, closed = a.status === 'Closed';
            const sub = on ? '#9A9AA5' : '#A2A3AE';
            return (
              <button key={a.id} onClick={() => setSelId(a.id)} onMouseEnter={setStyle('borderColor', '#5F4DEE')} onMouseLeave={setStyle('borderColor', on ? '#17171C' : '#E7E7EE')}
                style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', background: on ? '#17171C' : '#fff', border: '1.5px solid ' + (on ? '#17171C' : '#E7E7EE'), borderRadius: 18, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: on ? '#8A7DF2' : '#5F4DEE' }}>{a.id}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 800, borderRadius: 99, padding: '3px 9px', marginLeft: 'auto', background: closed ? (on ? '#26262C' : '#F1F1F6') : '#8EF0C6', color: closed ? '#8A8B95' : '#0B3D2A' }}>{a.status}</span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 800, marginTop: 6, color: on ? '#fff' : '#17171C' }}>{a.name}</div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: sub, marginTop: 3 }}>{AF.fmtDate(a.from)} – {AF.fmtDate(a.to)} · {a.auditors.map((x) => AF.empName(x).split(' ')[0]).join(' & ')}</div>
                <div style={{ height: 5, borderRadius: 99, background: on ? '#26262C' : '#F1F1F6', marginTop: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, background: closed ? '#8A8B95' : '#5F4DEE', width: pct + '%' }} />
                </div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: sub, marginTop: 5 }}>{cdone} of {a.items.length} checked{closed ? ' · locked' : ''}</div>
              </button>
            );
          })}
        </div>

        {/* working view */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={{ background: '#fff', borderRadius: 22, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 18px', borderBottom: '1px solid #F1F1F5', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, fontWeight: 800 }}>{sel.name}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#A2A3AE' }}>{sel.scopeType} · {AF.fmtDate(sel.from)} – {AF.fmtDate(sel.to)} · auditors: {sel.auditors.map((x) => AF.empName(x)).join(', ')}</span>
              {editable ? (
                <button onClick={closeCycle} onMouseEnter={setStyle('background', '#C0331F')} onMouseLeave={setStyle('background', '#17171C')}
                  style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', marginLeft: 'auto', fontSize: 11, fontWeight: 800, padding: '8px 15px', borderRadius: 99, background: '#17171C', color: '#fff' }}>Close &amp; lock cycle</button>
              ) : (
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 800, color: '#8A8B95' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>Locked {AF.fmtDate(sel.closed)} — read only
                </span>
              )}
            </div>
            {sel.items.map((it) => {
              const a = AF.asset(it.asset) || {};
              const holder = a.holder ? (a.holderType === 'department' ? AF.deptName(a.holder) : AF.empName(a.holder)) : '—';
              const rowBg = it.result === 'Missing' ? '#FFFBFA' : it.result === 'Damaged' ? '#FFFDF7' : 'transparent';
              return (
                <div key={it.asset} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 18px', borderBottom: '1px solid #F6F6F9', flexWrap: 'wrap', background: rowBg }}>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: '#5F4DEE', minWidth: 66 }}>{it.asset}</span>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>{a.name || it.asset}</div>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#A2A3AE' }}>{a.loc || '—'} · held by {holder}</div>
                  </div>
                  {editable ? (
                    <input value={it.note || ''} onChange={(e) => updateItem(sel.id, it.asset, { note: e.target.value })} placeholder="Note…"
                      style={{ all: 'unset', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, padding: '7px 11px', borderRadius: 99, background: '#F7F7FA', border: '1.5px solid #EBEBF1', width: 170 }} />
                  ) : (it.note && <span style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6C75', fontStyle: 'italic', maxWidth: 200 }}>“{it.note}”</span>)}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['Verified', 'Missing', 'Damaged'].map((m) => {
                      const on = it.result === m, [bg, ink, bd] = MARK_C[m];
                      const pick = async () => {
                        if (!editable) return;
                        const result = on ? null : m;
                        try {
                          await api.saveAuditRecord(sel.id, { asset: it.asset, result: result ? result.toLowerCase() : null, notes: it.note || '' });
                          updateItem(sel.id, it.asset, { result });
                        } catch (e) { flash(e.message || 'Could not save the verdict.'); }
                      };
                      return (
                        <button key={m} onClick={pick} style={{ all: 'unset', boxSizing: 'border-box', cursor: editable ? 'pointer' : 'default', fontSize: 10, fontWeight: 800, padding: '6px 11px', borderRadius: 99, background: on ? bg : '#fff', color: on ? ink : '#A2A3AE', border: '1.5px solid ' + (on ? bd : '#E7E7EE') }}>{m}</button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {disc.length > 0 && (
            <div style={{ background: '#17171C', borderRadius: 22, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                <span style={{ color: '#fff', fontSize: 13.5, fontWeight: 800 }}>Discrepancy report</span>
                <span style={{ fontSize: 10, fontWeight: 800, background: '#E14B3B', color: '#fff', borderRadius: 99, padding: '2px 9px' }}>{disc.length}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: '#9A9AA5' }}>{editable ? 'Applied when the cycle is closed' : 'Applied at close on ' + (sel.closed ? AF.fmtDate(sel.closed) : '—')}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {disc.map((i) => {
                  const a = AF.asset(i.asset) || {};
                  const action = sel.status === 'Closed'
                    ? (i.result === 'Missing' ? 'Asset marked Lost' : 'Flagged for repair')
                    : (i.result === 'Missing' ? 'Will become Lost on close' : 'Will be flagged for maintenance');
                  return (
                    <div key={i.asset} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#1E1E24', borderRadius: 14, padding: '11px 14px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9.5, fontWeight: 800, borderRadius: 99, padding: '3px 9px', background: i.result === 'Missing' ? '#E14B3B' : '#B26205', color: '#fff' }}>{i.result}</span>
                      <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: '#9A9AA5' }}>{i.asset}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{a.name || i.asset}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 500, color: '#9A9AA5', flex: 1, minWidth: 120 }}>{i.note || 'No note yet.'}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: i.result === 'Missing' ? '#F08B7E' : '#F2C879' }}>{action}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

// ---- local styles ----------------------------------------------------------
const selectResetInline = { border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontWeight: 600, color: '#3F4046', cursor: 'pointer' };
const selBox = { boxSizing: 'border-box', fontSize: 12.5, padding: '11px 12px', borderRadius: 11, background: '#F7F7FA', border: '1.5px solid #EBEBF1', ...selectResetInline };
const dateBox = { all: 'unset', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 12.5, padding: '11px 12px', borderRadius: 11, background: '#F7F7FA', border: '1.5px solid #EBEBF1' };
const fieldLabel = { fontSize: 10.5, fontWeight: 700, color: '#3F4046' };

function FormField({ label, style, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...style }}>
      <label style={fieldLabel}>{label}</label>
      {children}
    </div>
  );
}
