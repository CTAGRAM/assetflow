import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as AF from '../data.js';
import api from '../api.js';
import { Page, PageHeader, Toast, Notice, setStyle } from '../components/screenKit.jsx';

// Recreation of design/project/Maintenance.dc.html (page body only). Raise a
// request (asset, issue, priority, photo) and walk it through the pipeline:
// Pending -> Approved -> Technician Assigned -> In Progress -> Resolved, with a
// Rejected strip. Approve/assign/start/resolve are manager-only. Reads and
// writes flow through src/api.js; edits are optimistic and mirror the prototype.

const STAGES = ['Pending', 'Approved', 'Technician Assigned', 'In Progress', 'Resolved'];
const PRI_C = { High: ['#FDECEA', '#C0331F'], Medium: ['#FBF1E0', '#A65B04'], Low: ['#F1F1F6', '#6B6C75'] };
const COL_C = {
  Pending: ['#FBF1E0', '#A65B04'], Approved: ['#E9EFFC', '#2456C4'], 'Technician Assigned': ['#EFEAF9', '#6D4FC2'],
  'In Progress': ['#EEEBFE', '#4A39C9'], Resolved: ['#E5F6EF', '#157A57'],
};
const EMPTY_TEXT = {
  Pending: 'Nothing waiting — raise a request above.', Approved: 'Approved requests land here for technician assignment.',
  'Technician Assigned': 'No jobs assigned right now.', 'In Progress': 'No active repairs.', Resolved: 'Resolved jobs will pile up here.',
};
const TECHNICIANS = ['FixIT Desk', 'AutoServ GmbH', 'AV Partners', 'In-house — Facilities'];

export default function Maintenance() {
  const location = useLocation();
  const role = AF.role();
  const me = AF.me();
  const canApprove = role === 'Asset Manager' || role === 'Admin';

  const [reqs, setReqs] = useState(null);
  const [assets, setAssets] = useState([]);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(location.hash === '#raise');
  const [fAsset, setFAsset] = useState('');
  const [fPri, setFPri] = useState('Medium');
  const [fIssue, setFIssue] = useState('');
  const [tried, setTried] = useState(false);
  const [toast, setToast] = useState(null);
  const [techPicks, setTechPicks] = useState({});
  const toastTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [m, a] = await Promise.all([api.getMaintenance(), api.getAssets()]);
        if (!alive) return;
        setReqs(m.map((x) => ({ ...x })));
        setAssets(a);
      } catch (e) {
        if (alive) setError(e.message || 'Could not load maintenance requests.');
      }
    })();
    return () => { alive = false; };
  }, []);

  const flash = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  };
  const patch = (id, next) => setReqs((rs) => rs.map((m) => m.id === id ? { ...m, ...next } : m));

  if (error) return <Page><Header {...{ formOpen, setFormOpen, setTried }} /><Notice color="#E14B3B">{error}</Notice></Page>;
  if (!reqs) return <Page><Header {...{ formOpen, setFormOpen, setTried }} /><Notice>Loading maintenance…</Notice></Page>;

  const assetOptions = assets
    .filter((a) => !['Lost', 'Disposed', 'Retired'].includes(a.status) && a.cat !== 'rooms')
    .map((a) => ({ tag: a.tag, label: a.tag + ' — ' + a.name }));
  const issueOk = fIssue.trim().length >= 10;
  const assetOk = !!fAsset;
  const fError = tried && (!assetOk || !issueOk)
    ? (!assetOk ? 'Pick the affected asset.' : 'Describe the issue in at least 10 characters so the Asset Manager can triage it.')
    : null;

  const submit = async () => {
    if (!assetOk || !issueOk) { setTried(true); return; }
    const issue = fIssue.trim();
    try {
      await api.createMaintenance({ asset: fAsset, description: issue, priority: fPri.toLowerCase() });
      setReqs(await api.getMaintenance());
      setFormOpen(false); setFAsset(''); setFIssue(''); setTried(false);
      flash('Request submitted — waiting for Asset Manager approval.');
    } catch (e) { flash(e.message || 'Could not raise the request.'); }
  };

  // pipeline actions: the API write is the source of truth, the local patch
  // mirrors it only after it succeeds
  const act = async (m, write, apply, msg) => {
    try { await write(); patch(m.id, apply); flash(msg); }
    catch (e) { flash(e.message || 'That action failed.'); }
  };
  const approve = (m) => act(m, () => api.decideMaintenance(m.id, { approve: true }), { stage: 'Approved' }, 'Approved by ' + me.name + ' — ' + assetLabel(m) + ' is now Under Maintenance.');
  const reject = (m) => act(m, () => api.decideMaintenance(m.id, { approve: false }), { stage: 'Rejected', rejectReason: 'Rejected by ' + me.name }, 'Rejected. The requester has been notified.');
  const assign = (m) => {
    const t = techPicks[m.id];
    if (!t) { flash('Pick a technician first.'); return; }
    act(m, () => api.assignMaintenance(m.id, { technician: t }), { tech: t, stage: 'Technician Assigned' }, t + ' assigned.');
  };
  const start = (m) => act(m, () => api.startMaintenance(m.id), { stage: 'In Progress' }, 'Now in progress.');
  const resolve = (m) => act(m, () => api.resolveMaintenance(m.id), { stage: 'Resolved', resolved: AF.TODAY }, 'Resolved — ' + assetLabel(m) + ' flipped back to Available.');

  const rejected = reqs.filter((m) => m.stage === 'Rejected');

  return (
    <Page>
      <Header {...{ formOpen, setFormOpen, setTried }} />
      {toast && <Toast>{toast}</Toast>}

      {formOpen && (
        <div style={{ background: '#fff', borderRadius: 22, padding: '18px 20px', marginBottom: 18, border: '1.5px solid #DCD6FB' }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 13 }}>Raise a maintenance request</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Field label="Asset *" style={{ minWidth: 230, flex: 1 }}>
              <select value={fAsset} onChange={(e) => setFAsset(e.target.value)} style={{ ...selBox, border: '1.5px solid ' + (tried && !assetOk ? '#E14B3B' : '#EBEBF1') }}>
                <option value="">Pick the affected asset…</option>
                {assetOptions.map((a) => <option key={a.tag} value={a.tag}>{a.label}</option>)}
              </select>
            </Field>
            <Field label="Priority" style={{ minWidth: 130 }}>
              <select value={fPri} onChange={(e) => setFPri(e.target.value)} style={{ ...selBox, border: '1.5px solid #EBEBF1' }}>
                <option>Low</option><option>Medium</option><option>High</option>
              </select>
            </Field>
            <Field label="Photo" style={{ minWidth: 130 }}>
              <button type="button" style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#6B6C75', padding: '11px 12px', borderRadius: 11, border: '1.5px dashed #C9C9D6', textAlign: 'center' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#5F4DEE'; e.currentTarget.style.color = '#5F4DEE'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#C9C9D6'; e.currentTarget.style.color = '#6B6C75'; }}>⇪ Attach</button>
            </Field>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10 }}>
            <label style={fieldLabel}>Describe the issue *</label>
            <textarea value={fIssue} onChange={(e) => setFIssue(e.target.value)} rows={2} placeholder="What's wrong? When did it start? Any error codes?"
              style={{ all: 'unset', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 12.5, padding: '11px 12px', borderRadius: 11, background: '#F7F7FA', border: '1.5px solid ' + (tried && !issueOk ? '#E14B3B' : '#EBEBF1'), resize: 'vertical', minHeight: 44 }} />
            {fError && <span style={{ fontSize: 10, fontWeight: 600, color: '#E14B3B' }}>{fError}</span>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button onClick={submit} onMouseEnter={setStyle('background', '#4A39C9')} onMouseLeave={setStyle('background', '#5F4DEE')}
              style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '11px 20px', borderRadius: 99, background: '#5F4DEE', color: '#fff', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, boxShadow: '0 6px 14px rgba(95,77,238,0.3)' }}>Submit request</button>
          </div>
        </div>
      )}

      {/* pipeline board */}
      <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(215px, 1fr))', gap: 12, minWidth: 1100 }}>
          {STAGES.map((st) => {
            const cards = reqs.filter((m) => m.stage === st);
            const [countBg, countInk] = COL_C[st];
            return (
              <div key={st} style={{ background: '#ffffff66', borderRadius: 20, padding: 12, minHeight: 280 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '2px 4px 10px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: countInk }} />
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: '#17171C' }}>{st}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, background: countBg, color: countInk, borderRadius: 99, padding: '2px 8px' }}>{cards.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cards.map((m) => (
                    <Card key={m.id} m={m} canApprove={canApprove}
                      techPick={techPicks[m.id] || ''} setTechPick={(v) => setTechPicks((p) => ({ ...p, [m.id]: v }))}
                      onApprove={() => approve(m)} onReject={() => reject(m)} onAssign={() => assign(m)} onStart={() => start(m)} onResolve={() => resolve(m)} />
                  ))}
                  {cards.length === 0 && (
                    <div style={{ border: '1.5px dashed #E1E1E8', borderRadius: 14, padding: '18px 10px', textAlign: 'center', fontSize: 10.5, fontWeight: 600, color: '#A2A3AE' }}>{EMPTY_TEXT[st]}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {rejected.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 18, padding: '13px 18px', marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#C0331F' }}>Rejected</span>
          {rejected.map((m) => (
            <span key={m.id} style={{ fontSize: 11, fontWeight: 600, color: '#6B6C75' }}>
              <span className="mono" style={{ fontWeight: 700, color: '#8A8B95' }}>{m.id}</span> {(AF.asset(m.asset) || {}).name} — {m.rejectReason || 'rejected'}
            </span>
          ))}
        </div>
      )}

      <div style={{ fontSize: 10.5, fontWeight: 600, color: '#A2A3AE', marginTop: 12 }}>
        Approving flips the asset to <b>Under Maintenance</b>; resolving returns it to <b>Available</b>. Full per-asset maintenance history lives in the <Link to="/assets">Asset Registry</Link> detail view.
      </div>
    </Page>
  );
}

function assetLabel(m) {
  const a = AF.asset(m.asset) || {};
  return m.asset + ' · ' + (a.name || '');
}

function Header({ formOpen, setFormOpen, setTried }) {
  const rIcon = formOpen ? 'M18 6L6 18M6 6l12 12' : 'M12 5v14M5 12h14';
  return (
    <PageHeader
      title="Maintenance"
      subtitle="Raise issues and walk them through approval, assignment, and resolution."
      right={
        <button onClick={() => { setFormOpen((v) => !v); setTried(false); }}
          style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 99, background: formOpen ? '#fff' : '#5F4DEE', color: formOpen ? '#17171C' : '#fff', border: '1.5px solid ' + (formOpen ? '#E7E7EE' : '#5F4DEE'), fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, boxShadow: '0 6px 14px rgba(95,77,238,0.25)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d={rIcon} /></svg>{formOpen ? 'Close form' : 'Raise a request'}
        </button>
      }
    />
  );
}

function Card({ m, canApprove, techPick, setTechPick, onApprove, onReject, onAssign, onStart, onResolve }) {
  const a = AF.asset(m.asset) || {};
  const [priBg, priInk] = PRI_C[m.priority] || PRI_C.Medium;
  const byName = AF.empName(m.by);
  const showTech = (m.stage === 'Technician Assigned' || m.stage === 'In Progress') && m.tech;
  return (
    <div style={{ background: '#fff', borderRadius: 15, padding: '12px 13px', boxShadow: '0 1px 4px rgba(23,23,28,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: '#5F4DEE' }}>{m.id}</span>
        <span style={{ fontSize: 9.5, fontWeight: 800, borderRadius: 99, padding: '2px 8px', background: priBg, color: priInk, marginLeft: 'auto' }}>{m.priority}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, marginTop: 6 }}>{m.asset} · {a.name}</div>
      <div style={{ fontSize: 11, fontWeight: 500, color: '#6B6C75', lineHeight: 1.5, marginTop: 4 }}>{m.issue}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9 }}>
        <span style={{ width: 20, height: 20, borderRadius: 99, background: AF.avatarBg(m.by), color: AF.avatarInk(m.by), display: 'grid', placeItems: 'center', fontSize: 7.5, fontWeight: 800 }}>{AF.initials(byName)}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#A2A3AE' }}>{byName} · {AF.fmtDate(m.date)}</span>
        {m.photo && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#A2A3AE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>}
      </div>
      {showTech && <div style={{ fontSize: 10, fontWeight: 700, color: '#6D4FC2', background: '#EFEAF9', borderRadius: 8, padding: '5px 9px', marginTop: 8 }}>🔧 {m.tech}</div>}

      {m.stage === 'Pending' && canApprove && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <button onClick={onApprove} onMouseEnter={setStyle('background', '#5F4DEE')} onMouseLeave={setStyle('background', '#17171C')}
            style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', flex: 1, textAlign: 'center', fontSize: 10.5, fontWeight: 800, padding: 7, borderRadius: 99, background: '#17171C', color: '#fff' }}>Approve</button>
          <button onClick={onReject} onMouseEnter={setStyle('background', '#FDECEA')} onMouseLeave={setStyle('background', 'transparent')}
            style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', flex: 1, textAlign: 'center', fontSize: 10.5, fontWeight: 800, padding: 7, borderRadius: 99, border: '1.5px solid #F5C6BE', color: '#C0331F', background: 'transparent' }}>Reject</button>
        </div>
      )}
      {m.stage === 'Approved' && canApprove && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <select value={techPick} onChange={(e) => setTechPick(e.target.value)} style={{ boxSizing: 'border-box', flex: 1, fontSize: 10.5, padding: '7px 9px', borderRadius: 99, background: '#F7F7FA', border: '1.5px solid #EBEBF1', ...selectResetInline }}>
            <option value="">Technician…</option>
            {TECHNICIANS.map((t) => <option key={t}>{t}</option>)}
          </select>
          <button onClick={onAssign} onMouseEnter={setStyle('background', '#5F4DEE')} onMouseLeave={setStyle('background', '#17171C')}
            style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', fontSize: 10.5, fontWeight: 800, padding: '7px 12px', borderRadius: 99, background: '#17171C', color: '#fff' }}>Assign</button>
        </div>
      )}
      {m.stage === 'Technician Assigned' && canApprove && (
        <button onClick={onStart} onMouseEnter={setStyle('background', '#5F4DEE')} onMouseLeave={setStyle('background', '#17171C')}
          style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'block', width: '100%', textAlign: 'center', fontSize: 10.5, fontWeight: 800, padding: 7, borderRadius: 99, background: '#17171C', color: '#fff', marginTop: 10 }}>Start work →</button>
      )}
      {m.stage === 'In Progress' && canApprove && (
        <button onClick={onResolve} onMouseEnter={setStyle('background', '#157A57')} onMouseLeave={setStyle('background', '#1FA97A')}
          style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'block', width: '100%', textAlign: 'center', fontSize: 10.5, fontWeight: 800, padding: 7, borderRadius: 99, background: '#1FA97A', color: '#fff', marginTop: 10 }}>Mark resolved ✓</button>
      )}
      {m.stage === 'Resolved' && (
        <div style={{ fontSize: 10, fontWeight: 700, color: '#157A57', marginTop: 8 }}>✓ Closed {AF.fmtDate(m.resolved || m.date)}{m.tech ? ' by ' + m.tech : ''}</div>
      )}
    </div>
  );
}

// ---- local styles ----------------------------------------------------------
const fieldLabel = { fontSize: 10.5, fontWeight: 700, color: '#3F4046' };
const selectResetInline = { border: 'none', outline: 'none', fontFamily: 'inherit', fontWeight: 600, color: '#3F4046', cursor: 'pointer' };
const selBox = { boxSizing: 'border-box', fontSize: 12.5, padding: '11px 12px', borderRadius: 11, background: '#F7F7FA', ...selectResetInline };

function Field({ label, style, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...style }}>
      <label style={fieldLabel}>{label}</label>
      {children}
    </div>
  );
}
